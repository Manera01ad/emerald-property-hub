import { describe, expect, it } from "vitest";
import { FLAG_KEYS, parseFlag } from "./flags";

describe("feature flags", () => {
  it("only the exact value 'on' turns a feature on", () => {
    expect(parseFlag("on")).toBe(true);
    expect(parseFlag("ON")).toBe(false);
    expect(parseFlag("true")).toBe(false);
    expect(parseFlag("off")).toBe(false);
    expect(parseFlag("")).toBe(false);
  });

  it("a missing or unreadable row stays off, so a feature never opens by accident", () => {
    expect(parseFlag(undefined)).toBe(false);
    expect(parseFlag(null)).toBe(false);
  });

  it("lists exactly the three Phase 1 flags", () => {
    expect([...FLAG_KEYS]).toEqual(["feature_community", "feature_owner_submissions", "feature_interest_requests"]);
  });
});
