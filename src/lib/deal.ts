import { DOCS } from "./constants";

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

/** Comparables: same location and type, excluding self, with a usable area. */
export function comparablesFor(p: DealProperty, pool: DealProperty[]) {
  const comps = pool.filter(
    (c) => c.id !== p.id && c.location === p.location && c.property_type === p.property_type && pricePerSqft(c) != null,
  );
  if (comps.length === 0) return { count: 0, avgPpsf: null as number | null, deltaPct: null as number | null };
  const avg = comps.reduce((s, c) => s + (pricePerSqft(c) as number), 0) / comps.length;
  const own = pricePerSqft(p);
  return { count: comps.length, avgPpsf: avg, deltaPct: own != null ? ((own - avg) / avg) * 100 : null };
}

export function missingDocs(p: DealProperty) {
  return DOCS.filter((d) => !p[d.key as keyof DealProperty]).map((d) => d.label);
}

export type ScorePart = { key: string; label: string; score: number | null; reason: string };

export function dealScore(p: DealProperty, pool: DealProperty[], places: NearbyPlace[]) {
  const parts: ScorePart[] = [];
  const comps = comparablesFor(p, pool);

  // Affordability vs comparable listings (needs at least 2 comparables)
  if (comps.count >= 2 && comps.deltaPct != null) {
    const s = Math.max(0, Math.min(100, Math.round(60 - comps.deltaPct * 2)));
    parts.push({
      key: "affordability",
      label: "Affordability",
      score: s,
      reason: `Price/sq ft is ${Math.abs(comps.deltaPct).toFixed(1)}% ${comps.deltaPct >= 0 ? "above" : "below"} the average of ${comps.count} comparable listings.`,
    });
  } else {
    parts.push({ key: "affordability", label: "Affordability", score: null, reason: "Not enough comparable listings to assess." });
  }

  // Location: verified places within 5 km, 25 points per category covered
  const cats = new Set(
    places.filter((pl) => pl.verified && pl.distance_km != null && Number(pl.distance_km) <= 5).map((pl) => pl.category),
  );
  if (places.length === 0) {
    parts.push({ key: "location", label: "Location", score: null, reason: "No verified nearby-place data yet." });
  } else {
    parts.push({
      key: "location",
      label: "Location",
      score: cats.size * 25,
      reason: `${cats.size} of 4 categories (schools, hospitals, transport, jobs) have a verified place within 5 km.`,
    });
  }

  const am = p.amenities?.length ?? 0;
  parts.push({ key: "amenities", label: "Amenities", score: Math.min(100, am * 15), reason: `${am} amenities listed.` });

  // Verified risk: documents present, minus verification penalty
  const docsPresent = DOCS.length - missingDocs(p).length;
  const penalty = p.verification_status === "verified" ? 0 : p.verification_status === "partially_verified" ? 10 : 25;
  parts.push({
    key: "risk",
    label: "Documents & risk",
    score: Math.max(0, docsPresent * 20 - penalty),
    reason: `${docsPresent} of ${DOCS.length} key documents recorded; listing is ${p.verification_status?.replace("_", " ") ?? "unverified"}.`,
  });

  const scored = parts.filter((x) => x.score != null) as (ScorePart & { score: number })[];
  const overall = scored.length ? Math.round(scored.reduce((s, x) => s + x.score, 0) / scored.length) : null;
  return { overall, parts, comps };
}

export function negotiationHints(p: DealProperty, pool: DealProperty[], now = new Date()) {
  const hints: string[] = [];
  const comps = comparablesFor(p, pool);
  if (comps.count >= 2 && comps.deltaPct != null && comps.deltaPct > 5) {
    hints.push(`Asking price/sq ft is ${comps.deltaPct.toFixed(1)}% above ${comps.count} comparable listings — worth raising.`);
  }
  const missing = missingDocs(p);
  if (missing.length) hints.push(`${missing.length} key document(s) not yet recorded — ask the seller to provide them before committing.`);
  if (p.created_at) {
    const days = (now.getTime() - new Date(p.created_at).getTime()) / 86400000;
    if (days > 90) hints.push(`Listed on PropWise for ${Math.floor(days)} days — sellers may be open to discussion.`);
  }
  if (p.guideline_value && Number(p.guideline_value) > Number(p.asking_price)) {
    hints.push("Guideline value is above the asking price, so duties are charged on the guideline value.");
  }
  return hints;
}
