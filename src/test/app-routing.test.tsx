import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { sitemapStaticPaths } from "@/lib/sitemap";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  const router = () => createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it("matches a page for / instead of falling back to not found", () => {
    const matches = router().matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("keeps feature-gated pages out of the sitemap", () => {
    const paths = sitemapStaticPaths(router());

    expect(paths).not.toContain("/research-services");
    expect(paths).not.toContain("/community");
    expect(paths).not.toContain("/owners");
    expect(paths).toContain("/properties");
  });

  it.each(["/properties", "/location-intelligence", "/community", "/owners", "/advisor", "/research-services"])(
    "still resolves the address %s",
    (path) => {
      const matches = router().matchRoutes(path);

      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    },
  );
});
