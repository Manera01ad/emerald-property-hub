import { describe, expect, it } from "vitest";
import { buildReportHtml, cellHtml, humanize, tableHtml } from "./report-html";

describe("report layout", () => {
  it("humanizes field names", () => {
    expect(humanize("preferred_locations")).toBe("Preferred locations");
    expect(humanize("monthlyRent")).toBe("Monthly rent");
  });

  it("keeps short forms upper-case and spells out units", () => {
    expect(humanize("emi")).toBe("EMI");
    expect(humanize("doc_ec_current")).toBe("Doc EC current");
    expect(humanize("stamp_duty_pct")).toBe("Stamp duty %");
    expect(humanize("price_per_sqft")).toBe("Price per sq ft");
    expect(humanize("id")).toBe("ID");
    expect(humanize("rera_registered")).toBe("RERA registered");
    expect(humanize("emiAmount")).toBe("EMI amount");
  });

  it("shows missing values as Unknown, never blank", () => {
    expect(cellHtml(null)).toContain("Unknown");
    expect(cellHtml(undefined)).toContain("Unknown");
    expect(cellHtml(Number.NaN)).toContain("Unknown");
    expect(cellHtml(true)).toBe("Yes");
    expect(cellHtml(5000000)).toBe("50,00,000");
  });

  it("renders a list of records as one table with a column per field", () => {
    const html = tableHtml([{ title: "A", asking_price: 1 }, { title: "B", location: "Tambaram" }]);
    expect(html).toContain("<th>Title</th><th>Asking price</th><th>Location</th>");
    expect(html.match(/<tr>/g)).toHaveLength(3);
  });

  it("nests records as field/value tables and escapes everything", () => {
    const html = tableHtml({ buy: { emi: 42000 }, note: "<script>x</script>" });
    expect(html).toContain('<th scope="row">Buy</th>');
    expect(html).toContain('<th scope="row">EMI</th>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("builds a printable report with no raw JSON blocks, and tolerates old reports", () => {
    const html = buildReportHtml("My report", {
      generated_at: "2026-11-02T10:00:00Z",
      requirements: { preferred_locations: ["Guduvancheri", "Tambaram"], budget_max: 6000000 },
      calculations: { emi: 41000 },
      due_diligence_questions: ["Is the EC current?"],
    });
    expect(html).not.toContain("<pre>");
    expect(html).toContain("Guduvancheri, Tambaram");
    expect(html).toContain("@media print");
    expect(html).toContain("<li>Is the EC current?</li>");
    expect(buildReportHtml("Old", null)).toContain("Questions to ask");
  });
});
