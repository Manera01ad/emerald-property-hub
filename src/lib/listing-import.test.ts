import { describe, expect, it } from "vitest";
import { TEMPLATE_COLUMNS, parseListingCsv, templateCsv } from "./listing-import";

const head = TEMPLATE_COLUMNS.join(",");
const row = (o: Record<string, string>) => TEMPLATE_COLUMNS.map((c) => { const v = o[c] ?? ""; return /[",]/.test(v) ? `"${v}"` : v; }).join(",");
const good = { title: "3BHK villa Potheri", property_type: "villa", area: "Potheri", asking_price: "7,500,000", latitude: "12.82", longitude: "80.04", source: "Broker: Ravi", owner_consent: "yes", consent_note: "WhatsApp 12 Oct" };
const csv = (...rows: Record<string, string>[]) => [head, ...rows.map(row)].join("\n");

describe("parseListingCsv", () => {
  it("accepts a complete row as an unverified draft with permission recorded", () => {
    const r = parseListingCsv(csv(good));
    expect(r.errors).toEqual([]);
    expect(r.drafts[0]).toMatchObject({ status: "draft", verification_status: "unverified", listing_permission: true, asking_price: 7500000, location: "Potheri", availability: "ready" });
  });
  it("rejects rows without owner consent, source or map location", () => {
    const r = parseListingCsv(csv({ ...good, owner_consent: "no" }, { ...good, title: "B", source: "" }, { ...good, title: "C", latitude: "", longitude: "" }));
    expect(r.drafts).toHaveLength(0);
    expect(r.errors.map((e) => e.row)).toEqual([2, 3, 4]);
  });
  it("reads coordinates from a Google Maps link", () => {
    const r = parseListingCsv(csv({ ...good, latitude: "", longitude: "", google_maps_link: "https://www.google.com/maps/@12.9249,80.1000,17z" }));
    expect(r.drafts[0]!.latitude).toBeCloseTo(12.9249, 4);
  });
  it("rejects unknown area, bad type, tiny price and bad approvals with clear reasons", () => {
    const r = parseListingCsv(csv({ ...good, area: "Nowhere", property_type: "castle", asking_price: "500", approvals: "Magic" }));
    expect(r.errors[0]!.problems).toHaveLength(4);
  });
  it("rejects an availability that is not in the list, including inherited Object keys", () => {
    for (const bad of ["banana", "constructor", "toString", "hasOwnProperty"]) {
      const r = parseListingCsv(csv({ ...good, availability: bad }));
      expect(r.drafts).toHaveLength(0);
      expect(r.errors[0]!.problems[0]).toContain("availability must be one of");
    }
  });
  it("skips example rows and flags duplicates, including against existing listings", () => {
    const r = parseListingCsv(csv({ ...good, title: "EXAMPLE - delete" }, good, good));
    expect(r.skippedExamples).toBe(1);
    expect(r.drafts).toHaveLength(1);
    expect(r.errors[0]!.problems[0]).toContain("duplicate");
  });
  it("handles a BOM and quoted commas", () => {
    const r = parseListingCsv("﻿" + csv({ ...good, title: "Villa, near lake" }));
    expect(r.drafts[0]!.title).toBe("Villa, near lake");
  });
});

describe("templateCsv", () => {
  it("has every column and imports to nothing until the example row is replaced", () => {
    const t = templateCsv();
    expect(t.split("\n")[0]).toBe(head);
    const r = parseListingCsv(t);
    expect(r.drafts).toHaveLength(0);
    expect(r.errors).toHaveLength(0);
    expect(r.skippedExamples).toBe(1);
  });
});
