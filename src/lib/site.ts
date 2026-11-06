/**
 * The one place that knows the site's public address.
 *
 * Canonical links, Open Graph URLs, the sitemap and robots.txt all need an
 * absolute origin. Reading it from configuration instead of a literal means
 * moving to a custom domain — or off Lovable entirely — is one environment
 * change, not an edit across twenty route files.
 *
 * `VITE_SITE_URL` is a public value (it is the address visitors already see), so
 * it is safe to ship in the browser bundle. The fallback keeps a build with no
 * environment emitting valid absolute URLs rather than a broken canonical link.
 */
const FALLBACK_SITE_URL = "https://emerald-property-hub.lovable.app";

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** The site origin, with no trailing slash. */
export const SITE_URL = normalize(import.meta.env["VITE_SITE_URL"] || FALLBACK_SITE_URL);

/** Absolute URL for a site-relative path: `siteUrl("/community")`. */
export function siteUrl(path: string): string {
  const clean = path.replace(/^\/+/, "");
  return clean === "" ? `${SITE_URL}/` : `${SITE_URL}/${clean}`;
}
