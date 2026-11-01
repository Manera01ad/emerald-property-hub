import { describe, expect, it } from "vitest";
import {
  MIN_OCCURRENCES,
  areaOf,
  collectGaps,
  gapKey,
  normaliseTerm,
  priorityOf,
  subjectOf,
  summariseGaps,
  type SearchSignal,
} from "./intelligence-gaps";

const signal = (over: Partial<SearchSignal> = {}): SearchSignal => ({
  kind: "locality",
  query: { area: "guduvancheri" },
  resultCount: 0,
  createdAt: "2026-11-01T10:00:00.000Z",
  ...over,
});

describe("normaliseTerm", () => {
  it("lowercases, trims and collapses whitespace", () => {
    expect(normaliseTerm("  Guduvancheri   Main  ")).toBe("guduvancheri main");
  });

  it("returns null for non-strings and blanks", () => {
    expect(normaliseTerm(42)).toBeNull();
    expect(normaliseTerm("   ")).toBeNull();
    expect(normaliseTerm(null)).toBeNull();
    expect(normaliseTerm({ a: 1 })).toBeNull();
  });

  it("caps the length so one long query cannot become its own bucket", () => {
    expect(normaliseTerm("x".repeat(500))!.length).toBe(80);
  });
});

describe("areaOf", () => {
  it("reads whichever area key the query used", () => {
    expect(areaOf({ area: "Potheri" })).toBe("potheri");
    expect(areaOf({ location: "Chennai" })).toBe("chennai");
    expect(areaOf({ locality: "Guduvancheri" })).toBe("guduvancheri");
  });

  it("returns null when no area is named", () => {
    expect(areaOf({ property_type: "plot" })).toBeNull();
  });
});

describe("gapKey", () => {
  it("groups locality searches by area", () => {
    expect(gapKey(signal())).toBe("locality:guduvancheri");
  });

  it("groups listing searches by area and type", () => {
    expect(
      gapKey(signal({ kind: "listings", query: { location: "Potheri", property_type: "plot" } })),
    ).toBe("listings:potheri:plot");
  });

  it("still groups a listing search that named only a type", () => {
    expect(gapKey(signal({ kind: "listings", query: { property_type: "villa" } }))).toBe(
      "listings:any:villa",
    );
  });

  it("groups web searches by their text", () => {
    expect(gapKey(signal({ kind: "web", query: { query: "Metro Phase 2" } }))).toBe(
      "web:metro phase 2",
    );
  });

  it("returns null when there is nothing to group on", () => {
    expect(gapKey(signal({ kind: "locality", query: {} }))).toBeNull();
    expect(gapKey(signal({ kind: "listings", query: {} }))).toBeNull();
    expect(gapKey(signal({ kind: "web", query: {} }))).toBeNull();
    expect(gapKey(signal({ kind: "listing", query: { id: "abc" } }))).toBeNull();
  });
});

describe("subjectOf", () => {
  it("describes a locality search without naming a person", () => {
    expect(subjectOf(signal())).toBe("Locality evidence: guduvancheri");
  });

  it("describes a listing search", () => {
    expect(
      subjectOf(
        signal({ kind: "listings", query: { location: "potheri", property_type: "plot" } }),
      ),
    ).toBe("Listings: plot in potheri");
  });

  it("falls back to a readable phrase rather than a blank", () => {
    expect(subjectOf(signal({ kind: "locality", query: {} }))).toBe(
      "Locality evidence: unnamed area",
    );
  });
});

describe("priorityOf", () => {
  it("scores a single empty result above a single answered one", () => {
    expect(priorityOf({ occurrences: 1, emptyResults: 1 })).toBeGreaterThan(
      priorityOf({ occurrences: 1, emptyResults: 0 }),
    );
  });

  it("scores more occurrences higher", () => {
    expect(priorityOf({ occurrences: 8, emptyResults: 0 })).toBeGreaterThan(
      priorityOf({ occurrences: 2, emptyResults: 0 }),
    );
  });

  it("never exceeds 100 or drops below 0", () => {
    expect(priorityOf({ occurrences: 1000, emptyResults: 1000 })).toBe(100);
    expect(priorityOf({ occurrences: 0, emptyResults: 0 })).toBe(0);
  });

  it("gives an often-searched, never-answered gap the maximum", () => {
    expect(priorityOf({ occurrences: 10, emptyResults: 10 })).toBe(100);
  });

  it("does not divide by zero when occurrences is 0", () => {
    expect(Number.isFinite(priorityOf({ occurrences: 0, emptyResults: 0 }))).toBe(true);
  });
});

describe("collectGaps", () => {
  it("returns nothing for no signals", () => {
    expect(collectGaps([])).toEqual([]);
  });

  it("groups repeated searches into one gap with counted evidence", () => {
    const gaps = collectGaps([
      signal(),
      signal({ createdAt: "2026-11-01T11:00:00.000Z" }),
      signal({ resultCount: 4, createdAt: "2026-11-01T12:00:00.000Z" }),
    ]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.evidence.occurrences).toBe(3);
    expect(gaps[0]!.evidence.emptyResults).toBe(2);
    expect(gaps[0]!.evidence.firstSeen).toBe("2026-11-01T10:00:00.000Z");
    expect(gaps[0]!.evidence.lastSeen).toBe("2026-11-01T12:00:00.000Z");
  });

  it("shows a gap that returned nothing even once", () => {
    const gaps = collectGaps([signal()]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.needsMoreEvidence).toBe(true);
  });

  it("hides a one-off search that was answered", () => {
    expect(collectGaps([signal({ resultCount: 7 })])).toEqual([]);
  });

  it("shows an answered search once it keeps recurring", () => {
    const signals = Array.from({ length: MIN_OCCURRENCES }, () => signal({ resultCount: 7 }));
    const gaps = collectGaps(signals);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.needsMoreEvidence).toBe(false);
  });

  it("skips signals with nothing to group on instead of lumping them together", () => {
    expect(collectGaps([signal({ kind: "locality", query: {} })])).toEqual([]);
  });

  it("sorts the strongest gap first", () => {
    const weak = signal({ query: { area: "chennai" }, resultCount: 5 });
    const strong = Array.from({ length: 6 }, () => signal({ query: { area: "potheri" } }));
    const gaps = collectGaps([weak, ...strong]);
    expect(gaps[0]!.area).toBe("potheri");
  });

  it("is stable between reads when priorities are equal", () => {
    const a = signal({ query: { area: "aaa" } });
    const b = signal({ query: { area: "bbb" } });
    expect(collectGaps([b, a]).map((g) => g.key)).toEqual(collectGaps([a, b]).map((g) => g.key));
  });

  it("records which kinds of search surfaced the gap", () => {
    const gaps = collectGaps([
      signal({ kind: "locality", query: { area: "potheri" } }),
      signal({ kind: "listings", query: { location: "potheri" } }),
    ]);
    expect(gaps).toHaveLength(2);
  });

  it("never carries a user identifier into the output", () => {
    // The gap is aggregated demand, not a person's history. A user_id on the way
    // in must not reach the panel.
    const withUser = {
      ...signal(),
      user_id: "11111111-1111-1111-1111-111111111111",
    } as SearchSignal;
    const gaps = collectGaps([withUser]);
    const serialised = JSON.stringify(gaps);
    expect(serialised).not.toContain("11111111");
    expect(serialised).not.toContain("user_id");
  });

  it("proposes a solution that mentions the area", () => {
    const gaps = collectGaps([signal()]);
    expect(gaps[0]!.proposedSolution).toMatch(/guduvancheri/i);
  });
});

describe("summariseGaps", () => {
  it("says so when there is nothing", () => {
    expect(summariseGaps([])).toBe("No gaps recorded yet.");
  });

  it("counts the gaps and how many found nothing", () => {
    const gaps = collectGaps([signal(), signal({ query: { area: "potheri" } })]);
    expect(summariseGaps(gaps)).toMatch(/2 gaps recorded/);
    expect(summariseGaps(gaps)).toMatch(/2 of which returned no results/);
  });

  it("uses the singular for one gap", () => {
    expect(summariseGaps(collectGaps([signal()]))).toMatch(/1 gap recorded/);
  });
});
