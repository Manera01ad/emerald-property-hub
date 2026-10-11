/**
 * Transparent valuation engine. Pure functions only.
 * Produces an estimated RANGE with assumptions and confidence — never a guaranteed sale value.
 * Comparables must be supplied as real evidence; nothing is invented.
 */

export type Kind = "plot" | "independent_house" | "apartment" | "villa" | "resale_home" | "rental";

export type Evidence = {
  /** Asking price (or monthly rent for rentals) of a comparable advertisement. */
  price: number;
  area_sqft: number;
  kind: "asking" | "transaction";
  source?: string;
};

export type ValuationInput = {
  kind: Kind;
  area_sqft: number; // land area for plots, built-up area otherwise
  land_area_sqft?: number | null;
  guideline_value_per_sqft?: number | null;
  building_age_years?: number | null;
  construction_rate_per_sqft?: number | null; // replacement cost for houses
  comparables: Evidence[];
  adjustments?: { label: string; pct: number }[];
};

export type Confidence = "low" | "medium" | "high" | "insufficient";

export type Valuation = {
  low: number | null;
  mid: number | null;
  high: number | null;
  perSqft: number | null;
  confidence: Confidence;
  method: string;
  assumptions: string[];
  warnings: string[];
};

/** Asking prices typically exceed achieved prices; we discount asking evidence by this much. */
export const ASKING_DISCOUNT_PCT = 5;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return (s.length % 2 ? s[m] : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2) ?? 0;
}

export function comparableRate(comps: Evidence[]) {
  const valid = comps.filter((c) => c.price > 0 && c.area_sqft > 0);
  if (!valid.length) return null;
  const rates = valid.map((c) => (c.price / c.area_sqft) * (c.kind === "asking" ? 1 - ASKING_DISCOUNT_PCT / 100 : 1));
  const min = Math.min(...rates), max = Math.max(...rates);
  return { median: median(rates), min, max, count: valid.length, transactions: valid.filter((c) => c.kind === "transaction").length };
}

export function confidenceFor(count: number, transactions: number, spreadPct: number): Confidence {
  if (count < 2) return "insufficient";
  if (count >= 5 && transactions >= 2 && spreadPct <= 25) return "high";
  if (count >= 3 && spreadPct <= 40) return "medium";
  return "low";
}

export function valueProperty(i: ValuationInput): Valuation {
  const assumptions: string[] = [];
  const warnings: string[] = [];
  const isRental = i.kind === "rental";
  if (!(i.area_sqft > 0)) {
    return { low: null, mid: null, high: null, perSqft: null, confidence: "insufficient", method: "None", assumptions, warnings: ["Area is required to estimate value."] };
  }
  const rate = comparableRate(i.comparables);
  const adjPct = (i.adjustments ?? []).reduce((s, a) => s + a.pct, 0);
  (i.adjustments ?? []).forEach((a) => assumptions.push(`Adjustment "${a.label}": ${a.pct > 0 ? "+" : ""}${a.pct}%`));
  if (rate && rate.count > rate.transactions) assumptions.push(`Asking prices discounted ${ASKING_DISCOUNT_PCT}% as they usually exceed achieved prices.`);

  let perSqft: number | null = null;
  let method = "";
  if (rate && rate.count >= 2) {
    perSqft = rate.median * (1 + adjPct / 100);
    method = `Median of ${rate.count} comparable${isRental ? " rents" : "s"} per sq ft`;
  }

  // Houses: cross-check with land + depreciated building (cost approach).
  const isHouse = i.kind === "independent_house" || i.kind === "villa" || i.kind === "resale_home";
  let costValue: number | null = null;
  if (isHouse && i.guideline_value_per_sqft && i.land_area_sqft && i.construction_rate_per_sqft) {
    const age = i.building_age_years ?? 0;
    const dep = Math.min(0.7, age * 0.015); // 1.5% per year, capped at 70%
    costValue = i.land_area_sqft * i.guideline_value_per_sqft + i.area_sqft * i.construction_rate_per_sqft * (1 - dep);
    assumptions.push(`Cost approach: land at guideline value + building at ₹${i.construction_rate_per_sqft}/sq ft less ${Math.round(dep * 100)}% depreciation.`);
  }

  if (perSqft == null && costValue == null) {
    if (i.guideline_value_per_sqft && !isRental) {
      warnings.push("No comparables: guideline value shown as a floor reference only, not a market value.");
      const g = i.guideline_value_per_sqft * i.area_sqft;
      return { low: g, mid: null, high: null, perSqft: i.guideline_value_per_sqft, confidence: "insufficient", method: "Guideline value reference", assumptions, warnings };
    }
    return { low: null, mid: null, high: null, perSqft: null, confidence: "insufficient", method: "None", assumptions, warnings: ["At least 2 real comparables are needed for an estimate."] };
  }

  let mid: number;
  if (perSqft != null && costValue != null) { mid = (perSqft * i.area_sqft + costValue) / 2; method += " blended with cost approach"; }
  else if (perSqft != null) mid = perSqft * i.area_sqft;
  else { mid = costValue as number; method = "Cost approach only"; warnings.push("No comparables: estimate relies on cost assumptions only."); }

  const spreadPct = rate ? ((rate.max - rate.min) / rate.median) * 100 : 100;
  const confidence = rate ? confidenceFor(rate.count, rate.transactions, spreadPct) : "low";
  const band = confidence === "high" ? 0.07 : confidence === "medium" ? 0.12 : 0.2;
  if (i.guideline_value_per_sqft && !isRental && mid < i.guideline_value_per_sqft * i.area_sqft)
    warnings.push("Estimate is below the guideline value — stamp duty is charged on the higher guideline value.");
  if (rate && rate.transactions === 0) warnings.push("Based on asking prices only; no registered transactions supplied.");
  return { low: mid * (1 - band), mid, high: mid * (1 + band), perSqft: mid / i.area_sqft, confidence, method, assumptions, warnings };
}

/** Evidence agent: flags gaps. Never certifies title or approvals. */
export function evidenceFlags(p: {
  property_type: string; survey_number?: string | null; approvals?: string[] | null; rera_number?: string | null;
  land_area_sqft?: number | null; built_area_sqft?: number | null; doc_patta?: boolean; doc_approved_plan?: boolean;
  verification_status?: string; source?: string | null;
}) {
  const f: string[] = [];
  if (!p.survey_number) f.push("Survey number not recorded");
  if (!p.approvals?.length) f.push("No layout/building approval claimed");
  if (p.property_type === "plot" && !p.land_area_sqft) f.push("Plot measurement missing");
  if (p.property_type !== "plot" && !p.built_area_sqft) f.push("Built-up area missing");
  if (p.built_area_sqft && p.land_area_sqft && p.property_type !== "apartment" && Number(p.built_area_sqft) > Number(p.land_area_sqft) * 3)
    f.push("Built-up area looks inconsistent with land area");
  if (p.approvals?.includes("RERA") && !p.rera_number) f.push("RERA claimed but no registration number given");
  if (!p.doc_patta) f.push("Patta not seen");
  if (!p.doc_approved_plan) f.push("Approved plan not seen");
  if (!p.source) f.push("Information source not recorded");
  f.push("Access road width and land classification not checked");
  return f;
}
