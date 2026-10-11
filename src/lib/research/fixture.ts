/**
 * TEST FIXTURE — fictional listings used only to exercise the research engine.
 * Not real inventory. Variant "b" simulates a later check: one price cut, one rise,
 * one listing removed and one new listing.
 */
export function fixtureListings(variant: string) {
  const a = [
    { id: "FX-001", title: "TEST FIXTURE 3BHK Villa", type: "villa", locality: "Guduvancheri", price: 8400000, built_area_sqft: 1660, land_area_sqft: 1200, bedrooms: 3, url: "https://example.invalid/fixture/FX-001", approvals: ["DTCP (claimed)"], listed_at: "2026-09-01" },
    { id: "FX-002", title: "TEST FIXTURE 2BHK Apartment", type: "Flat", locality: "Potheri", price: "52,00,000", built_area_sqft: 1000, bedrooms: 2, url: "https://example.invalid/fixture/FX-002", rera: "TN/FIXTURE/0002", listed_at: "2026-09-10" },
    { id: "FX-003", title: "TEST FIXTURE 2BHK Apartment B", type: "apartment", locality: "Potheri", price: 4800000, built_area_sqft: 980, bedrooms: 2, url: "https://example.invalid/fixture/FX-003", rera: "TN/FIXTURE/0003" },
    { id: "FX-004", title: "TEST FIXTURE 2BHK Apartment C", type: "apartment", locality: "Potheri", price: 5600000, built_area_sqft: 1100, bedrooms: 2, url: "https://example.invalid/fixture/FX-004" },
    { id: "FX-005", title: "TEST FIXTURE Plot (no price)", type: "plot", locality: "Tambaram", land_area_sqft: 1200, url: "https://example.invalid/fixture/FX-005" },
    { id: "FX-006", title: "TEST FIXTURE 2BHK Apartment B (repost)", type: "apartment", locality: "Potheri", price: 4850000, built_area_sqft: 985, bedrooms: 2, url: "https://example.invalid/fixture/FX-006" },
    { title: "Item without an id is ignored" },
  ];
  if (variant !== "b") return a;
  return [
    ...a.filter((x) => x.id !== "FX-004").map((x) => (x.id === "FX-002" ? { ...x, price: 4950000, updated_at: "2026-10-05" } : x.id === "FX-003" ? { ...x, price: 5000000 } : x)),
    { id: "FX-007", title: "TEST FIXTURE Independent House", type: "independent house", locality: "Tambaram", price: 9900000, built_area_sqft: 1800, land_area_sqft: 1500, bedrooms: 3, url: "https://example.invalid/fixture/FX-007" },
  ];
}
