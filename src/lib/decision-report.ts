/**
 * The evidence section of a buyer decision report: flood context for each
 * locality, and for each matched sale listing its document screen and its
 * estimated total purchase cost. Every figure carries its evidence label, so a
 * downloaded report cannot present an estimate or a claim as a fact.
 *
 * Pure functions only. The caller supplies already-published rows.
 */

import { floodBrief, floodInputFromSummary, type FloodBrief } from "./flood";
import { screenDocuments, DOC_STATUS_LABELS, type DocumentScreen } from "./document-screen";
import { purchaseCost, type CostRules } from "./deal";
import type { AreaSummary } from "./area-intel";
import { EVIDENCE_LABELS, type Evidence } from "./evidence";
import type { ListingFacts } from "./verification";

export type ReportListingInput = ListingFacts & {
  id: string;
  title: string;
  location: string;
  asking_price: number;
  guideline_value: number | null;
  transaction: "buy" | "rent" | "lease";
};

export type AreaRow = { area: string; summary: unknown };

export type ReportListingEvidence = {
  id: string;
  title: string;
  location: string;
  transaction: "buy" | "rent" | "lease";
  asking_price: { value: number; evidence: Evidence };
  /** Null for rent and lease: purchase duty and registration do not apply. */
  cost: { total: number; stampDuty: number; registration: number; legal: number; basis: string; evidence: Evidence } | null;
  /** Null for rent and lease, matching the listing page. */
  documents: DocumentScreen | null;
  flood: FloodBrief;
};

export type ReportEvidence = {
  localities: { area: string; flood: FloodBrief }[];
  listings: ReportListingEvidence[];
};

const key = (s: string) => s.trim().toLowerCase();

function floodFor(area: string, areas: AreaRow[]): FloodBrief {
  const row = areas.find((a) => key(a.area) === key(area));
  return floodBrief(floodInputFromSummary(row ? (row.summary as AreaSummary) : null));
}

export function buildReportEvidence(
  listings: ReportListingInput[],
  areas: AreaRow[],
  preferredLocations: string[],
  rules: CostRules,
  today?: string,
): ReportEvidence {
  const names: string[] = [];
  for (const n of [...preferredLocations, ...listings.map((l) => l.location)]) {
    if (n && !names.some((x) => key(x) === key(n))) names.push(n);
  }
  return {
    localities: names.map((area) => ({ area, flood: floodFor(area, areas) })),
    listings: listings.map((l) => {
      const sale = l.transaction === "buy";
      const c = sale ? purchaseCost(l, rules) : null;
      return {
        id: l.id,
        title: l.title,
        location: l.location,
        transaction: l.transaction,
        asking_price: { value: Number(l.asking_price), evidence: "CLAIM" },
        cost: c
          ? {
              total: c.total, stampDuty: c.stampDuty, registration: c.registration, legal: c.legal,
              basis: `Duties on the ${c.base > Number(l.asking_price) ? "guideline value" : "asking price"}, at ${rules.stampDutyPct}% stamp duty and ${rules.registrationPct}% registration from PropWise settings.`,
              evidence: "ESTIMATE",
            }
          : null,
        documents: sale ? screenDocuments(l, today) : null,
        flood: floodFor(l.location, areas),
      };
    }),
  };
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const label = (e: Evidence | null) => (e ? ` <b>[${esc(EVIDENCE_LABELS[e])}]</b>` : "");
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function floodHtml(f: FloodBrief): string {
  return `<p><i>${esc(f.headline)}</i></p><ul>${f.facts.map((x) => `<li>${esc(x.label)}${label(x.evidence)}: ${esc(x.value ?? "Unknown")} — ${esc(x.note)}</li>`).join("")}</ul>`
    + `<p>Not known: ${f.unknowns.map(esc).join("; ")}.</p><p>Check yourself:</p><ul>${f.groundChecks.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`;
}

/** The report's evidence section as HTML, every value escaped and labelled. */
export function renderReportEvidenceHtml(e: ReportEvidence): string {
  const parts: string[] = ["<h2>Evidence: flood, documents and cost</h2>", "<p>Each figure shows its evidence label in brackets. Unknown means we hold no evidence, not that there is no problem.</p>"];
  for (const l of e.localities) parts.push(`<h3>Flood and drainage — ${esc(l.area)}</h3>${floodHtml(l.flood)}`);
  if (e.listings.length === 0) parts.push("<p><i>No matched listings, so there are no document screens or purchase costs in this report.</i></p>");
  for (const l of e.listings) {
    parts.push(`<h3>${esc(l.title)} (${esc(l.location)})</h3>`);
    parts.push(`<p>${l.transaction === "buy" ? "Asking price" : "Monthly amount"}${label(l.asking_price.evidence)}: ${inr(l.asking_price.value)}</p>`);
    if (l.cost) {
      parts.push(`<p>Estimated total purchase cost${label(l.cost.evidence)}: ${inr(l.cost.total)} (stamp duty ${inr(l.cost.stampDuty)}, registration ${inr(l.cost.registration)}, legal ${inr(l.cost.legal)}). ${esc(l.cost.basis)}</p>`);
    }
    if (l.documents) {
      parts.push(`<p><b>Documents:</b> ${esc(l.documents.headline)}</p><ul>${l.documents.checks.map((c) => `<li>${esc(c.label)} — ${esc(DOC_STATUS_LABELS[c.status])}${label(c.evidence)}: ${esc(c.note)}</li>`).join("")}</ul>`);
    }
  }
  return parts.join("\n");
}
