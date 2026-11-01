import { describe, expect, it } from "vitest";

/**
 * Route-level regression test for the malformed-query-string crash.
 *
 * `validateSearch` runs while the route renders on the server, so anything it
 * throws becomes a 500 for the visitor. The bug these routes shipped with was a
 * strict schema — `z.object({ area: z.string().optional() })` — while TanStack
 * Router had already parsed `?area=123` into the number 123. The schema rejected
 * it and /explore, /location-intelligence and /properties answered 500.
 *
 * This test reads each route's real `validateSearch` schema, so it fails if a
 * strict schema is reintroduced, and it pins the two behaviours that keep the
 * page loading: malformed input is dropped, well-formed input is kept.
 */

type SearchSchema = {
  safeParse: (value: unknown) => { success: true; data: unknown } | { success: false };
  parse: (value: unknown) => unknown;
};

async function schemaOf(path: string): Promise<SearchSchema> {
  const moduleName = {
    "/properties": "@/routes/properties.index",
    "/explore": "@/routes/explore",
    "/location-intelligence": "@/routes/location-intelligence.index",
  }[path]!;
  const mod = (await import(/* @vite-ignore */ moduleName)) as {
    Route: { options: { validateSearch: SearchSchema } };
  };
  return mod.Route.options.validateSearch;
}

const malformedByPath: Record<string, Record<string, unknown>> = {
  "/properties": {
    transaction: "bogus",
    minPrice: "abc",
    maxPrice: "",
    bedrooms: "xyz",
    minLand: 1.5,
    location: 42,
    allInclusive: "yes",
    verifiedOnly: "on",
  },
  "/explore": { area: 123 },
  "/location-intelligence": { area: 123 },
};

const wellFormedByPath: Record<
  string,
  { input: Record<string, unknown>; expected: Record<string, unknown> }
> = {
  "/properties": {
    input: { transaction: "buy", minPrice: "50", maxPrice: 90, bedrooms: "3", allInclusive: true },
    expected: { transaction: "buy", minPrice: 50, maxPrice: 90, bedrooms: 3, allInclusive: true },
  },
  "/explore": { input: { area: "Adyar" }, expected: { area: "Adyar" } },
  "/location-intelligence": { input: { area: "Adyar" }, expected: { area: "Adyar" } },
};

describe.each(Object.keys(malformedByPath))("%s search validation", (path) => {
  it("does not throw on malformed query values", async () => {
    const schema = await schemaOf(path);
    const parsed = schema.safeParse(malformedByPath[path]);
    expect(parsed.success, `${path} threw on malformed input`).toBe(true);
    expect(parsed.success && parsed.data).toEqual({});
  });

  it("keeps a well-formed query value", async () => {
    const schema = await schemaOf(path);
    const { input, expected } = wellFormedByPath[path]!;
    expect(schema.parse(input)).toEqual(expected);
  });
});
