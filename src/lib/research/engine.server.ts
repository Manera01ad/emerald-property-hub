import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesInsert } from "@/integrations/supabase/types";
import { analyse, classifyPriceChange, isLikelyDuplicate, normaliseItem, qualityCheck, type NormalisedListing, type RawItem } from "./core";
import { fixtureListings } from "./fixture";

type DB = SupabaseClient<Database>;
type Source = Tables<"research_sources">;
type Obs = Tables<"source_observations">;
export type Trigger = "schedule" | "manual" | "retry";
export const AGENT_KEYS = ["discovery", "price_monitor", "quality", "deal_analysis", "location", "infrastructure"] as const;
export type AgentKey = (typeof AGENT_KEYS)[number];

type Result = { status: "success" | "skipped"; items: number; apiCalls?: number; cost?: number; message: string; details?: Record<string, unknown> };
const RUN_TIMEOUT_MS = 50_000;
const FETCH_TIMEOUT_MS = 15_000;
const PLACES_COST_USD = 0.032;
const FEED_METHODS = ["json_feed", "fixture"];

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });
}

async function fetchWithRetry(url: string, attempts = 3): Promise<unknown> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json", "User-Agent": "PropWiseResearch/1.0 (authorised feed)" } });
      clearTimeout(t);
      if (res.status === 429 || res.status >= 500) throw new Error(`Source returned ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`Source returned ${res.status}`), { terminal: true });
      return await res.json();
    } catch (e) {
      last = e;
      if ((e as { terminal?: boolean }).terminal) break;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw last;
}

/** Only enabled sources with recorded authorisation are ever contacted. */
async function feedSources(db: DB, kinds?: string[]) {
  let q = db.from("research_sources").select("*").eq("enabled", true).eq("permission_status", "authorised").in("access_method", FEED_METHODS);
  if (kinds) q = q.in("kind", kinds);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

async function loadItems(src: Source): Promise<RawItem[]> {
  if (src.access_method === "fixture") {
    const variant = new URL(src.url.replace("fixture://", "https://fixture/")).searchParams.get("variant") ?? "a";
    return fixtureListings(variant) as RawItem[];
  }
  const json = await fetchWithRetry(src.url);
  const items = Array.isArray(json) ? json : ((json as { listings?: unknown; items?: unknown })?.listings ?? (json as { items?: unknown })?.items);
  if (!Array.isArray(items)) throw new Error("Feed did not return a list of listings");
  return items as RawItem[];
}

async function readFeed(db: DB, src: Source) {
  try {
    const items = (await loadItems(src)).slice(0, src.rate_limit_per_run);
    const listings = items.map(normaliseItem).filter((x): x is NormalisedListing => !!x);
    return { listings, skipped: items.length - listings.length };
  } catch (e) {
    await db.from("research_sources").update({ last_status: `error: ${(e as Error).message}`.slice(0, 300) }).eq("id", src.id);
    throw e;
  }
}

async function discovery(db: DB, limit: number): Promise<Result> {
  const sources = (await feedSources(db)).filter((s) => s.kind !== "government");
  if (!sources.length) return { status: "skipped", items: 0, message: "No enabled, authorised property source is configured." };
  let added = 0, skipped = 0;
  for (const src of sources) {
    const { listings, skipped: sk } = await readFeed(db, src);
    skipped += sk;
    const { data: existing } = await db.from("source_observations").select("external_id").eq("source_id", src.id);
    const known = new Set((existing ?? []).map((e) => e.external_id));
    const fresh = listings.filter((l) => !known.has(l.external_id)).slice(0, Math.max(0, limit - added));
    if (fresh.length) {
      const rows: TablesInsert<"source_observations">[] = fresh.map((l) => ({ ...l, source_id: src.id, raw: l as never }));
      // ignoreDuplicates keeps re-runs idempotent on (source_id, external_id)
      const { data: ins, error } = await db.from("source_observations").upsert(rows, { onConflict: "source_id,external_id", ignoreDuplicates: true }).select("id,asking_price,source_url");
      if (error) throw error;
      if (ins?.length) await db.from("price_history").insert(ins.map((o) => ({ observation_id: o.id, price: o.asking_price, change_type: "initial", source_url: o.source_url, evidence: { source: src.name } })));
      added += ins?.length ?? 0;
    }
    await db.from("research_sources").update({ last_checked_at: new Date().toISOString(), last_status: `ok: ${listings.length} listings read` }).eq("id", src.id);
  }
  return { status: "success", items: added, message: `${added} new candidates from ${sources.length} source(s); ${skipped} items without an id ignored.` };
}

async function priceMonitor(db: DB, limit: number): Promise<Result> {
  const sources = (await feedSources(db)).filter((s) => s.kind !== "government");
  if (!sources.length) return { status: "skipped", items: 0, message: "No enabled, authorised property source to recheck." };
  const counts = { increase: 0, reduction: 0, content_change: 0, missing: 0, reappeared: 0, autoUpdated: 0 };
  const now = new Date().toISOString();
  for (const src of sources) {
    const { listings } = await readFeed(db, src);
    const byId = new Map(listings.map((l) => [l.external_id, l]));
    const { data: known } = await db.from("source_observations").select("*").eq("source_id", src.id).limit(limit);
    for (const o of known ?? []) {
      const l = byId.get(o.external_id);
      const ev = { source: src.name, checked_at: now };
      if (!l) {
        if (!o.missing_since) {
          // A missing listing is recorded as missing only — never as a sale.
          await db.from("source_observations").update({ missing_since: now }).eq("id", o.id);
          await db.from("price_history").insert({ observation_id: o.id, property_id: o.property_id, price: o.asking_price, change_type: "missing", source_url: o.source_url, evidence: ev });
          counts.missing++;
        }
        continue;
      }
      const patch: Partial<Obs> = { last_seen_at: now };
      if (o.missing_since) {
        patch.missing_since = null;
        await db.from("price_history").insert({ observation_id: o.id, property_id: o.property_id, price: l.asking_price, change_type: "reappeared", source_url: l.source_url, evidence: ev });
        counts.reappeared++;
      }
      const pc = classifyPriceChange(o.asking_price, l.asking_price);
      if (pc) {
        await db.from("price_history").insert({ observation_id: o.id, property_id: o.property_id, price: l.asking_price, previous_price: o.asking_price, change_type: pc, source_url: l.source_url, evidence: ev });
        counts[pc]++;
        patch.analysed_at = null;
        patch.quality_checked_at = null;
      }
      if (l.content_hash !== o.content_hash) {
        await db.from("price_history").insert({ observation_id: o.id, property_id: o.property_id, price: l.asking_price, change_type: "content_change", source_url: l.source_url, evidence: { ...ev, previous_hash: o.content_hash } });
        counts.content_change++;
        patch.quality_checked_at = null;
      }
      if (pc || l.content_hash !== o.content_hash) Object.assign(patch, { ...l, raw: l as never });
      await db.from("source_observations").update(patch).eq("id", o.id);
      // Authorised partner feeds may update the linked listing's price; publishing status is never touched.
      if (pc && src.can_publish && o.property_id && l.asking_price != null) {
        await db.from("properties").update({ asking_price: l.asking_price }).eq("id", o.property_id);
        counts.autoUpdated++;
      }
    }
    await db.from("research_sources").update({ last_checked_at: now, last_status: `ok: rechecked ${known?.length ?? 0}` }).eq("id", src.id);
  }
  const n = counts.increase + counts.reduction + counts.content_change + counts.missing + counts.reappeared;
  return { status: "success", items: n, message: `${counts.reduction} reductions, ${counts.increase} increases, ${counts.content_change} content changes, ${counts.missing} missing, ${counts.reappeared} reappeared.`, details: counts };
}

async function quality(db: DB, limit: number): Promise<Result> {
  const { data: todo } = await db.from("source_observations").select("*").is("quality_checked_at", null).in("review_status", ["pending", "quarantined", "duplicate"]).order("first_seen_at").limit(limit);
  if (!todo?.length) return { status: "success", items: 0, message: "Nothing new to check." };
  const { data: allObs } = await db.from("source_observations").select("id,title,property_type,location,bedrooms,asking_price,built_area_sqft,land_area_sqft,first_seen_at").neq("review_status", "rejected");
  const { data: props } = await db.from("properties").select("id,title,property_type,location,bedrooms,asking_price,built_area_sqft,land_area_sqft");
  let dup = 0, quar = 0;
  for (const o of todo) {
    const q = qualityCheck(o, [...(allObs ?? []), ...(props ?? [])]);
    const dupProp = (props ?? []).find((p) => p.id !== o.property_id && isLikelyDuplicate(o, p));
    const dupObs = (allObs ?? []).find((x) => x.id !== o.id && (x.first_seen_at < o.first_seen_at || (x.first_seen_at === o.first_seen_at && x.id < o.id)) && isLikelyDuplicate(o, x));
    let review_status = o.review_status === "approved" ? "approved" : "pending";
    if (dupProp || dupObs) { review_status = "duplicate"; q.flags.push("possible_duplicate"); dup++; }
    else if (q.quarantine) { review_status = "quarantined"; quar++; }
    await db.from("source_observations").update({
      quality_flags: q.flags,
      review_status,
      duplicate_of_property: dupProp?.id ?? null,
      duplicate_of_observation: dupProp ? null : (dupObs?.id ?? null),
      quality_checked_at: new Date().toISOString(),
    }).eq("id", o.id);
  }
  return { status: "success", items: todo.length, message: `Checked ${todo.length}: ${dup} possible duplicates, ${quar} quarantined.` };
}

async function dealAnalysis(db: DB, limit: number): Promise<Result> {
  const { data: todo } = await db.from("source_observations").select("*").is("analysed_at", null).neq("review_status", "rejected").limit(limit);
  if (!todo?.length) return { status: "success", items: 0, message: "Nothing new to analyse." };
  const { data: settings } = await db.from("app_settings").select("key,value");
  const s = Object.fromEntries((settings ?? []).map((r) => [r.key, Number(r.value)]));
  const rates = { stampDutyPct: s["stamp_duty_pct"] || 0, registrationPct: s["registration_pct"] || 0, legalFee: s["legal_fee_flat"] || 0 };
  const { data: pool } = await db.from("source_observations").select("id,property_type,location,asking_price,built_area_sqft,land_area_sqft").in("review_status", ["pending", "approved"]);
  const { data: props } = await db.from("properties").select("id,property_type,location,asking_price,built_area_sqft,land_area_sqft").eq("is_demo", false);
  let scored = 0;
  for (const o of todo) {
    const { data: first } = await db.from("price_history").select("price").eq("observation_id", o.id).eq("change_type", "initial").limit(1).maybeSingle();
    const a = analyse(o, [...(pool ?? []), ...(props ?? [])], first?.price != null ? Number(first.price) : null, rates);
    if (a.score != null) scored++;
    await db.from("source_observations").update({ analysis: a as never, analysed_at: new Date().toISOString() }).eq("id", o.id);
  }
  return { status: "success", items: todo.length, message: `Analysed ${todo.length}; ${scored} scored, ${todo.length - scored} marked insufficient data.` };
}

const PLACE_QUERY: Record<string, string> = { cbse_school: "CBSE school", hospital: "hospital", transport: "railway station OR metro station OR bus terminus" };
function km(a: number, b: number, c: number, d: number) {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

async function location(db: DB, limit: number, budgetLeft: number): Promise<Result> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const maps = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovable || !maps) return { status: "skipped", items: 0, message: "Google Maps is not connected." };
  const { data: props } = await db.from("properties").select("id,latitude,longitude").not("latitude", "is", null).not("longitude", "is", null);
  const { data: placed } = await db.from("nearby_places").select("property_id").like("source", "Google Maps%");
  const done = new Set((placed ?? []).map((p) => p.property_id));
  const todo = (props ?? []).filter((p) => !done.has(p.id)).slice(0, limit);
  if (!todo.length) return { status: "success", items: 0, message: `No listing needs suggestions (${props?.length ?? 0} listings have coordinates; add latitude/longitude in Listings).` };
  let calls = 0, added = 0;
  for (const p of todo) {
    for (const [category, textQuery] of Object.entries(PLACE_QUERY)) {
      if ((calls + 1) * PLACES_COST_USD > budgetLeft) return { status: "success", items: added, apiCalls: calls, cost: calls * PLACES_COST_USD, message: `Stopped at monthly cost cap after ${calls} calls.` };
      const res = await fetch("https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": maps, "Content-Type": "application/json", "X-Goog-FieldMask": "places.displayName,places.location" },
        body: JSON.stringify({ textQuery, pageSize: 3, locationBias: { circle: { center: { latitude: Number(p.latitude), longitude: Number(p.longitude) }, radius: 8000 } } }),
      });
      calls++;
      if (!res.ok) throw new Error(`Google Places returned ${res.status}`);
      const j = (await res.json()) as { places?: { displayName?: { text: string }; location?: { latitude: number; longitude: number } }[] };
      const rows = (j.places ?? []).filter((x) => x.location).map((x) => ({
        property_id: p.id, category, name: x.displayName?.text ?? "Unnamed",
        distance_km: km(Number(p.latitude), Number(p.longitude), x.location!.latitude, x.location!.longitude),
        source: "Google Maps (straight-line distance)", verified: false,
      }));
      if (rows.length) { await db.from("nearby_places").insert(rows); added += rows.length; }
    }
  }
  return { status: "success", items: added, apiCalls: calls, cost: calls * PLACES_COST_USD, message: `${added} unverified nearby-place suggestions for ${todo.length} listing(s). Distances are straight-line; road routing is not configured.` };
}

const INFRA_STATUS: Record<string, string> = { proposed: "announced", announced: "announced", approved: "approved", under_construction: "under_construction", operational: "completed", completed: "completed", stalled: "stalled" };

async function infrastructure(db: DB, limit: number): Promise<Result> {
  const sources = await feedSources(db, ["government"]);
  if (!sources.length) return { status: "skipped", items: 0, message: "No authorised official government source is configured." };
  let n = 0;
  for (const src of sources) {
    const items = (await loadItems(src)).slice(0, Math.min(limit, src.rate_limit_per_run));
    for (const it of items) {
      const ref = String(it.id ?? "").slice(0, 200);
      const name = String(it.name ?? "").slice(0, 200);
      if (!ref || !name) continue;
      const row = {
        name, location: String(it.location ?? "Chennai").slice(0, 120), description: it.description ? String(it.description).slice(0, 2000) : null,
        progress_status: INFRA_STATUS[String(it.status ?? "").toLowerCase()] ?? "announced",
        source_url: it.url ? String(it.url) : src.url, authority: it.authority ? String(it.authority) : null,
        published_on: it.published_on ? String(it.published_on).slice(0, 10) : null, last_checked: new Date().toISOString().slice(0, 10),
        source_id: src.id, external_ref: ref,
      };
      const { data: ex } = await db.from("infrastructure_projects").select("id").eq("source_id", src.id).eq("external_ref", ref).maybeSingle();
      // New records stay unpublished and unverified until an admin reviews them.
      if (ex) await db.from("infrastructure_projects").update(row).eq("id", ex.id);
      else await db.from("infrastructure_projects").insert({ ...row, verified: false, is_published: false });
      n++;
    }
    await db.from("research_sources").update({ last_checked_at: new Date().toISOString(), last_status: `ok: ${n} items` }).eq("id", src.id);
  }
  return { status: "success", items: n, message: `${n} infrastructure records refreshed (unpublished until reviewed).` };
}

/** Runs one agent with a database lease (single-flight), timeout, cost cap and a run log. */
export async function runAgent(db: DB, key: AgentKey, trigger: Trigger, opts: { ignorePause?: boolean } = {}) {
  const now = new Date();
  const { data: agent } = await db.from("research_agents").select("*").eq("key", key).single();
  if (!agent) throw new Error(`Unknown agent ${key}`);
  if (agent.status === "paused" && !opts.ignorePause) return { key, status: "skipped" as const, message: "Agent is paused." };
  const leaseUntil = new Date(now.getTime() + 2 * 60_000).toISOString();
  const { data: locked } = await db.from("research_agents").update({ lease_until: leaseUntil })
    .eq("key", key).or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`).select("key");
  if (!locked?.length) return { key, status: "skipped" as const, message: "Already running." };

  const month = now.toISOString().slice(0, 7);
  const spent = agent.cost_month === month ? Number(agent.est_cost_month) : 0;
  const calls = agent.cost_month === month ? agent.api_calls_month : 0;
  const { data: run } = await db.from("research_runs").insert({ agent_key: key, trigger }).select("id").single();
  let r: Result;
  let error: string | null = null;
  try {
    const lim = agent.max_items_per_run;
    const work = key === "discovery" ? discovery(db, lim) : key === "price_monitor" ? priceMonitor(db, lim) : key === "quality" ? quality(db, lim)
      : key === "deal_analysis" ? dealAnalysis(db, lim) : key === "location" ? location(db, lim, Number(agent.monthly_cost_cap_usd) - spent) : infrastructure(db, lim);
    r = await withTimeout(work, RUN_TIMEOUT_MS, "Agent run");
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    r = { status: "success", items: 0, message: "Failed" };
  }
  const finished = new Date().toISOString();
  const failed = error != null;
  const failures = failed ? agent.consecutive_failures + 1 : 0;
  // Failed runs retry with backoff (1h, 2h, 4h… capped at the normal interval).
  const delayH = failed ? Math.min(agent.interval_hours, 2 ** (failures - 1)) : agent.interval_hours;
  await db.from("research_runs").update({
    status: failed ? "failed" : r.status, finished_at: finished, items_processed: r.items, api_calls: r.apiCalls ?? 0, est_cost: r.cost ?? 0,
    message: failed ? null : r.message, error, details: (r.details ?? {}) as never,
  }).eq("id", run!.id);
  await db.from("research_agents").update({
    lease_until: null, last_run_at: finished, last_status: failed ? "failed" : r.status, last_error: error,
    last_success_at: failed ? agent.last_success_at : finished, consecutive_failures: failures,
    next_run_at: new Date(Date.now() + delayH * 3600_000).toISOString(),
    cost_month: month, api_calls_month: calls + (r.apiCalls ?? 0), est_cost_month: spent + (r.cost ?? 0),
  }).eq("key", key);
  return { key, status: failed ? ("failed" as const) : r.status, message: error ?? r.message };
}

/** Scheduler entry: runs every active agent that is due, in pipeline order. Analysis follows source updates. */
export async function runDueAgents(db: DB) {
  const { data: due } = await db.from("research_agents").select("key").eq("status", "active").lte("next_run_at", new Date().toISOString());
  const dueKeys = new Set((due ?? []).map((d) => d.key));
  const results = [];
  let sourceUpdated = false;
  for (const key of AGENT_KEYS) {
    const followUp = sourceUpdated && (key === "quality" || key === "deal_analysis");
    if (!dueKeys.has(key) && !followUp) continue;
    const r = await runAgent(db, key, "schedule");
    if ((key === "discovery" || key === "price_monitor") && r.status === "success") sourceUpdated = true;
    results.push(r);
  }
  return results;
}
