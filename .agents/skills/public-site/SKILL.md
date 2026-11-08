---
name: public-site
description: Use when changing public pages, routes, SEO metadata, sitemap, robots, area intelligence content, or any public map.
---

# Public site

## Routes

File routes in `src/routes/` (TanStack Router). Important public routes:
`index.tsx`, `properties.index.tsx`, `properties.$id.tsx`, `compare.tsx`,
`explore.tsx`, `map.tsx`, `location-intelligence.*`, `infrastructure.tsx`,
`community.tsx`, `advisor.tsx`, `consult.tsx`, `contribute.tsx`, `owners.tsx`,
plus `robots[.]txt.ts` and `sitemap[.]xml.ts`.

`src/routes/README.md` records the route-level sitemap decisions. A route that must
appear in the sitemap needs its decision recorded there.

## Crawler-facing output

Property head metadata and sitemap data use the session-free publishable client
(`src/lib/public-client.server.ts`) with explicit public-visibility filters. This
keeps private drafts out of crawler responses while browser-based admin previews
still work.

- `src/lib/property-seo.functions.ts` — head metadata
- `src/lib/sitemap.ts` and `sitemap-properties.server.ts` — static URLs and
  paginated public property IDs; private subtrees excluded; **no partial XML on
  failure**
- `src/lib/site.ts` — canonical site URL, read from configuration

## Maps: no Google credentials for buyers

All public maps dynamically import Leaflet inside an effect and use keyless layer
definitions with provider attribution. Property and locality embeds share
`LocationMap`; Explore keeps its interactive POI overlays. Public address search
uses explicit Photon queries; directions open OpenStreetMap.

Owner-only `places.functions.ts` and `maps.functions.ts` research services may need
provider credentials. Verify them on the current backend before activation.

## Area intelligence

Pure rules with admin-only fetching; rows stay hidden until an admin publishes
them. Do not expose unpublished rows through a public query.

## Tests

`responsive.test.ts`, `search-params.test.ts`, `mapurl.test.ts`,
`map-layers.test.ts`, SEO coverage, plus Playwright specs in `e2e/`.
