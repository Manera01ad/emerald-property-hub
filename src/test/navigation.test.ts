import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the navigation wiring that was wrong on main:
 *  - the admin dashboard had more tab panels than triggers, so one panel
 *    (commissions) could never be selected;
 *  - the public header had no explicit Buy / Rent / Lease entry.
 *
 * These read the real source, the same way public-copy.test.ts does, so they
 * fail if the wiring regresses.
 */
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("admin navigation", () => {
  const src = read("src/routes/_authenticated/admin.tsx");
  // Group entries use `value: "x"`; panels use `value="x"`. The colon/equals
  // difference is what keeps the two sets distinguishable.
  const triggers = [...src.matchAll(/value:\s*"([a-z]+)"/g)].map((m) => m[1]).sort();
  const panels = [...src.matchAll(/TabsContent value="([a-z]+)"/g)].map((m) => m[1]).sort();

  it("gives every panel a trigger and every trigger a panel", () => {
    expect(triggers).toEqual(panels);
  });

  it("keeps the commissions panel reachable", () => {
    expect(triggers).toContain("commissions");
  });

  it("groups the tabs under the five required sections", () => {
    for (const label of [
      "Properties",
      "People",
      "Intelligence",
      "Community & Work",
      "Operations",
    ]) {
      expect(src).toContain(`label: "${label}"`);
    }
  });
});

describe("public navigation", () => {
  const src = read("src/components/SiteHeader.tsx");

  it("offers Buy, Rent and Lease as links into the one search page", () => {
    for (const transaction of ["buy", "rent", "lease"]) {
      expect(src).toContain(`transaction: "${transaction}"`);
    }
    expect(src).toContain('to="/properties"');
  });

  it("links the four required public entries", () => {
    expect(src).toContain('to="/location-intelligence"');
    expect(src).toContain('to="/community"');
    expect(src).toContain('"/my"');
  });
});
