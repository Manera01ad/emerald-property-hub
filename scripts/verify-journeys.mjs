import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve("docs/evidence");
mkdirSync(outDir, { recursive: true });

async function checkOverflow(page) {
  return await page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
}

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

async function run() {
  console.log("Launching Chromium for journey verification...");
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 375, height: 812 },
  ];

  const results = [];

  for (const vp of viewports) {
    console.log(`\n--- Testing viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });

    // Seed mock auth in localStorage
    await context.addInitScript((session) => {
      window.localStorage.setItem("sb-lgetjiksdzoqfryelvmv-auth-token", JSON.stringify(session));
    }, mockUserSession);

    const page = await context.newPage();

    // Intercept Supabase auth requests
    await page.route("**/auth/v1/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUser),
      });
    });

    await page.route("**/auth/v1/token*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUserSession),
      });
    });

    // Intercept buyer_profiles query
    await page.route("**/rest/v1/buyer_profiles*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_id: mockUser.id,
          intent: "buy",
          budget: 7500000,
          monthly_rent_budget: null,
          property_types: ["apartment"],
          preferred_locations: ["OMR"],
          bedrooms: 2,
          min_area_sqft: 1000,
          school_preference: "CBSE within 5km",
          commute_destinations: ["Tidel Park"],
          lifestyle_priorities: ["metro access"],
          financing: "Home loan",
          move_in_timeframe: "3 months",
        }),
      });
    });

    // Intercept buyer_reports query
    await page.route("**/rest/v1/buyer_reports*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // 1. Buy Journey
    console.log("Testing Buy Journey (/properties?transaction=buy)...");
    await page.goto("http://localhost:8080/properties?transaction=buy", { waitUntil: "networkidle" });
    let overflow = await checkOverflow(page);
    console.log(`Buy page overflow: ${overflow}px`);
    const buyShot = `${outDir}/buy-journey-${vp.name}.png`;
    await page.screenshot({ path: buyShot, fullPage: false });
    results.push({ journey: "Buy (/properties?transaction=buy)", viewport: vp.name, overflow, screenshot: buyShot });

    // 2. Rent Journey
    console.log("Testing Rent Journey (/properties?transaction=rent)...");
    await page.goto("http://localhost:8080/properties?transaction=rent", { waitUntil: "networkidle" });
    overflow = await checkOverflow(page);
    console.log(`Rent page overflow: ${overflow}px`);
    const rentShot = `${outDir}/rent-journey-${vp.name}.png`;
    await page.screenshot({ path: rentShot, fullPage: false });
    results.push({ journey: "Rent (/properties?transaction=rent)", viewport: vp.name, overflow, screenshot: rentShot });

    // 3. Lease Journey
    console.log("Testing Lease Journey (/properties?transaction=lease)...");
    await page.goto("http://localhost:8080/properties?transaction=lease", { waitUntil: "networkidle" });
    overflow = await checkOverflow(page);
    console.log(`Lease page overflow: ${overflow}px`);
    const leaseShot = `${outDir}/lease-journey-${vp.name}.png`;
    await page.screenshot({ path: leaseShot, fullPage: false });
    results.push({ journey: "Lease (/properties?transaction=lease)", viewport: vp.name, overflow, screenshot: leaseShot });

    // 4. Compare Journey
    console.log("Testing Compare Journey (/compare)...");
    await page.goto("http://localhost:8080/compare", { waitUntil: "networkidle" });
    overflow = await checkOverflow(page);
    console.log(`Compare page overflow: ${overflow}px`);
    const compareShot = `${outDir}/compare-${vp.name}.png`;
    await page.screenshot({ path: compareShot, fullPage: false });
    results.push({ journey: "Compare (/compare)", viewport: vp.name, overflow, screenshot: compareShot });

    // 5. My Property Research (/my)
    console.log("Testing My Property Research (/my)...");
    await page.goto("http://localhost:8080/my", { waitUntil: "networkidle" });
    console.log(`Navigated to: ${page.url()}`);
    overflow = await checkOverflow(page);
    console.log(`My Property Research initial overflow: ${overflow}px`);

    const intentSelect = page.locator("#intent-select");
    const count = await intentSelect.count();
    console.log(`Intent select found: ${count}`);

    if (count > 0) {
      // Test selecting Lease
      await intentSelect.selectOption("lease");
      await page.waitForTimeout(400);

      overflow = await checkOverflow(page);
      console.log(`My Property Research (Lease selected) overflow: ${overflow}px`);

      // Verify label changed to Monthly lease budget (₹)
      const labelText = await page.locator('label[for="monthly-budget-input"]').innerText();
      console.log(`Monthly budget label text: "${labelText}"`);

      // Verify preview notice is present
      const noticeText = await page.locator("text=Lease preferences (Preview)").innerText();
      console.log(`Preview notice title: "${noticeText}"`);

      // Type in a lease monthly budget
      await page.locator("#monthly-budget-input").fill("75000");

      const myLeaseShot = `${outDir}/my-research-lease-preference-${vp.name}.png`;
      await page.screenshot({ path: myLeaseShot, fullPage: false });
      results.push({
        journey: "My Research Preferences (Lease selected)",
        viewport: vp.name,
        overflow,
        screenshot: myLeaseShot,
      });

      // Switch to Matches tab
      await page.locator('button[role="tab"]:has-text("Matches")').click();
      await page.waitForTimeout(400);
      overflow = await checkOverflow(page);
      console.log(`My Property Research (Matches tab) overflow: ${overflow}px`);
      const matchesShot = `${outDir}/my-research-matches-${vp.name}.png`;
      await page.screenshot({ path: matchesShot, fullPage: false });
      results.push({
        journey: "My Research (Matches tab)",
        viewport: vp.name,
        overflow,
        screenshot: matchesShot,
      });
    }

    await context.close();
  }

  await browser.close();
  console.log("\n--- Verification Summary ---");
  console.log(JSON.stringify(results, null, 2));
}

run().catch((err) => {
  console.error("Browser test failed:", err);
  process.exit(1);
});
