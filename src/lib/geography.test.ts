import { describe, expect, it } from "vitest";
import { CITIES, DEFAULT_CITY_SLUG, cityBySlug, citySlugFrom, isKnownCity, resolveCity, sameArea } from "./geography";

describe("city resolution", () => {
  it("resolves the launch city by slug and by name, in any case", () => {
    expect(resolveCity("chennai").slug).toBe("chennai");
    expect(resolveCity("Chennai").name).toBe("Chennai");
    expect(resolveCity("  CHENNAI  ").state).toBe("Tamil Nadu");
  });

  it("defaults to Chennai for empty or unknown input, so existing pages keep working", () => {
    expect(resolveCity(null).slug).toBe(DEFAULT_CITY_SLUG);
    expect(resolveCity(undefined).slug).toBe(DEFAULT_CITY_SLUG);
    expect(resolveCity("").slug).toBe(DEFAULT_CITY_SLUG);
    expect(resolveCity("atlantis").slug).toBe(DEFAULT_CITY_SLUG);
  });

  it("never returns undefined, so callers can read .name without a guard", () => {
    expect(resolveCity("nope").name).toBe("Chennai");
  });

  it("reports known cities without defaulting", () => {
    expect(isKnownCity("chennai")).toBe(true);
    expect(isKnownCity("Chennai")).toBe(true);
    expect(isKnownCity("atlantis")).toBe(false);
    expect(isKnownCity(null)).toBe(false);
    expect(cityBySlug("chennai")?.state).toBe("Tamil Nadu");
    expect(cityBySlug("atlantis")).toBeNull();
  });

  it("exposes Chennai as the only seeded city for now", () => {
    expect(CITIES.map((c) => c.slug)).toEqual(["chennai"]);
  });
});

describe("citySlugFrom", () => {
  it("accepts a slug-shaped value", () => {
    expect(citySlugFrom("bengaluru")).toBe("bengaluru");
    expect(citySlugFrom("  New-Delhi ")).toBe("new-delhi");
  });

  it("rejects anything that is not slug-shaped", () => {
    expect(citySlugFrom("a")).toBeNull();
    expect(citySlugFrom("-chennai")).toBeNull();
    expect(citySlugFrom("1chennai")).toBeNull();
    expect(citySlugFrom("chennai city")).toBeNull();
    expect(citySlugFrom("")).toBeNull();
    expect(citySlugFrom(null)).toBeNull();
  });
});

describe("sameArea", () => {
  it("matches area names case-insensitively and ignores extra spaces", () => {
    expect(sameArea("T. Nagar", "t. nagar")).toBe(true);
    expect(sameArea("Anna  Nagar", "Anna Nagar")).toBe(true);
  });

  it("does not match empty or different areas", () => {
    expect(sameArea("", "")).toBe(false);
    expect(sameArea(null, "Velachery")).toBe(false);
    expect(sameArea("Velachery", "Adyar")).toBe(false);
  });
});
