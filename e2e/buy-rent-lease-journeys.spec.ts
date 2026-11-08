import { expect, test } from "@playwright/test";

const mockUser = {
  id: "test-buyer-1234",
  aud: "authenticated",
  role: "authenticated",
  email: "buyer@propwise.test",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
};

const mockUserSession = {
  access_token: "dummy-token",
  refresh_token: "dummy-refresh-token",
  expires_at: Math.floor(Date.now() / 1000) + 360000,
  token_type: "bearer",
  user: mockUser,
};

test.describe("Buy, Rent, and Lease end-to-end user journeys", () => {
  test.describe("Public Discovery on /properties", () => {
    test("switches smoothly between Buy, Rent, and Lease modes", async ({ page }) => {
      await page.goto("/properties", { waitUntil: "networkidle" });

      // Transaction selector exists with tablist
      const selector = page.getByRole("tablist", { name: "Transaction type" });
      await expect(selector).toBeVisible();

      const buyTab = selector.getByRole("tab", { name: "Buy" });
      const rentTab = selector.getByRole("tab", { name: "Rent" });
      const leaseTab = selector.getByRole("tab", { name: "Lease" });

      await expect(buyTab).toBeVisible();
      await expect(rentTab).toBeVisible();
      await expect(leaseTab).toBeVisible();

      // Default is Buy
      await expect(buyTab).toHaveAttribute("aria-selected", "true");

      // Switch to Rent
      await rentTab.click();
      await expect(page).toHaveURL(/transaction=rent/);
      await expect(rentTab).toHaveAttribute("aria-selected", "true");

      // Switch to Lease
      await leaseTab.click();
      await expect(page).toHaveURL(/transaction=lease/);
      await expect(leaseTab).toHaveAttribute("aria-selected", "true");

      // Switch back to Buy
      await buyTab.click();
      await expect(page).toHaveURL(/transaction=buy/);
      await expect(buyTab).toHaveAttribute("aria-selected", "true");
    });

    test("honors transaction URL parameter on direct navigation", async ({ page }) => {
      await page.goto("/properties?transaction=lease", { waitUntil: "networkidle" });
      const selector = page.getByRole("tablist", { name: "Transaction type" });
      const leaseTab = selector.getByRole("tab", { name: "Lease" });
      await expect(leaseTab).toHaveAttribute("aria-selected", "true");
    });
  });

  test.describe("Authenticated Seeker Preferences on /_authenticated/my", () => {
    test.beforeEach(async ({ context }) => {
      await context.addInitScript((session) => {
        window.localStorage.setItem("sb-lgetjiksdzoqfryelvmv-auth-token", JSON.stringify(session));
      }, mockUserSession);
    });

    test("allows selecting Lease intent and renders dynamic labels and preview guidance", async ({ page }) => {
      // Intercept Supabase auth and profile requests
      await page.route("**/auth/v1/user", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockUser) });
      });
      await page.route("**/auth/v1/token*", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockUserSession) });
      });
      await page.route("**/rest/v1/buyer_profiles*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            user_id: mockUser.id,
            intent: "buy",
            budget: 6000000,
            monthly_rent_budget: null,
            property_types: ["apartment"],
            preferred_locations: ["OMR"],
            bedrooms: 2,
            min_area_sqft: 1000,
            school_preference: "",
            commute_destinations: [],
            lifestyle_priorities: [],
            financing: "",
            move_in_timeframe: "",
          }),
        });
      });
      await page.route("**/rest/v1/properties*", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      });
      await page.route("**/rest/v1/buyer_reports*", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      });

      await page.goto("/_authenticated/my", { waitUntil: "networkidle" });

      const intentSelect = page.locator("#intent-select");
      await expect(intentSelect).toBeVisible();

      // Check all three options exist
      const options = await intentSelect.locator("option").allTextContents();
      expect(options).toContain("Buy");
      expect(options).toContain("Rent");
      expect(options).toContain("Lease");

      // Switch to Lease
      await intentSelect.selectOption("lease");

      // Verify Monthly lease budget label
      await expect(page.locator('label[for="monthly-budget-input"]')).toHaveText("Monthly lease budget (₹)");

      // Verify preview banner with truthful copy
      const previewNotice = page.locator("text=Lease preferences (Preview)");
      await expect(previewNotice).toBeVisible();

      const leaseLink = page.getByRole("link", { name: "browse Chennai lease listings" });
      await expect(leaseLink).toBeVisible();
      await expect(leaseLink).toHaveAttribute("href", "/properties?transaction=lease");
    });
  });

  test.describe("Property Comparison on /compare", () => {
    test("handles empty compare state with browse action", async ({ page }) => {
      await page.goto("/compare", { waitUntil: "networkidle" });
      await expect(page.locator("h1")).toHaveText("Compare properties");
      const browseBtn = page.getByRole("link", { name: "Browse properties" });
      await expect(browseBtn).toBeVisible();
      await expect(browseBtn).toHaveAttribute("href", "/properties");
    });
  });
});
