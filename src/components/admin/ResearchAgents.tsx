import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Pause, Play, RotateCcw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatINRFull } from "@/lib/format";
import { humanize } from "@/lib/constants";
import { runResearchAgent } from "@/lib/research.functions";
import { Panel, selectCls, Stat } from "./shared";

type Obs = Tables<"source_observations">;
const KINDS = ["licensed_feed", "partner_api", "developer_site", "owner_submitted", "public_webpage", "government", "google_maps", "test_fixture"];
const METHODS = ["json_feed", "fixture", "google_places", "manual"];
const PERMS = ["pending", "authorised", "denied", "expired"];

function useT<T>(key: string, fn: () => Promise<T>) {
  return useQuery({ queryKey: ["research", key], queryFn: fn, refetchInterval: 15_000 });
}
const when = (d: string | null | undefined) => (d ? new Date(d).toLocaleString() : "—");

export function ResearchAgents() {
  const qc = useQueryClient();
  const run = useServerFn(runResearchAgent);
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["research"] });

  const { data: agents = [] } = useT("agents", async () => (await supabase.from("research_agents").select("*").order("key")).data ?? []);
  const { data: sources = [] } = useT("sources", async () => (await supabase.from("research_sources").select("*").order("created_at")).data ?? []);
  const { data: obs = [] } = useT("obs", async () => (await supabase.from("source_observations").select("*").order("first_seen_at", { ascending: false }).limit(300)).data ?? []);
  const { data: changes = [] } = useT("changes", async () => (await supabase.from("price_history").select("*").neq("change_type", "initial").order("observed_at", { ascending: false }).limit(50)).data ?? []);
  const { data: runs = [] } = useT("runs", async () => (await supabase.from("research_runs").select("*").order("started_at", { ascending: false }).limit(40)).data ?? []);

  async function doRun(key: string, trigger: "manual" | "retry") {
    setBusy(key);
    try {
      const res = await run({ data: { key: key as never, trigger } });
      res.forEach((r) => (r.status === "failed" ? toast.error(`${r.key}: ${r.message}`) : toast.success(`${r.key}: ${r.message}`)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(null);
      refresh();
    }
  }
  async function setAgent(key: string, status: "active" | "paused") {
    const { error } = await supabase.from("research_agents").update({ status }).eq("key", key);
    if (error) toast.error(error.message);
    refresh();
  }

  const propertySources = sources.filter((s) => s.kind !== "government" && s.kind !== "google_maps");
  const authorised = propertySources.filter((s) => s.enabled && s.permission_status === "authorised");
  const realAuthorised = authorised.filter((s) => s.kind !== "test_fixture");
  const queue = obs.filter((o) => ["pending", "duplicate", "quarantined"].includes(o.review_status));
  const monthCost = agents.reduce((s, a) => s + Number(a.est_cost_month), 0);
  const monthCalls = agents.reduce((s, a) => s + a.api_calls_month, 0);

  return (
    <div className="mt-4 space-y-6">
      {realAuthorised.length === 0 && (
        <div className="flex gap-3 rounded-xl border border-gold bg-gold/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-gold" />
          <div>
            <p className="font-medium">Setup required: no authorised real property source is connected.</p>
            <p className="text-muted-foreground">Add a licensed feed, partner API or developer feed below, record the permission evidence, mark it authorised and enable it. {authorised.length > 0 && "Only the labelled test fixture is running — its listings are fictional."} The agents never invent inventory.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="New candidates" value={obs.filter((o) => o.review_status === "pending").length} />
        <Stat label="Price changes" value={changes.filter((c) => c.change_type === "increase" || c.change_type === "reduction").length} />
        <Stat label="Possible duplicates" value={obs.filter((o) => o.review_status === "duplicate").length} />
        <Stat label="Quarantined" value={obs.filter((o) => o.review_status === "quarantined").length} />
        <Stat label="API use this month" value={`$${monthCost.toFixed(2)}`} sub={`${monthCalls} Google calls (estimated)`} />
      </div>

      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">Agents</p>
          <Button size="sm" disabled={!!busy} onClick={() => doRun("all", "manual")}><Zap /> Run full pipeline</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Agent</th><th>Status</th><th>Last success</th><th>Next run</th><th>Every</th><th>Last result</th><th /></tr></thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.key} className="border-b align-top last:border-0">
                  <td className="py-2"><p className="font-medium">{a.name}</p><p className="max-w-64 text-xs text-muted-foreground">{a.description}</p></td>
                  <td>
                    <Badge variant={a.status === "paused" ? "secondary" : a.last_status === "failed" ? "destructive" : "default"}>
                      {a.status === "paused" ? "Paused" : a.last_status === "failed" ? "Failed" : a.lease_until && new Date(a.lease_until) > new Date() ? "Running" : "Active"}
                    </Badge>
                  </td>
                  <td className="text-xs">{when(a.last_success_at)}</td>
                  <td className="text-xs">{a.status === "paused" ? "Paused" : when(a.next_run_at)}</td>
                  <td className="text-xs">{a.interval_hours >= 168 ? "Weekly" : a.interval_hours === 24 ? "Daily" : `${a.interval_hours} h`}</td>
                  <td className="max-w-72 text-xs">{a.last_error ? <span className="text-destructive">{a.last_error}</span> : (runs.find((r) => r.agent_key === a.key)?.message ?? "—")}</td>
                  <td className="whitespace-nowrap text-right">
                    <Button size="sm" variant="outline" disabled={!!busy || a.status === "paused"} onClick={() => doRun(a.key, "manual")}><Play /> Run now</Button>{" "}
                    {a.last_status === "failed" && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => doRun(a.key, "retry")}><RotateCcw /> Retry</Button>}{" "}
                    {a.status === "paused"
                      ? <Button size="sm" variant="ghost" onClick={() => setAgent(a.key, "active")}>Resume</Button>
                      : <Button size="sm" variant="ghost" onClick={() => setAgent(a.key, "paused")}><Pause /> Pause</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">The backend scheduler checks hourly and runs agents that are due. Discovery and price checks are daily; location and infrastructure are weekly; quality and analysis also run straight after any source update.</p>
      </Panel>

      <Sources sources={sources} onChange={refresh} />
      <ReviewQueue queue={queue} sources={sources} onChange={refresh} />

      <Panel>
        <p className="mb-2 font-medium">Recent price and availability changes</p>
        {changes.length === 0 ? <p className="text-sm text-muted-foreground">None recorded yet.</p> : (
          <ul className="space-y-1 text-sm">
            {changes.map((c) => {
              const o = obs.find((x) => x.id === c.observation_id);
              return (
                <li key={c.id}>
                  <span className="text-xs text-muted-foreground">{when(c.observed_at)}</span> · {o?.title ?? "Listing"} · <b>{humanize(c.change_type)}</b>
                  {c.previous_price != null && c.price != null && ` ${formatINR(c.previous_price)} → ${formatINR(c.price)}`}
                  {c.change_type === "missing" && " (no longer in source — not treated as sold)"}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel>
        <p className="mb-2 font-medium">Execution log</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-xs">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-1">Started</th><th>Agent</th><th>Trigger</th><th>Status</th><th>Items</th><th>API calls</th><th>Message / error</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-1">{when(r.started_at)}</td><td>{r.agent_key}</td><td>{r.trigger}</td>
                  <td className={r.status === "failed" ? "text-destructive" : ""}>{r.status}</td><td>{r.items_processed}</td><td>{r.api_calls}</td>
                  <td>{r.error ?? r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {runs.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No runs yet.</p>}
        </div>
      </Panel>
    </div>
  );
}

function Sources({ sources, onChange }: { sources: Tables<"research_sources">[]; onChange: () => void }) {
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const url = String(f.get("url") || "").trim();
    const method = String(f.get("method"));
    if (method === "json_feed" && !/^https:\/\//.test(url)) return void toast.error("Feed URL must start with https://");
    const { error } = await supabase.from("research_sources").insert({
      name: String(f.get("name") || "").trim().slice(0, 120) || "Untitled source",
      kind: String(f.get("kind")), access_method: method, url: url.slice(0, 1000),
      permitted_usage: String(f.get("usage") || "") || null,
      refresh_hours: Number(f.get("refresh") || 24), rate_limit_per_run: Number(f.get("limit") || 50),
    });
    if (error) return void toast.error(error.message);
    form.reset();
    onChange();
  }
  async function update(id: string, patch: Partial<Tables<"research_sources">>) {
    const { error } = await supabase.from("research_sources").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    onChange();
  }
  return (
    <Panel>
      <p className="mb-1 font-medium">Data sources</p>
      <p className="mb-3 text-xs text-muted-foreground">Only sources marked authorised and enabled are contacted. The engine reads structured feeds only — no scraping, login bypass, CAPTCHA or paywall circumvention.</p>
      <div className="space-y-2">
        {sources.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
            <div className="min-w-56 flex-1">
              <p className="font-medium">{s.name} {s.kind === "test_fixture" && <Badge variant="secondary">TEST FIXTURE</Badge>}</p>
              <p className="break-all text-xs text-muted-foreground">{humanize(s.kind)} · {humanize(s.access_method)} · {s.url}</p>
              <p className="text-xs text-muted-foreground">Every {s.refresh_hours} h · max {s.rate_limit_per_run}/run · last checked {when(s.last_checked_at)} {s.last_status && `· ${s.last_status}`}</p>
            </div>
            <Input className="h-8 w-56" placeholder="Permission evidence" defaultValue={s.permission_evidence ?? ""} onBlur={(e) => e.target.value !== (s.permission_evidence ?? "") && update(s.id, { permission_evidence: e.target.value || null })} />
            <select className={selectCls + " h-8 w-32"} value={s.permission_status} onChange={(e) => update(s.id, { permission_status: e.target.value })}>{PERMS.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}</select>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={s.can_publish} onChange={(e) => update(s.id, { can_publish: e.target.checked })} /> may update linked listings</label>
            <Button size="sm" variant={s.enabled ? "outline" : "default"} onClick={() => {
              if (!s.enabled && s.permission_status !== "authorised") return void toast.error("Mark the source authorised (with evidence) before enabling it.");
              update(s.id, { enabled: !s.enabled });
            }}>{s.enabled ? "Disable" : "Enable"}</Button>
          </div>
        ))}
        {sources.length === 0 && <p className="text-sm text-muted-foreground">No sources yet.</p>}
      </div>
      <form onSubmit={add} className="mt-4 grid gap-2 md:grid-cols-4">
        <Input name="name" placeholder="Source name" required />
        <select name="kind" className={selectCls}>{KINDS.map((k) => <option key={k} value={k}>{humanize(k)}</option>)}</select>
        <select name="method" className={selectCls}>{METHODS.map((k) => <option key={k} value={k}>{humanize(k)}</option>)}</select>
        <Input name="url" placeholder="https://feed URL" required />
        <Input name="usage" placeholder="Permitted usage" />
        <Input name="refresh" type="number" min={1} max={720} placeholder="Refresh hours (24)" />
        <Input name="limit" type="number" min={1} max={500} placeholder="Max items per run (50)" />
        <Button type="submit">Add source</Button>
      </form>
    </Panel>
  );
}

function ReviewQueue({ queue, sources, onChange }: { queue: Obs[]; sources: Tables<"research_sources">[]; onChange: () => void }) {
  async function createDraft(o: Obs) {
    if (!o.property_type || !o.location || o.asking_price == null) return void toast.error("Type, location and price are required to create a draft.");
    const src = sources.find((s) => s.id === o.source_id);
    const fixture = src?.kind === "test_fixture";
    const { data, error } = await supabase.from("properties").insert({
      title: o.title ?? "Untitled", property_type: o.property_type, location: o.location, address: o.address,
      asking_price: o.asking_price, bedrooms: o.bedrooms, built_area_sqft: o.built_area_sqft, land_area_sqft: o.land_area_sqft,
      rera_number: o.rera_claim, approval_details: o.approval_claims.length ? `Claimed by source (unverified): ${o.approval_claims.join(", ")}` : null,
      // Always a draft, unverified, without listing permission. Test-fixture drafts are also marked demo so they can never go public.
      status: "draft", verification_status: "unverified", listing_permission: false, is_demo: fixture,
      source: `${src?.name ?? "Research source"}${o.source_url ? ` — ${o.source_url}` : ""}`,
    }).select("id").single();
    if (error) return void toast.error(error.message);
    await supabase.from("source_observations").update({ review_status: "approved", property_id: data.id }).eq("id", o.id);
    await supabase.from("price_history").update({ property_id: data.id }).eq("observation_id", o.id);
    toast.success("Draft listing created — verify and get owner permission before publishing.");
    onChange();
  }
  async function setStatus(o: Obs, review_status: string) {
    const patch = review_status === "pending" ? { review_status, quality_checked_at: new Date().toISOString(), duplicate_of_property: null, duplicate_of_observation: null } : { review_status };
    const { error } = await supabase.from("source_observations").update(patch).eq("id", o.id);
    if (error) toast.error(error.message);
    onChange();
  }
  return (
    <Panel>
      <p className="mb-3 font-medium">Research review queue ({queue.length})</p>
      {queue.length === 0 ? <p className="text-sm text-muted-foreground">Nothing waiting for review.</p> : (
        <div className="space-y-2">
          {queue.map((o) => {
            const a = o.analysis as null | { price_per_sqft: number | null; score: number | null; comparable_count: number; estimated_total_cost: number | null; score_parts: { reason: string }[] };
            return (
              <div key={o.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{o.title ?? o.external_id} <Badge variant={o.review_status === "quarantined" ? "destructive" : "secondary"}>{humanize(o.review_status)}</Badge></p>
                    <p className="text-xs text-muted-foreground">
                      {sources.find((s) => s.id === o.source_id)?.name} · {o.location ?? "no location"} · {o.property_type ? humanize(o.property_type) : "unknown type"}
                      {o.asking_price != null && ` · ${formatINRFull(o.asking_price)}`}{o.bedrooms != null && ` · ${o.bedrooms} BHK`}
                      {o.missing_since && " · missing from source"} · seen {when(o.last_seen_at)}
                    </p>
                    {o.source_url && <p className="break-all text-xs text-muted-foreground">Source: {o.source_url}</p>}
                    {o.quality_flags.length > 0 && <p className="text-xs text-destructive">Flags: {o.quality_flags.map(humanize).join(", ")}</p>}
                    {a && <p className="text-xs">{a.price_per_sqft != null ? `₹${a.price_per_sqft.toLocaleString("en-IN")}/sq ft · ` : ""}{a.estimated_total_cost != null && `est. total ${formatINR(a.estimated_total_cost)} · `}Score: {a.score ?? "unavailable"} ({a.score_parts[0]?.reason})</p>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" onClick={() => createDraft(o)}>Create draft listing</Button>
                    {o.review_status !== "pending" && <Button size="sm" variant="outline" onClick={() => setStatus(o, "pending")}>Not a problem</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setStatus(o, "rejected")}>Reject</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
