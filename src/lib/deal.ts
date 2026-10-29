import { DOCS } from "./constants";
import type { Evidence } from "./evidence";
import { transactionTypeOf } from "./transaction";

/** Below this many comparables, a price comparison is UNKNOWN rather than a weak claim. */
export const MIN_COMPARABLES = 5;

export type CostRules = { stampDutyPct: number; registrationPct: number; legalFee: number };

export type DealProperty = {
  id: string;
  property_type: string;
  location: string;
  asking_price: number;
  guideline_value?: number | null;
  built_area_sqft?: number | null;
  land_area_sqft?: number | null;
  amenities?: string[];
  availability?: string;
  verification_status?: string;
  created_at?: string;
  doc_title_deed?: boolean;
  doc_encumbrance?: boolean;
  doc_patta?: boolean;
  doc_approved_plan?: boolean;
  doc_building_permit?: boolean;
};

export type NearbyPlace = { category: string; distance_km: number | null; verified: boolean };

/** Estimated purchase cost. Duties apply to the higher of price or guideline value. */
export function purchaseCost(p: Pick<DealProperty, "asking_price" | "guideline_value">, rules: CostRules) {
  const base = Math.max(Number(p.asking_price) || 0, Number(p.guideline_value) || 0);
  const stampDuty = (base * rules.stampDutyPct) / 100;
  const registration = (base * rules.registrationPct) / 100;
  const legal = rules.legalFee;
  const total = Number(p.asking_price) + stampDuty + registration + legal;
  return { base, stampDuty, registration, legal, total };
}

export function areaFor(p: DealProperty): number | null {
  const a = p.property_type === "plot" ? p.land_area_sqft : p.built_area_sqft ?? p.land_area_sqft;
  return a && Number(a) > 0 ? Number(a) : null;
}

export function pricePerSqft(p: DealProperty): number | null {
  const a = areaFor(p);
  return a ? Number(p.asking_price) / a : null;
}

export type Comparables = {
  count: number;
  avgPpsf: number | null;
  deltaPct: number | null;
  /** ESTIMATE only once there are enough comparables; UNKNOWN below the minimum. */
  evidence: Evidence;
};

/**
 * Comparables: same location, same type and same transaction, excluding self, with a usable area.
 *
 * The transaction filter matters. A rent at ₹25,000 a month and a sale at ₹1 crore are both
 * numbers in the same column, but they are not comparable, and mixing them would produce a
 * confident-looking score from two unrelated figures. A row with no transaction type is a
 * sale, which is what the column defaults to for listings written before it existed.
 */
export function comparablesFor(p: DealProperty, pool: DealProperty[]): Comparables {
  const type = transactionTypeOf(p);
  const comps = pool.filter(
    (c) =>
      c.id !== p.id &&
      c.location === p.location &&
      c.property_type === p.property_type &&
      transactionTypeOf(c) === type &&
      pricePerSqft(c) != null,
  );
  if (comps.length === 0) return { count: 0, avgPpsf: null, deltaPct: null, evidence: "UNKNOWN" };
  const avg = comps.reduce((s, c) => s + (pricePerSqft(c) as number), 0) / comps.length;
  const own = pricePerSqft(p);
  const enough = comps.length >= MIN_COMPARABLES;
  return {
    count: comps.length,
    avgPpsf: avg,
    deltaPct: enough && own != null ? ((own - avg) / avg) * 100 : null,
    evidence: enough ? "ESTIMATE" : "UNKNOWN",
  };
}

export function missingDocs(p: DealProperty) {
  return DOCS.filter((d) => !p[d.key as keyof DealProperty]).map((d) => d.label);
}

export type ScorePart = { key: string; label: string; score: number | null; reason: string; evidence: Evidence };

export function dealScore(p: DealProperty, pool: DealProperty[], places: NearbyPlace[]) {
  const parts: ScorePart[] = [];
  const comps = comparablesFor(p, pool);

  // Affordability vs comparable listings (needs enough comparables, see MIN_COMPARABLES)
  if (comps.count >= MIN_COMPARABLES && comps.deltaPct != null) {
    const s = Math.max(0, Math.min(100, Math.round(60 - comps.deltaPct * 2)));
    parts.push({
      key: "affordability",
      label: "Affordability",
      score: s,
      evidence: "ESTIMATE",
      reason: `Price/sq ft is ${Math.abs(comps.deltaPct).toFixed(1)}% ${comps.deltaPct >= 0 ? "above" : "below"} the average of ${comps.count} comparable listings.`,
    });
  } else {
    parts.push({
      key: "affordability",
      label: "Affordability",
      score: null,
      evidence: "UNKNOWN",
      reason:
        comps.count === 0
          ? "No comparable listings to compare against."
          : `Only ${comps.count} comparable listing(s); at least ${MIN_COMPARABLES} are needed.`,
    });
  }

  // Location: verified places within 5 km, 25 points per category covered
  const cats = new Set(
    places.filter((pl) => pl.verified && pl.distance_km != null && Number(pl.distance_km) <= 5).map((pl) => pl.category),
  );
  if (places.length === 0) {
    parts.push({ key: "location", label: "Location", score: null, evidence: "UNKNOWN", reason: "No verified nearby-place data yet." });
  } else {
    parts.push({
      key: "location",
      label: "Location",
      score: cats.size * 25,
      evidence: cats.size > 0 ? "VERIFIED" : "UNKNOWN",
      reason: `${cats.size} of 4 categories (schools, hospitals, transport, jobs) have a verified place within 5 km.`,
    });
  }

  const am = p.amenities?.length ?? 0;
  parts.push({ key: "amenities", label: "Amenities", score: Math.min(100, am * 15), evidence: "CLAIM", reason: `${am} amenities listed.` });

  // Verified risk: documents present, minus verification penalty
  const docsPresent = DOCS.length - missingDocs(p).length;
  const penalty = p.verification_status === "verified" ? 0 : p.verification_status === "partially_verified" ? 10 : 25;
  parts.push({
    key: "risk",
    label: "Documents & risk",
    score: Math.max(0, docsPresent * 20 - penalty),
    evidence: docsPresent > 0 ? "CLAIM" : "UNKNOWN",
    reason: `${docsPresent} of ${DOCS.length} key documents recorded; listing is ${p.verification_status?.replace("_", " ") ?? "unverified"}.`,
  });

  const scored = parts.filter((x) => x.score != null) as (ScorePart & { score: number })[];
  const overall = scored.length ? Math.round(scored.reduce((s, x) => s + x.score, 0) / scored.length) : null;
  return { overall, parts, comps };
}

/** Plain questions a buyer can put to the seller about price, never advice to bargain. */
export function priceQuestions(p: DealProperty, pool: DealProperty[], now = new Date()) {
  const hints: string[] = [];
  const comps = comparablesFor(p, pool);
  if (comps.count >= MIN_COMPARABLES && comps.deltaPct != null && comps.deltaPct > 5) {
    hints.push(`Ask how the asking price per sq ft was set: it is ${comps.deltaPct.toFixed(1)}% above ${comps.count} comparable listings in PropWise.`);
  }
  const missing = missingDocs(p);
  if (missing.length) hints.push(`${missing.length} key document(s) are not recorded yet — ask the seller to provide them before you commit.`);
  if (p.created_at) {
    const days = (now.getTime() - new Date(p.created_at).getTime()) / 86400000;
    if (days > 90) hints.push(`Ask how long the property has been on the market — this listing was added to PropWise ${Math.floor(days)} days ago.`);
  }
  if (p.guideline_value && Number(p.guideline_value) > Number(p.asking_price)) {
    hints.push("Guideline value is above the asking price, so duties are charged on the guideline value.");
  }
  return hints;
}
