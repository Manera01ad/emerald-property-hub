import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Lovable-managed Supabase project must not be reachable from a build.
 *
 * This is a guard, not a style rule. `supabase/config.toml`'s `project_id` is
 * read by the build tooling and injected into the bundle, and `vite.config.ts`
 * used to carry a fallback URL. Either one would make a build with no
 * environment variables talk to the old Lovable database silently, with no
 * error, which is the worst way for a migration to fail.
 */
const LEGACY_REF = "dashpanandamjickoytj";
// Shape, not a value. A publishable key must come from the environment, so no
// key literal belongs in a build input. Matching the shape rather than one old
// value also catches a future hardcoded key, and keeps no key-shaped literal in
// this file for the repository's secret scan to trip over.
const PUBLISHABLE_KEY_SHAPE = /sb_publishable_[A-Za-z0-9_-]{20,}/;

// Files that feed the build. Docs and audit records are allowed to name the old
// project; configuration is not.
const BUILD_INPUTS = [
  "supabase/config.toml",
  "vite.config.ts",
  ".env.example",
  "wrangler.toml",
  "wrangler.jsonc",
];

describe("build configuration", () => {
  for (const path of BUILD_INPUTS) {
    it(`${path} does not point at the Lovable Supabase project`, () => {
      let content: string;
      try {
        content = readFileSync(resolve(process.cwd(), path), "utf8");
      } catch {
        return; // optional file
      }
      expect(content).not.toContain(LEGACY_REF);
      expect(content).not.toMatch(PUBLISHABLE_KEY_SHAPE);
    });
  }

  it("supabase/config.toml names a project, so the build cannot silently reuse a stale ref", () => {
    const content = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");
    const match = /^project_id\s*=\s*"([^"]+)"/m.exec(content);
    expect(match?.[1]).toBeTruthy();
    expect(match?.[1]).not.toBe(LEGACY_REF);
  });
});
