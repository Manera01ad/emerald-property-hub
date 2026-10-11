/** Pure research-engine logic (no I/O) so it can be unit tested. */

export type RawItem = Record<string, unknown>;

export type NormalisedListing = {
  external_id: string;
  source_url: string | null;
  title: string | null;
  property_type: string | null;
  location: string | null;
  address: string | null;
  asking_price: number | null;
  land_area_sqft: number | null;
  built_area_sqft: number | null;
  bedrooms: number | null;
  seller_name: string | null;
  listed_at: string | null;
  source_updated_at: string | null;
  rera_claim: string | null;
  approval_claims: string[];
  availability: string | null;
  content_hash: string;
};

const TYPES = ["villa", "independent_house", "resale_home", "apartment", "plot"];

function str(v: unknown, max = 500): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[,₹\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function date(v: unknown): string | null {
  const s = str(v, 40);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function normType(v: unknown): string | null {
  const s = str(v, 60)?.toLowerCase().replace(/[\s-]+/g, "_") ?? null;
  if (!s) return null;
  if (TYPES.includes(s)) return s;
  if (s.includes("flat") || s.includes("apartment")) return "apartment";
  if (s.includes("plot") || s.includes("land")) return "plot";
  if (s.includes("villa")) return "villa";
  if (s.includes("house")) return "independent_house";
  return null;
}

/** FNV-1a hash of the fields that matter for change detection. */
export function hashContent(l: Omit<NormalisedListing, "content_hash">): string {
  const s = JSON.stringify([l.title, l.property_type, l.location, l.address, l.land_area_sqft, l.built_area_sqft, l.bedrooms, l.rera_claim, l.approval_claims, l.availability]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/** Extracts only fields actually present; never fills gaps with guesses. Returns null when there is no stable id. */
export function normaliseItem(raw: RawItem): NormalisedListing | null {
  const external_id = str(raw.id ?? raw.external_id ?? raw.listing_id, 200);
  if (!external_id) return null;
  const approvals = Array.isArray(raw.approvals) ? raw.approvals.map((a) => str(a, 80)).filter((a): a is string => !!a) : [];
  const base = {
    external_id,
    source_url: str(raw.url ?? raw.source_url, 1000),
    title: str(raw.title, 200),
    property_type: normType(raw.property_type ?? raw.type),
    location: str(raw.locality ?? raw.location, 120),
    address: str(raw.address, 300),
    asking_price: num(raw.price ?? raw.asking_price),
    land_area_sqft: num(raw.land_area_sqft ?? raw.land_area),
    built_area_sqft: num(raw.built_area_sqft ?? raw.built_area),
    bedrooms: num(raw.bedrooms) != null ? Math.round(num(raw.bedrooms)!) : null,
    seller_name: str(raw.seller ?? raw.developer, 120),
    listed_at: date(raw.listed_at ?? raw.listing_date),
    source_updated_at: date(raw.updated_at ?? raw.update_date),
    rera_claim: str(raw.rera ?? raw.rera_number, 80),
    approval_claims: approvals,
    availability: str(raw.availability ?? raw.status, 40),
  };
  return { ...base, content_hash: hashContent(base) };
}

export type PriceChange = "increase" | "reduction" | null;
export function classifyPriceChange(prev: number | null | undefined, next: number | null | undefined): PriceChange {
  if (prev == null || next == null || Number(prev) === Number(next)) return null;
  return Number(next) > Number(prev) ? "increase" : "reduction";
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\[demo\]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const close = (a: number | null | undefined, b: number | null | undefined, tol: number) =>
  a != null && b != null && Number(a) > 0 && Math.abs(Number(a) - Number(b)) / Number(a) <= tol;

export type Comparable = {
  id: string;
  title?: string | null;
  property_type: string | null;
  location: string | null;
  bedrooms?: number | null;
  asking_price: number | null;
  built_area_sqft?: number | null;
  land_area_sqft?: number | null;
};

/** Likely the same physical property: same locality and type, plus matching size/bedrooms and price within 5%. */
export function isLikelyDuplicate(a: Comparable, b: Comparable): boolean {
  if (!a.location || !b.location || norm(a.location) !== norm(b.location)) return false;
  if (!a.property_type || a.property_type !== b.property_type) return false;
  const sameTitle = !!a.title && norm(a.title) === norm(b.title);
  const sameSize = close(a.built_area_sqft, b.built_area_sqft, 0.03) || (a.built_area_sqft == null && close(a.land_area_sqft, b.land_area_sqft, 0.03));
  const sameBeds = (a.bedrooms ?? null) === (b.bedrooms ?? null);
  const samePrice = close(a.asking_price, b.asking_price, 0.05);
  return (sameSize && sameBeds && samePrice) || (sameTitle && sameSize);
}

export function areaOf(c: Comparable): number | null {
  const a = c.property_type === "plot" ? c.land_area_sqft : (c.built_area_sqft ?? c.land_area_sqft);
  return a != null && Number(a) > 0 ? Number(a) : null;
}
export function ppsf(c: Comparable): number | null {
  const a = areaOf(c);
  return a && c.asking_price ? Number(c.asking_price) / a : null;
}
function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export type QualityResult = { flags: string[]; quarantine: boolean };
export function qualityCheck(o: Comparable & { source_url: string | null; last_seen_at?: string | null; missing_since?: string | null }, pool: Comparable[], now = new Date()): QualityResult {
  const flags: string[] = [];
  if (!o.source_url) flags.push("missing_source_url");
  if (o.asking_price == null) flags.push("missing_price");
  if (!o.location) flags.push("missing_location");
  if (!o.property_type) flags.push("unknown_property_type");
  if (o.asking_price != null && Number(o.asking_price) < 100000) flags.push("implausible_price");
  const own = ppsf(o);
  const peers = pool.filter((p) => p.id !== o.id && p.location && o.location && norm(p.location) === norm(o.location) && p.property_type === o.property_type).map(ppsf).filter((x): x is number => x != null);
  if (own != null && peers.length >= 2) {
    const m = median(peers);
    if (own > m * 3 || own < m / 3) flags.push("price_outlier");
  }
  if (o.last_seen_at && now.getTime() - new Date(o.last_seen_at).getTime() > 30 * 86400000) flags.push("stale");
  if (o.missing_since) flags.push("missing_from_source");
  const quarantine = flags.some((f) => ["missing_source_url", "missing_price", "implausible_price", "price_outlier"].includes(f));
  return { flags, quarantine };
}

export type CostRates = { stampDutyPct: number; registrationPct: number; legalFee: number };

export type Analysis = {
  price_per_sqft: number | null;
  estimated_total_cost: number | null;
  comparable_count: number;
  comparable_median_ppsf: number | null;
  price_change_pct: number | null;
  missing: string[];
  score: number | null;
  score_parts: { label: string; points: number | null; reason: string }[];
  note: string;
};

/** Transparent score from asking prices only. Unavailable (null) unless price, area and ≥2 comparables exist. */
export function analyse(o: Comparable & { rera_claim?: string | null; approval_claims?: string[] }, pool: Comparable[], firstPrice: number | null, rates: CostRates): Analysis {
  const own = ppsf(o);
  const comps = pool.filter((p) => p.id !== o.id && p.location && o.location && norm(p.location) === norm(o.location) && p.property_type === o.property_type).map(ppsf).filter((x): x is number => x != null);
  const med = comps.length ? median(comps) : null;
  const total = o.asking_price != null ? Math.round(Number(o.asking_price) * (1 + (rates.stampDutyPct + rates.registrationPct) / 100) + rates.legalFee) : null;
  const change = firstPrice && o.asking_price != null ? ((Number(o.asking_price) - firstPrice) / firstPrice) * 100 : null;
  const missing: string[] = [];
  if (!o.rera_claim && o.property_type !== "plot") missing.push("No RERA number claimed");
  if (!o.approval_claims?.length) missing.push("No approvals claimed");
  missing.push("Title documents not reviewed", "Guideline value not confirmed");
  const parts: Analysis["score_parts"] = [];
  let score: number | null = null;
  if (own != null && med != null && comps.length >= 2) {
    const delta = ((own - med) / med) * 100;
    const value = Math.max(0, Math.min(60, Math.round(30 - delta)));
    parts.push({ label: "Price vs comparable asking prices", points: value, reason: `${Math.abs(delta).toFixed(1)}% ${delta >= 0 ? "above" : "below"} median of ${comps.length} asking prices` });
    const docs = Math.max(0, 20 - (missing.length - 2) * 10);
    parts.push({ label: "Claimed RERA / approvals", points: docs, reason: missing.length > 2 ? missing.slice(0, -2).join("; ") : "Claims present (not verified)" });
    const trend = change != null && change < 0 ? Math.min(20, Math.round(-change * 2)) : 0;
    parts.push({ label: "Price trend", points: trend, reason: change != null ? `${change.toFixed(1)}% since first seen` : "No history" });
    score = parts.reduce((s, p) => s + (p.points ?? 0), 0);
  } else {
    parts.push({ label: "Score", points: null, reason: own == null ? "Missing price or area" : "Fewer than 2 comparable asking prices" });
  }
  return {
    price_per_sqft: own != null ? Math.round(own) : null,
    estimated_total_cost: total,
    comparable_count: comps.length,
    comparable_median_ppsf: med != null ? Math.round(med) : null,
    price_change_pct: change != null ? Math.round(change * 10) / 10 : null,
    missing,
    score,
    score_parts: parts,
    note: "Based on asking prices only — not transaction prices, guideline values or legal verification.",
  };
}
