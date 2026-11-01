import { defineConfig, devices } from "@playwright/test";

/**
 * Browser-level regression guards.
 *
 * These exist because jsdom cannot compute layout or build an accessibility
 * tree, so two real defects shipped with a fully green unit suite: a 34px
 * horizontal overflow on /explore at 375px, and six filter controls on
 * /properties with no accessible name. Both are only observable in a real
 * engine, which is what this suite provides.
 *
 * The app reads its Supabase config at runtime, so the suite needs no secrets
 * and no backend. Pages render their structure without one; assertions here are
 * therefore about layout and semantics, never about data.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    command: "bun run dev",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
