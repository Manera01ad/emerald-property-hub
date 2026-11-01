import { expect, test } from "@playwright/test";
import { ROUTES, VIEWPORTS, horizontalOverflow, worstOverflowElement } from "./helpers";

/**
 * Guards the 34px overflow that shipped on /explore at 375px: a desktop-only
 * grid with an `auto` track, whose native <select> could not shrink below its
 * intrinsic width. jsdom cannot measure layout, so this is the only place the
 * defect is catchable.
 */
test.describe("no horizontal overflow", () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} (${viewport.width}px)`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of ROUTES) {
        test(`${route} fits`, async ({ page }) => {
          await page.goto(route, { waitUntil: "networkidle" });

          const overflow = await horizontalOverflow(page);
          if (overflow > 0) {
            const worst = await worstOverflowElement(page);
            expect(
              overflow,
              `${route} overflows by ${overflow}px at ${viewport.width}px; widest: ${worst.detail}`,
            ).toBe(0);
          }
          expect(overflow).toBeLessThanOrEqual(0);
        });
      }
    });
  }
});
