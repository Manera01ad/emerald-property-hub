import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";

/**
 * Served from a route rather than `public/robots.txt` so the sitemap URL follows
 * `VITE_SITE_URL`. A static file kept naming the old host after a domain move,
 * which is the kind of stale detail that is invisible until a crawler reports it.
 */
const BODY = `User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

export const Route = createFileRoute("/robots.txt")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: () =>
        new Response(BODY, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
