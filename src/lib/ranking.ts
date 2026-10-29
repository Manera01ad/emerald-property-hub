import type { Evidence } from "./evidence";
import { transactionTypeOf, type TransactionType } from "./transaction";

/**
 * Locality ranking for the admin panel (Phase 1 W3-3, plan section F3).
 *
 * Every component is an evidence count, never a judgement about a market. A component
 * below its evidence floor is UNKNOWN: the panel shows the gap instead of a low score,
 * because "we have not seen enough" and "the area is weak" are different claims.
 *
 * No figure here is shown to buyers.
 */

export const MIN_DEMAND_EVIDENCE = 10;
export const MIN_PRICE_EVIDENCE = 5;

export type ComponentKey = "D" | "S" | "P" | "I";

export type RankingComponent = {
  key: ComponentKey;
  label: string;
  /** 0–100, or null when the evidence floor is not met. */
  score: number | null;
  evidence: Evidence;
  note: string;
};

export type RankingInputs = {
  locality: string;
  publishedListings: number;
  priceComparables: number;
  interestRequests: number;
  publishedInfrastructure: number;
  verifiedInfrastructure: number;
  hasAreaSnapshot: boolean;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * D — demand. Recorded interest requests in this locality. We hold no portal traffic or
 * search-volume data, so this is the only demand signal we can stand behind.
 */
export function demandComponent(interestRequests: number): RankingComponent {
  if (interestRequests < MIN_DEMAND_EVIDENCE) {
    return {
      key: "D",
      label: "Demand (recorded interest)",
      score: null,
      evidence: "UNKNOWN",
      note: `${interestRequests} recorded interest request(s). At least ${MIN_DEMAND_EVIDENCE} are needed before demand can be read.`,
    };
  }
  // 10 requests = 50, 20 or more = 100. A straight reading of our own records, not a forecast.
  return {
    key: "D",
    label: "Demand (recorded interest)",
    score: clamp((interestRequests / 20) * 100),
    evidence: "CLAIM",
    note: `${interestRequests} recorded interest requests. These are buyer statements of interest, not confirmed transactions.`,
  };
}

/** S — supply. Published listings in the locality. */
export function supplyComponent(publishedListings: number): RankingComponent {
  if (publishedListings === 0) {
    return { key: "S", label: "Supply (published listings)", score: null, evidence: "UNKNOWN", note: "No published listings in this locality yet." };
  }
  return {
    key: "S",
    label: "Supply (published listings)",
    score: clamp((publishedListings / 10) * 100),
    evidence: "VERIFIED",
    note: `${publishedListings} published listing(s), each with recorded owner or developer permission.`,
  };
}

/** P — price evidence. Asking-price comparables; below the floor no figure is meaningful. */
export function priceComponent(priceComparables: number): RankingComponent {
  if (priceComparables < MIN_PRICE_EVIDENCE) {
    return {
      key: "P",
      label: "Price evidence",
      score: null,
      evidence: "UNKNOWN",
      note: `${priceComparables} listing(s) with a usable area. At least ${MIN_PRICE_EVIDENCE} are needed for a price context.`,
    };
  }
  return {
    key: "P",
    label: "Price evidence",
    score: clamp((priceComparables / 15) * 100),
    evidence: "ESTIMATE",
    note: `${priceComparables} asking-price comparables. Asking prices are seller claims, not confirmed sale prices.`,
  };
}

/** I — infrastructure evidence. Published projects, weighted by whether we confirmed progress. */
export function infrastructureComponent(published: number, verified: number): RankingComponent {
  if (published === 0) {
    return { key: "I", label: "Infrastructure evidence", score: null, evidence: "UNKNOWN", note: "No published infrastructure project is recorded for this locality." };
  }
  const confirmed = Math.min(verified, published);
  return {
    key: "I",
    label: "Infrastructure evidence",
    score: clamp((confirmed / published) * 100),
    evidence: confirmed > 0 ? "VERIFIED" : "CLAIM",
    note: `${published} published project(s), ${confirmed} with progress we have confirmed. Unconfirmed progress is a claim by the source.`,
  };
}

export type RiskFlag = { flagged: boolean; reasons: string[] };

/**
 * Risk flag. Only things we can see: thin evidence and unconfirmed progress.
 * A flag means "do not read this locality as settled", not "this area is bad".
 */
export function riskFlag(inputs: RankingInputs): RiskFlag {
  const reasons: string[] = [];
  if (inputs.priceComparables < MIN_PRICE_EVIDENCE) reasons.push(`Fewer than ${MIN_PRICE_EVIDENCE} price comparables.`);
  if (inputs.interestRequests < MIN_DEMAND_EVIDENCE) reasons.push(`Fewer than ${MIN_DEMAND_EVIDENCE} recorded interest requests.`);
  if (!inputs.hasAreaSnapshot) reasons.push("No published area snapshot, so the surroundings have not been checked.");
  if (inputs.publishedInfrastructure > inputs.verifiedInfrastructure) {
    reasons.push(`${inputs.publishedInfrastructure - inputs.verifiedInfrastructure} infrastructure project(s) carry unconfirmed progress.`);
  }
  return { flagged: reasons.length > 0, reasons };
}

export type DataQuality = { known: number; total: number; evidence: Evidence; note: string };

/** Q — how much of the ranking is actually backed by evidence. */
export function dataQuality(components: RankingComponent[]): DataQuality {
  const known = components.filter((c) => c.score != null).length;
  const total = components.length;
  const evidence: Evidence = total === 0 || known === 0 ? "UNKNOWN" : known === total ? "ESTIMATE" : "UNKNOWN";
  return {
    known,
    total,
    evidence,
    note: `${known} of ${total} components meet their evidence floor. Anything below its floor is unknown, not zero.`,
  };
}

export type LocalityRanking = {
  locality: string;
  components: RankingComponent[];
  risk: RiskFlag;
  quality: DataQuality;
};

export function rankLocality(inputs: RankingInputs): LocalityRanking {
  const components = [
    demandComponent(inputs.interestRequests),
    supplyComponent(inputs.publishedListings),
    priceComponent(inputs.priceComparables),
    infrastructureComponent(inputs.publishedInfrastructure, inputs.verifiedInfrastructure),
  ];
  return { locality: inputs.locality, components, risk: riskFlag(inputs), quality: dataQuality(components) };
}

/** Structural row shapes, so this stays pure and testable without the generated database types. */
export type RankingRows = {
  properties: ReadonlyArray<{ id: string; location: string | null; asking_price: number | null; built_area_sqft: number | null; land_area_sqft: number | null; transaction_type?: string | null }>;
  interestPropertyIds: ReadonlyArray<string>;
  projects: ReadonlyArray<{ location: string | null; verified: boolean }>;
  snapshotAreas: ReadonlyArray<string>;
};

function hasUsableArea(p: { built_area_sqft: number | null; land_area_sqft: number | null }): boolean {
  return Number(p.built_area_sqft) > 0 || Number(p.land_area_sqft) > 0;
}

/**
 * Gathers one locality's inputs from already-fetched rows. Callers pass published listings,
 * interest-type enquiries, published projects and published snapshot areas; anything else
 * would quietly inflate the evidence counts.
 *
 * A ranking is for one transaction type. Sale and rent are different markets, so counting
 * them in one figure would describe neither. Defaults to sale, matching the column default.
 */
export function rankingInputsFor(locality: string, rows: RankingRows, type: TransactionType = "buy"): RankingInputs {
  const listings = rows.properties.filter((p) => p.location === locality && transactionTypeOf(p) === type);
  const ids = new Set(listings.map((p) => p.id));
  const projects = rows.projects.filter((p) => p.location === locality);
  return {
    locality,
    publishedListings: listings.length,
    priceComparables: listings.filter(hasUsableArea).length,
    interestRequests: rows.interestPropertyIds.filter((id) => ids.has(id)).length,
    publishedInfrastructure: projects.length,
    verifiedInfrastructure: projects.filter((p) => p.verified).length,
    hasAreaSnapshot: rows.snapshotAreas.includes(locality),
  };
}
