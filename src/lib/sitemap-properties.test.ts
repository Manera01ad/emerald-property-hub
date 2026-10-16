import { describe, expect, it } from "vitest";
import { publicPropertyIds } from "./sitemap-properties.server";

function client(pages: Array<{ data: { id: string }[] | null; error: Error | null }>) {
  const calls: string[] = [];
  const q = { select: () => q, eq: (k: string, v: unknown) => { calls.push(`${k}=${v}`); return q; }, order: () => q,
    range: async () => pages.shift() ?? { data: [], error: null } };
  return { calls, value: { from: () => q } as never };
}

describe("sitemap public listing IDs", () => {
  it("reads every page using published, permitted, non-demo filters", async () => {
    const c = client([{ data: [{ id: "a" }, { id: "b" }], error: null }, { data: [{ id: "c" }], error: null }, { data: [], error: null }]);
    await expect(publicPropertyIds(c.value, 2)).resolves.toEqual(["a", "b", "c"]);
    expect(c.calls.slice(0, 3)).toEqual(["status=published", "listing_permission=true", "is_demo=false"]);
  });
  it("fails instead of returning a partial list when a later page errors", async () => {
    const c = client([{ data: [{ id: "a" }, { id: "b" }], error: null }, { data: null, error: new Error("offline") }]);
    await expect(publicPropertyIds(c.value, 2)).rejects.toThrow("offline");
  });
});