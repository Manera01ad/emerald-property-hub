import { expect, test } from "@playwright/test";
import { ROUTES, controlsWithNoName } from "./helpers";

/**
 * Guards the six unlabelled filter controls that shipped on /properties: a
 * <Label> with no htmlFor, in a sibling div, next to an input with no id, so the
 * association never existed. Confirmed via the browser accessibility tree, which
 * is the only way to see the computed name a screen reader uses.
 */
test.describe("every form control has an accessible name", () => {
  for (const route of ROUTES) {
    test(`${route} names its controls`, async ({ page }) => {
      await page.goto(route, { waitUntil: "networkidle" });

      const unnamed = await controlsWithNoName(page);
      expect(
        unnamed,
        `${route} has ${unnamed.length} control(s) with no accessible name: ` +
          unnamed.map((u) => `${u.role} ${u.html}`).join(", "),
      ).toEqual([]);
    });
  }
});
