import { describe, expect, it } from "vitest";
import { buildLogRow, cleanQuery, cleanSources, describeSearch } from "./search-log";

describe("search log helpers", () => {
  it("keeps only simple values and truncates long strings", () => {
    const q = cleanQuery({ location: "x".repeat(500), max_price: 8000000, nested: { a: 1 }, list: [1], flag: true });
    expect((q["location"] as string).length).toBe(200);
    expect(q["max_price"]).toBe(8000000);
    expect(q["flag"]).toBe(true);
    expect(q).not.toHaveProperty("nested");
    expect(q).not.toHaveProperty("list");
  });

  it("returns an empty query for non-objects", () => {
    expect(cleanQuery(null)).toEqual({});
    expect(cleanQuery("text")).toEqual({});
    expect(cleanQuery([1, 2])).toEqual({});
  });

  it("drops non-http links and entries with neither url nor id", () => {
    const out = cleanSources([
      { title: "ok", url: "https://example.com/a" },
      { title: "bad", url: "javascript:alert(1)" },
      { title: "nothing" },
      { id: "abc" },
    ]);
    expect(out).toEqual([{ title: "ok", url: "https://example.com/a" }, { id: "abc" }]);
  });

  it("caps the number of sources", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ url: `https://example.com/${i}` }));
    expect(cleanSources(many)).toHaveLength(20);
  });

  it("builds a row with a non-negative integer count", () => {
    const row = buildLogRow({ userId: "u", messageId: "m", kind: "listings", input: { location: "Tambaram" }, resultCount: -3.7, sources: [] });
    expect(row.result_count).toBe(0);
    expect(row.query).toEqual({ location: "Tambaram" });
  });

  it("describes searches in one readable line", () => {
    expect(describeSearch({ kind: "listings", query: { location: "Velachery", max_price: 8000000 } })).toBe("Listings: Velachery, up to ₹80,00,000");
    expect(describeSearch({ kind: "listings", query: {} })).toBe("Listings: all public listings");
    expect(describeSearch({ kind: "web", query: { query: "OMR metro" } })).toBe("Web: OMR metro");
    expect(describeSearch({ kind: "listing", query: {} })).toBe("Opened one listing");
  });
});
