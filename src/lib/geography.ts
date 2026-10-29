/**
 * City and state handling for phased expansion.
 *
 * Pure rules only. Chennai is the launch city and remains the default, so every
 * existing call site keeps its current behaviour when no city is given.
 */

export type City = { slug: string; name: string; state: string };

/** Cities the app knows about. `is_active` in the database decides what is shown. */
export const CITIES: readonly City[] = [
  { slug: "chennai", name: "Chennai", state: "Tamil Nadu" },
] as const;

export const DEFAULT_CITY_SLUG = "chennai";

const BY_SLUG = new Map(CITIES.map((c) => [c.slug, c]));
const BY_NAME = new Map(CITIES.map((c) => [c.name.toLowerCase(), c]));

/** Resolves a slug or a display name to a known city, defaulting to Chennai. */
export function resolveCity(value: string | null | undefined): City {
  const key = (value ?? "").trim().toLowerCase();
  return BY_SLUG.get(key) ?? BY_NAME.get(key) ?? BY_SLUG.get(DEFAULT_CITY_SLUG)!;
}

export function cityBySlug(slug: string | null | undefined): City | null {
  return BY_SLUG.get((slug ?? "").trim().toLowerCase()) ?? null;
}

export function isKnownCity(value: string | null | undefined): boolean {
  const key = (value ?? "").trim().toLowerCase();
  return BY_SLUG.has(key) || BY_NAME.has(key);
}

/**
 * Slugs are the stable key stored in the database. Names change; slugs do not.
 * Returns null for anything that cannot be a slug, so a bad value is rejected
 * rather than silently stored.
 */
export function citySlugFrom(value: string | null | undefined): string | null {
  const key = (value ?? "").trim().toLowerCase();
  return /^[a-z][a-z0-9-]{1,40}$/.test(key) ? key : null;
}

/** Case-insensitive comparison of two area names, so "T. Nagar" matches "t. nagar". */
export function sameArea(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const left = norm(a);
  return left !== "" && left === norm(b);
}
