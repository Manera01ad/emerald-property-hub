import { describe, expect, it } from "vitest";
import { buildReportEvidence, renderReportEvidenceHtml, type ReportListingInput } from "./decision-report";
import { summariseArea } from "./area-intel";

const rules = { stampDutyPct: 7, registrationPct: 2, legalFee: 15000 };
const listing: ReportListingInput = {
  id: "p1", title: "2BHK <near lake>", location: "Guduvancheri", asking_price: 5_000_000, guideline_value: null,
  property_type: "apartment", transaction: "buy", verification_status: "unverified", doc_title_deed: true,
};
const areas = [{ area: "Guduvancheri", summary: summariseArea([], 12.845, 80.06, 39) }];

describe("decision report evidence", () => {
  it("gives flood context for preferred localities even with no listings", () => {
    const e = buildReportEvidence([], areas, ["Guduvancheri", "Tambaram"], rules);
    expect(e.localities.map((l) => l.area)).toEqual(["Guduvancheri", "Tambaram"]);
    expect(e.localities[0]?.flood.facts.find((f) => f.key === "elevation")?.evidence).toBe("ESTIMATE");
    expect(e.localities[1]?.flood.facts.every((f) => f.evidence === "UNKNOWN")).toBe(true);
    expect(renderReportEvidenceHtml(e)).toMatch(/No matched listings/);
  });

  it("labels the asking price a claim, the total cost an estimate, and screens documents", () => {
    const e = buildReportEvidence([listing], areas, ["guduvancheri"], rules, "2026-11-02");
    expect(e.localities).toHaveLength(1);
    const l = e.listings[0]!;
    expect(l.asking_price.evidence).toBe("CLAIM");
    expect(l.cost?.evidence).toBe("ESTIMATE");
    expect(l.cost?.total).toBe(5_000_000 + 350_000 + 100_000 + 15000);
    expect(l.documents?.counts.missing).toBe(4);
    expect(l.documents?.checks.find((c) => c.key === "doc_title_deed")?.evidence).toBe("CLAIM");
  });

  it("leaves out purchase cost and documents for a rental", () => {
    const l = buildReportEvidence([{ ...listing, transaction: "rent", asking_price: 20000 }], areas, [], rules).listings[0]!;
    expect(l.cost).toBeNull();
    expect(l.documents).toBeNull();
  });

  it("renders every value escaped with its evidence label", () => {
    const html = renderReportEvidenceHtml(buildReportEvidence([listing], areas, [], rules, "2026-11-02"));
    expect(html).toContain("2BHK &lt;near lake&gt;");
    expect(html).not.toContain("<near lake>");
    expect(html).toContain("[Claim]");
    expect(html).toContain("[Estimate]");
    expect(html).toContain("[Unknown]");
    expect(html).toContain("₹54,65,000");
  });
});
