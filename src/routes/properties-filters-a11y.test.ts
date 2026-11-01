import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Regression guard for unlabelled filter controls on /properties.
 *
 * The filter sidebar used `<Label>` with no `htmlFor` and inputs with no id, so
 * six controls reached assistive tech with an empty accessible name (confirmed
 * via the Chrome accessibility tree: 4 comboboxes, 2 spinbuttons). Wrapping the
 * input in the label is not enough here — the label sits in a sibling div — so
 * the association has to be explicit.
 *
 * This is a static check: it reads the source rather than rendering it, because
 * jsdom does not build an accessibility tree.
 */
describe("properties filter controls are labelled", () => {
  const src = readFileSync("src/routes/properties.index.tsx", "utf8");

  it("gives every Label an htmlFor", () => {
    const labels = src.match(/<Label(?![A-Za-z])[^>]*>/g) ?? [];
    expect(labels.length).toBeGreaterThan(0);

    const withoutFor = labels.filter((l) => !l.includes("htmlFor="));
    expect(withoutFor).toEqual([]);
  });

  it("points every htmlFor at an id that exists in the file", () => {
    const targets = [...src.matchAll(/htmlFor="([^"]+)"/g)].map((m) => m[1]);
    expect(targets.length).toBeGreaterThan(0);

    for (const id of targets) {
      expect(src, `no element has id="${id}"`).toContain(`id="${id}"`);
    }
  });

  it("names the two budget inputs, which share one visible label", () => {
    // "Budget (₹ lakhs)" labels the pair; each field needs its own name so the
    // two are distinguishable.
    expect(src).toContain('aria-label="Minimum budget in lakhs"');
    expect(src).toContain('aria-label="Maximum budget in lakhs"');
  });

  it("keeps filter ids unique within the file", () => {
    const ids = [...src.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });
});
