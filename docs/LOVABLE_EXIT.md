# Leaving Lovable — Exit Runbook

The step-by-step procedure to take this project off Lovable and onto your own
free hosting. Companion to `docs/PLAN.md` (which holds the phases and the "why").

Read this once end to end before starting. Nothing here is destructive until
step 9, and step 9 is the only step that cannot be undone.

Throughout, "you" means the repository owner. An AI agent may prepare and open
pull requests, but **you** create accounts, hold the credentials, and cancel the
subscription. See `AGENTS.md` for why.

---

## 0. What you are moving, and what stays

| Piece | Today | After | Cost |
| --- | --- | --- | --- |
| Application code | GitHub (`Manera01ad/emerald-property-hub`) | same | free |
| Build | Lovable's Vite wrapper | your own Vite config | free |
| Hosting | Lovable | Cloudflare Workers (free tier) | free |
| Database / auth / storage | Supabase (already separate) | same | free tier |
| AI assistant | Lovable AI gateway | off, or a free model tier | free / ₹0 by default |
| Domain | `*.lovable.app` | `*.workers.dev` then optionally your own | free / ~₹800/yr |

The important point: **your data is already in Supabase, not in Lovable.** Lovable
hosts the front end and bills for AI. Nothing in the database moves.

---

## 1. Before you start (30 minutes, one-off)

1. **Confirm the current site is green.** Load the live site, sign in, open a
   listing. Note anything broken — do not carry a pre-existing bug into the
   migration and mistake it for migration damage.
2. **Export anything you want to keep from Lovable.** Chat history, prompts,
   screenshots. Once cancelled, the editor is gone. (The code is already in
   GitHub, so nothing code-related is at risk.)
3. **Note the Supabase project details.** In the Supabase dashboard, under
   Project Settings → API, copy:
   - Project URL → this is `SUPABASE_URL` / `VITE_SUPABASE_URL`.
   - `anon` / publishable key → `SUPABASE_PUBLISHABLE_KEY` /
     `VITE_SUPABASE_PUBLISHABLE_KEY`.
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`. **Server-side only. Never
     commit it, never put it in a `VITE_` variable.**
   These are already in the repo's `.env.example` as names; only the values are
   new to the host.
4. **Rotate the leaked Google Maps key** (decision D5). It is in git history and
   cannot be removed without rewriting history. Rotate it in Google Cloud
   Console, or delete the key entirely if you are dropping the Maps connector
   (D6) — the public maps already use keyless Leaflet.

---

## 2. Phase 1 — the code (already done, review and merge)

Phase 1 is implemented. What to check in the pull request:

- [ ] No `src/` file imports `@lovable.dev/*` except plugin-generated routes
      (`src/routes/mcp.ts`, `src/routes/[.well-known]/…`), which Phase 2 removes.
- [ ] `src/lib/site.ts` exists and all route files use `siteUrl(...)` /
      `SITE_URL`.
- [ ] `src/integrations/lovable/` and `src/integrations/supabase/previewAuthStorage.ts`
      are gone.
- [ ] `src/lib/assistant/pricing.ts` reads `AI_BASE_URL`, `AI_API_KEY`,
      `AI_MODEL` with Lovable fallbacks.
- [ ] `bun run test` and `bun run build` pass (they do: 584 tests).

Merge it. The live site does not change, because every default still points at
the current services.

---

## 3. Phase 2 — swap the build config

This is the risky step. Do it on a branch, keep the old config until the new one
is proven green.

### 3.1 What the Lovable wrapper does, and what replaces it

`vite.config.ts` currently imports `defineConfig` from
`@lovable.dev/vite-tanstack-config`. That package wraps, in order: Tailwind,
TypeScript path aliases, TanStack Start, the React plugin, and Nitro (building a
Cloudflare Worker), plus Lovable-only sandbox behaviour (devtools in dev, a
prerender shim, an exit watchdog, error-logger plugins, and env injection).

Outside Lovable you configure these directly. **This exact configuration has been
verified**: it builds a working Cloudflare Worker on this repository, with the
full test suite green. The `vite.config.ts` to use is:

```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: { port: 8080 },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Redirect Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    viteReact(),
    nitro({
      preset: "cloudflare-module",
      cloudflare: { nodeCompat: true, deployConfig: true },
    }),
  ],
  vite: {
    // No Supabase fallback: the URL and publishable key must come from the build
    // environment, or the app fails loudly. See the note below.
  },
});
```

Why each piece is there:

- `importProtection` is copied from the wrapper. Without it, server-only code can
  be pulled into the browser bundle. It is a security control, not a nicety.
- **There is deliberately no `define` fallback for the Supabase URL or key.**
  The wrapper used to default both to the Lovable-managed project, which meant a
  build with no `.env` silently talked to that database. Removing the fallback
  turns a misconfigured deploy into a loud error instead of a quiet read of the
  wrong data.
- `nitro` runs on every command (the wrapper ran it on build only). Harmless, and
  simpler to reason about.
- Verified output: `.output/server/wrangler.json` with `main: index.mjs`,
  `compatibility_flags: ["nodejs_compat"]`, and the `ASSETS` binding — the same
  shape Lovable produces.

Do not add both `tanstackStart()` and the Lovable wrapper; pick one.

### 3.1.1 Two hidden places the old Supabase project was baked into the build

Removing the `vite.config.ts` fallback is not enough on its own. The Lovable
build tooling injects the whole `import.meta.env` object, and it took the project
ref from `supabase/config.toml`. Verified behaviour:

- `@lovable.dev/mcp-js`'s `productionImportMetaEnv()` calls
  `readSupabaseProjectRef(config.root)`, which reads `project_id` from
  `supabase/config.toml` and injects it as `VITE_SUPABASE_PROJECT_ID`.
- `@lovable.dev/vite-tanstack-config` injects every `VITE_*` value found by
  Vite's `loadEnv`, so any `VITE_SUPABASE_*` set in the build environment is
  baked into the browser bundle.

So there were **two** sources, and a clean build with no `.env` still contained
the old project URL and publishable key. Both are fixed:

1. `supabase/config.toml` now names your own project ref.
2. `vite.config.ts` no longer carries a fallback.

`src/test/build-config.test.ts` fails if either the old ref or the old key
reappears in a build input. Verify with a clean build, which is the only reliable
check because both build tools cache:

```sh
rm -rf node_modules/.nitro node_modules/.vite .output .wrangler
bun run build
grep -rl "dashpanandamjickoytj" .output/ | wc -l   # expect 0
```

### 3.1.2 Cutover order matters, and the data has not moved yet

Changing `supabase/config.toml` points the tooling at the new project, and a build
with the new `VITE_*` values points the app at it too. The **data is still in the
old project** until you migrate it. So the order below is not a preference; doing
it out of order gives a working-looking deploy with no tables.

1. Create the new Supabase project.
2. Apply every migration, in order, per `docs/APPLY_RUNBOOK.md`: the applied set
   (`drizzle/migrations/` 0000→0018), then the pending queue
   (`drizzle/pending/` 0017→0021).
3. Confirm with `scripts/sql-check/verify-applied.sql`.
4. Move any real data you want to keep out of the old project (see §7). Verify
   counts, not just that the export ran.
5. Re-enable the Google provider in the new project's auth settings; OAuth
   redirect URLs are per project.
6. Recreate the `property-photos` storage bucket and its policies.
7. Only then set the new `VITE_*` values in the build environment and deploy.
8. Check the live site, then cancel Lovable.

Step 2 is also what fixes the assistant's 503: the guard needs
`reserve_ai_budget`, which arrives with `0021_ai_cost_control.sql`. Until that
migration is applied, the assistant fails closed by design.

### 3.1.3 One stale generated file to clear with D7

`.lovable/mcp/manifest.json` is a generated snapshot and still names the old
issuer. It is not read by the build, so it cannot cause the silent-wrong-database
problem, but it is misleading. Delete it along with the MCP decision in §3.2.

### 3.2 Remove the MCP plugin

`src/routes/mcp.ts` and `src/routes/[.well-known]/oauth-protected-resource.ts`
are generated by `@lovable.dev/mcp-js`. **The MCP code cannot simply drop the
package**: `src/lib/mcp/index.ts` and the three tools import `defineMcp`,
`defineTool` and `ToolError` from it, so deleting the dependency breaks the build.

Two options:

1. **Do not need the MCP server:** delete `src/routes/mcp.ts`,
   `src/routes/[.well-known]/oauth-protected-resource.ts`, the whole
   `src/lib/mcp/` directory, and `.lovable/mcp/manifest.json`. Then remove the
   dependency. This is the simplest path and is fine for a pre-launch product.
2. **Want to keep it:** the tools are ~300 lines and use a small API surface
   (`defineMcp`, `auth.oauth.issuer`, `defineTool`, `ToolError`, and a TanStack
   handler factory). Port them to the official
   `@modelcontextprotocol/sdk`, which is **already installed** as a transitive
   dependency of `mcp-js`. This is a real piece of work and belongs in its own
   pull request.

Decision D7 in `docs/PLAN.md`. Until it is made, `@lovable.dev/mcp-js` stays.

### 3.3 The registry trap (read this before removing any package)

`bun.lock` resolves **~120 packages** — not just the `@lovable.dev` ones, but
`express`, `esbuild`, the Supabase packages, `drizzle-orm`, `zod` and more —
from `europe-west4-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache`. That is
Lovable's private package cache. It is reachable today (verified: those URLs
return 200) but it is **not a public registry** and it is not guaranteed to
outlive a Lovable subscription.

Consequences:

- After cancelling Lovable, `bun install --frozen-lockfile` in CI could fail,
  because the lockfile points at a host you no longer have a relationship with.
- The public npm registry does serve the `@lovable.dev/*` packages (verified
  200), so the fix is not to delete them blindly — it is to re-resolve the whole
  lockfile against `registry.npmjs.org` and commit the result.
- Do this **after** §3.1 and §3.2, so the packages you are about to remove are
  not part of the re-resolve.

Procedure (one pull request, after the package removals):

```sh
rm -f bun.lock
bun install                       # resolves everything from registry.npmjs.org
bun run test && bun run build     # must both pass
```

Then confirm the trap is gone:

```sh
grep -c "pkg.dev" bun.lock        # expect 0
```

Also delete the `minimumReleaseAgeExcludes` entries in `bunfig.toml` for any
`@lovable.dev/*` package you removed; they were supply-chain bypasses for the
private registry.

### 3.4 Remove the packages

In one pull request, remove from `package.json`:

- `@lovable.dev/vite-tanstack-config`
- `@lovable.dev/mcp-js` (only once §3.2 is decided)
- `@lovable.dev/cloud-auth-js` (already unused after Phase 1)

Then re-resolve the lockfile as in §3.3 and confirm `bun run build` is green.

---

## 4. Phase 2 — deploy to Cloudflare Workers

### 4.1 Create the account and install Wrangler

1. Create a free Cloudflare account.
2. Install Wrangler: `npm i -D wrangler` (or use `npx wrangler`).
3. `npx wrangler login`.

The free Workers plan is enough to start; confirm current request limits in the
Cloudflare dashboard, because free-tier numbers change. `docs/COST_MODEL.md`
records the shape of the limit and what to watch.

### 4.2 Environment variables

Set these as Worker environment variables (Wrangler secrets for the private
ones). Names are authoritative; values are yours.

| Variable | Private? | Value |
| --- | --- | --- |
| `SUPABASE_URL` | no | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | no | Supabase publishable/anon key |
| `VITE_SUPABASE_URL` | no | same as `SUPABASE_URL` (build-time) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | no | same publishable key (build-time) |
| `VITE_SITE_URL` | no | your live origin, e.g. `https://propwise.example` |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Supabase service-role key — server only |
| `CRON_SECRET` | **yes** | research scheduler token |
| `DATABASE_MIGRATION_URL` | **yes** | Postgres connection string, only for migrations |
| `AI_API_KEY` | **yes** | model provider key; unset = assistant off |
| `AI_BASE_URL` | no | OpenAI-compatible endpoint (optional) |
| `AI_MODEL` | no | model id (optional) |
| `AI_DAILY_BUDGET_INR` | no | `0` to hard-stop all AI spend |

Rules:
- The `VITE_*` values are baked in at **build** time, so set them where the build
  runs (Cloudflare build settings or your local shell), not only as runtime vars.
- Never put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_` variable. A `VITE_` value
  ships to the browser.

### 4.3 Deploy

```sh
bun run build
npx wrangler deploy --config .output/server/wrangler.json
```

The build already writes `.output/server/wrangler.json`; Wrangler deploys the
Worker plus the `public/` assets. Confirm the `*.workers.dev` URL loads.

**Check `public/_redirects` after the first deploy.** It contains
`/* /index.html 200`, an SPA fallback. On Workers, the assets binding can serve a
matching static path before the Worker runs, so a catch-all rule can shadow
server-rendered routes. The pages to confirm are the server-rendered ones:
`/sitemap.xml`, `/robots.txt`, `/properties/<id>`. If any returns the app shell
instead of real output, either delete `public/_redirects` or set
`run_worker_first` on the assets binding in `wrangler.json`. Do not assume this
is fine without checking; it is exactly the kind of thing that only shows up on
the live host.

### 4.4 Custom domain (optional, D2)

1. Add your domain to Cloudflare.
2. In the Worker's settings, add a custom domain route.
3. Set `VITE_SITE_URL` to the new origin and rebuild, so canonical links and the
   sitemap point at it.
4. Update `public/robots.txt`'s `Sitemap:` line to the new origin (it is a static
   file and still names the old host).

---

## 5. Phase 2 — CI

`Verify` (`.github/workflows/verify.yml`) stays: it is your machine key and it
does not deploy. Add a separate, gated deploy workflow that runs only on `main`
after `Verify` passes, using a Cloudflare API token stored as a GitHub secret.
Keep deploy out of pull-request runs.

---

## 6. Phase 3 — the smoke checklist

Run this on the live domain after deploying. Full version in
`docs/OPERATIONS.md` §4.

- [ ] `/` loads; the "Ask PropWise AI" box is present.
- [ ] `/properties` loads; listings render or the honest empty state shows.
- [ ] A listing detail page opens; the map renders; photos load or the
      placeholder shows.
- [ ] `/location-intelligence` and one area page load.
- [ ] Sign up and sign in with email; session persists across a reload.
- [ ] Google sign-in works (requires the Google provider enabled in Supabase).
- [ ] The assistant: with no `AI_API_KEY`, shows the "not configured" message
      and does not crash; with a key, answers and refuses unknown facts.
- [ ] `/sitemap.xml` returns XML naming your domain.
- [ ] `/robots.txt` names your domain in its `Sitemap:` line.
- [ ] No console errors on the pages above.

---

## 7. Cancel Lovable

Only after §6 passes on your own domain:

1. Confirm you have not pushed to the Lovable-connected branch expecting a
   deploy (you no longer need to).
2. Cancel the Lovable subscription.
3. Leave the Lovable project files in git (`.lovable/`, the `AGENTS.md` block)
   until Phase 2.3 is merged and stable; then remove them in a normal pull
   request. Do not rewrite history to erase them.

---

## 8. Rollback

At any point before step 9 (cancelling), the rollback is: point the Lovable
project back at the branch, or keep using the `*.lovable.app` URL, because
Phase 1 left every default pointing at the current services. That is the whole
reason Phase 1 changes no behaviour.

After cancelling, rollback means: redeploy the last good build to Cloudflare.
Keep the previous `.output` or rely on Cloudflare's deployment history.

---

## 9. What cannot be undone

- Cancelling Lovable loses the Lovable editor and its chat history.
- Rewriting git history to remove the leaked Maps key would lose the Lovable
  project history. **Do not do it.** Rotate the key instead.
- Deleting Supabase data. The migration never touches data, so this should never
  be necessary; see `docs/OPERATIONS.md` §5 for backups.
