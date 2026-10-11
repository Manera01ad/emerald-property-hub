import { describe, expect, it } from "vitest";
import { hiddenReasons, isPubliclyVisible } from "./visibility";

describe("public visibility", () => {
  it("published + permission + not demo is public", () => {
    expect(isPubliclyVisible({ status: "published", listing_permission: true, is_demo: false })).toBe(true);
  });
  it("demo published record stays private", () => {
    expect(isPubliclyVisible({ status: "published", listing_permission: true, is_demo: true })).toBe(false);
  });
  it("missing permission hides listing", () => {
    expect(hiddenReasons({ status: "published", listing_permission: false, is_demo: false })).toHaveLength(1);
  });
  it("draft hides listing", () => {
    expect(isPubliclyVisible({ status: "draft", listing_permission: true, is_demo: false })).toBe(false);
  });
});
