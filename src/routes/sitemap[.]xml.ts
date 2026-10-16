import { createFileRoute } from "@tanstack/react-router";
import { getRouterInstance } from "@tanstack/react-start";
import { isSitemapRouteIncluded, sitemapPathForLocation, sitemapStaticPaths, sitemapXML, type SitemapEntry } from "@/lib/sitemap";

const BASE_URL = "https://emerald-property-hub.lovable.app";

export const Route = createFileRoute("/sitemap.xml")({
  staticData: { sitemap: false },
  server: { handlers: { GET: async () => {
    try {
      const router = await getRouterInstance();
      const entries: SitemapEntry[] = sitemapStaticPaths(router).map((path) => ({ path }));
      const routeId = "/properties/$id";
      if (isSitemapRouteIncluded(router.routesById[routeId])) {
        const { publicPropertyIds } = await import("@/lib/sitemap-properties.server");
        for (const id of await publicPropertyIds()) {
          const location = router.buildLocation({ to: "/properties/$id", params: { id }, search: () => ({}), hash: "" });
          const path = sitemapPathForLocation(router, location, routeId);
          if (path) entries.push({ path });
        }
      }
      if (!entries.length) return new Response("No discoverable pages", { status: 404, headers: { "Cache-Control": "no-store" } });
      return new Response(sitemapXML(BASE_URL, entries), {
        headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
      });
    } catch {
      return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  } } },
});