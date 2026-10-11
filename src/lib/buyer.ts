import { purchaseCost, pricePerSqft, type CostRules } from "./deal";
import type { Property } from "./data";

/** Monthly EMI for a reducing-balance loan. 0% interest divides evenly. */
export function emi(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const n = Math.round(years * 12);
  const r = annualRatePct / 1200;
  if (r === 0) return principal / n;
  return (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
}

export type BuyInputs = {
  price: number; guidelineValue?: number; otherCosts: number;
  downPayment: number; ratePct: number; years: number; budget?: number | undefined;
};

export function buyAnalysis(i: BuyInputs, rules: CostRules) {
  const c = purchaseCost({ asking_price: i.price, guideline_value: i.guidelineValue ?? null }, rules);
  const total = c.total + i.otherCosts;
  const loan = Math.max(0, i.price - i.downPayment);
  const monthly = emi(loan, i.ratePct, i.years);
  const totalInterest = monthly * i.years * 12 - loan;
  return {
    stampDuty: c.stampDuty, registration: c.registration, legal: c.legal, otherCosts: i.otherCosts,
    total, loan, emi: monthly, totalInterest: Math.max(0, totalInterest),
    upfrontCash: total - loan,
    budgetDiff: i.budget != null ? i.budget - total : null,
  };
}

export type RentInputs = {
  rent: number; deposit: number; brokerage: number; maintenance: number;
  moving: number; renewalIncreasePct: number;
};

export function rentAnalysis(i: RentInputs) {
  const firstYear = i.rent * 12 + i.maintenance * 12 + i.brokerage + i.moving;
  const secondYearRent = i.rent * (1 + i.renewalIncreasePct / 100);
  return { firstYearOutflow: firstYear, refundableDeposit: i.deposit, cashNeededUpfront: i.deposit + i.brokerage + i.moving + i.rent, secondYearMonthlyRent: secondYearRent };
}

/** Cash paid over `years` (no appreciation or investment returns assumed). */
export function rentVsBuy(buy: ReturnType<typeof buyAnalysis>, rent: RentInputs, years: number) {
  let rentPaid = rent.brokerage + rent.moving;
  for (let y = 0; y < years; y++) rentPaid += (rent.rent * (1 + rent.renewalIncreasePct / 100) ** y + rent.maintenance) * 12;
  const months = Math.min(years * 12, Infinity);
  const buyPaid = buy.upfrontCash + buy.emi * months;
  return { years, rentPaid, buyPaid, difference: buyPaid - rentPaid };
}

export type Preferences = {
  intent: string; property_types: string[]; budget: number | null;
  preferred_locations: string[]; bedrooms: number | null; min_area_sqft: number | null;
};

export type MatchPart = { label: string; score: number | null; note: string };

/** Explainable match: each part 0–100 or null when data is missing. */
export function matchProperty(p: Property, pref: Preferences, rules: CostRules) {
  const parts: MatchPart[] = [];
  const missing: string[] = [];
  const concerns: string[] = [];
  const total = purchaseCost(p, rules).total;
  if (pref.budget) {
    const ratio = total / pref.budget;
    parts.push({ label: "Budget fit", score: ratio <= 1 ? 100 : Math.max(0, Math.round(100 - (ratio - 1) * 300)), note: `Estimated all-in ₹${Math.round(total).toLocaleString("en-IN")} vs budget ₹${pref.budget.toLocaleString("en-IN")}` });
    if (ratio > 1) concerns.push("Estimated total cost exceeds your budget.");
  } else parts.push({ label: "Budget fit", score: null, note: "No budget set" });
  if (pref.preferred_locations.length) {
    const ok = pref.preferred_locations.includes(p.location);
    parts.push({ label: "Location fit", score: ok ? 100 : 0, note: ok ? `In ${p.location}` : `${p.location} isn't one of your locations` });
  } else parts.push({ label: "Location fit", score: null, note: "No preferred locations set" });
  if (pref.property_types.length) {
    const ok = pref.property_types.includes(p.property_type);
    parts.push({ label: "Property type", score: ok ? 100 : 0, note: ok ? "Matches your type" : "Different type" });
  }
  if (pref.bedrooms != null) {
    if (p.bedrooms == null) { missing.push("Bedrooms"); parts.push({ label: "Bedrooms", score: null, note: "Not stated" }); }
    else parts.push({ label: "Bedrooms", score: p.bedrooms >= pref.bedrooms ? 100 : 30, note: `${p.bedrooms} vs ${pref.bedrooms} wanted` });
  }
  if (pref.min_area_sqft) {
    const a = Number(p.built_area_sqft ?? p.land_area_sqft) || 0;
    if (!a) missing.push("Area");
    parts.push({ label: "Space", score: a ? (a >= pref.min_area_sqft ? 100 : Math.round((a / pref.min_area_sqft) * 100)) : null, note: a ? `${a} sq ft` : "Area not stated" });
  }
  if (!pricePerSqft(p)) missing.push("Price per sq ft (no area)");
  if (p.verification_status !== "verified") concerns.push(`Listing is ${p.verification_status.replace("_", " ")} — documents not independently checked.`);
  const scored = parts.filter((x) => x.score != null) as (MatchPart & { score: number })[];
  const overall = scored.length ? Math.round(scored.reduce((s, x) => s + x.score, 0) / scored.length) : null;
  return { overall, parts, missing, concerns, estimatedTotal: total };
}

export const DUE_DILIGENCE_QUESTIONS = [
  "Can the seller share the title deed chain and an encumbrance certificate for at least 30 years?",
  "Is the patta in the seller's name and does the survey number match the documents?",
  "Which authority approved the layout/building plan (DTCP, CMDA or local body), and can you see the approval?",
  "Is the project registered with TNRERA where registration is required?",
  "Are there pending dues: property tax, water, electricity or maintenance?",
  "Will an independent lawyer review the documents before any advance is paid?",
];
