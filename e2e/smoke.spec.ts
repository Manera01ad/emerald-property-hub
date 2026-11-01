import { expect, test } from "@playwright/test";
import { ROUTES } from "./helpers";

/**
 * Smoke coverage: every route serves, renders one heading, and throws no
 * uncaught error. Cheap to run and catches a route that breaks at the layout or
 * module level, which a unit test on an isolated component will not.
 */
test.describe("every route serves and renders", () => {
  for (const route of ROUTES) {
    test(`${route} responds and renders`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status(), `${route} should return 200`).toBe(200);

      // Exactly one top-level heading, so the page has a single clear subject.
      await expect(page.locator("h1")).toHaveCount(1);

      // A non-trivial body: catches a blank render that still returns 200.
      const text = (await page.locator("body").innerText()).trim();
      expect(text.length, `${route} rendered almost nothing`).toBeGreaterThan(200);

      expect(errors, `${route} threw: ${errors.join(" | ")}`).toEqual([]);
    });
  }
});
