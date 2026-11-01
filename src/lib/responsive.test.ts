import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LOCATION_FILTER_GRID, SHRINKABLE_SELECT } from "@/lib/responsive";

/**
 * Regression guard for the 375px horizontal overflow on /explore (34px).
 *
 * jsdom does not compute layout, so this asserts the invariants that caused the
 * bug rather than measuring it. The overflow was reproduced and fixed in a real
 * browser; see the pull request for the before/after measurements.
 */
describe("explore location filters are mobile-safe", () => {
  it("does not size a mobile grid track from its content", () => {
    // An `auto` track takes its width from the widest item, which is what pushed
    // the row past the viewport. The three-column form is desktop-only (`sm:`).
    const mobileTracks = LOCATION_FILTER_GRID.split("sm:")[0];

    expect(mobileTracks).not.toContain("auto");
    expect(mobileTracks).toContain("grid-cols-2");
    expect(LOCATION_FILTER_GRID).toContain("sm:grid-cols-[1fr_1.4fr_auto]");
  });

  it("lets every select shrink below its intrinsic width", () => {
    expect(SHRINKABLE_SELECT).toContain("min-w-0");
  });

  it("applies both classes to the selects that overflowed", () => {
    const src = readFileSync("src/routes/explore.tsx", "utf8");

    expect(src).toContain("{LOCATION_FILTER_GRID}");
    // City, Area and Within distance — three selects, none left with a bare
    // inline class that reintroduces min-width:auto. Two use the constant
    // directly; the third composes it with the column-span classes.
    expect(src.match(/className=\{SHRINKABLE_SELECT\}/g) ?? []).toHaveLength(2);
    expect(src).toContain("${SHRINKABLE_SELECT}");
    expect(src).not.toContain('className="h-9 rounded-md border border-input bg-background px-2 text-sm"');
  });
});
