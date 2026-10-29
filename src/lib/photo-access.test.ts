import { describe, expect, it } from "vitest";
import { canSignPhotos, photosWithheld } from "./photo-access";
import type { VisibilityInput } from "./visibility";

const pub: VisibilityInput = { status: "published", is_demo: false, listing_permission: true };
const draft: VisibilityInput = { status: "draft", is_demo: false, listing_permission: true };
const demo: VisibilityInput = { status: "published", is_demo: true, listing_permission: true };
const unpermitted: VisibilityInput = { status: "published", is_demo: false, listing_permission: false };

describe("photo access", () => {
  it("signs photos for a public row", () => {
    expect(canSignPhotos(pub, false)).toBe(true);
    expect(photosWithheld(pub, false)).toBe(false);
  });

  it("refuses photos for a draft, a demo row and an unpermitted row", () => {
    expect(canSignPhotos(draft, false)).toBe(false);
    expect(canSignPhotos(demo, false)).toBe(false);
    expect(canSignPhotos(unpermitted, false)).toBe(false);
  });

  it("allows an admin to preview any row, which is what the admin screens need", () => {
    expect(canSignPhotos(draft, true)).toBe(true);
    expect(canSignPhotos(demo, true)).toBe(true);
    expect(canSignPhotos(unpermitted, true)).toBe(true);
  });

  it("keeps the existing public rule, not a looser one", () => {
    // Any one of the three conditions failing must withhold the photos.
    expect(canSignPhotos({ status: "archived", is_demo: false, listing_permission: true }, false)).toBe(false);
    expect(canSignPhotos({ status: "published", is_demo: false, listing_permission: true }, false)).toBe(true);
  });
});
