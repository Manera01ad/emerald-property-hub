import { describe, expect, it } from "vitest";
import { siteUrl } from "./site";

/**
 * The public origin is configuration now, not a literal scattered across routes.
 * These lock the two behaviours that make the move to a custom domain (or off
 * Lovable) a one-variable change: no double slash, and a trailing slash on root.
 */
describe("siteUrl", () => {
  it("returns the origin with a trailing slash for the root path", () => {
    expect(siteUrl("/")).toMatch(/^https:\/\/[^/]+\/$/);
  });

  it("joins a path without doubling or dropping the separator", () => {
    expect(siteUrl("/community")).toMatch(/^https:\/\/[^/]+\/community$/);
    expect(siteUrl("community")).toMatch(/^https:\/\/[^/]+\/community$/);
  });

  it("keeps a nested path intact", () => {
    expect(siteUrl("/properties/abc")).toMatch(/^https:\/\/[^/]+\/properties\/abc$/);
  });
});
