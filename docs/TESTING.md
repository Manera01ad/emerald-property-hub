# Testing

Companion to `docs/INDEPENDENCE_PLAN.md`. How to prove a change works before it ships.

---

## 1. The commands

| Command | What it runs | Blocking? |
| --- | --- | --- |
| `bun run test` | Vitest unit/component tests | **yes** |
| `bun run build` | Production build | **yes** |
| `bun run check:docs` | Relative-link check across Markdown | reported |
| `bun run type-check` | `tsc --noEmit` | reported |
| `bun run lint` | ESLint | reported |
| `bun run test:e2e` | Playwright browser tests | optional |

The two blocking checks are the **machine key** in `AGENTS.md`. A pull request
that fails either does not merge.

Current baseline (2026-11-08, `main` @ `33f4c9d`): 66 test files and 603 tests
pass. `bun run build` passes in CI.

**Windows note:** `bun run build` currently fails on Windows inside the
`@lovable.dev/mcp-js` Vite plugin, which compares resolved paths without
normalising separators (`C:/...` against `C:\...`). The app build itself succeeds
once that comparison is normalised. Use CI, or a Linux/macOS checkout, for the
build gate; do not treat the Windows failure as a code regression.

---

## 2. Where the tests live

Five locations, deliberately:

| Location | Runner | What belongs there |
| --- | --- | --- |
| `src/**/*.test.ts(x)` | Vitest | most unit and component tests, colocated with the code |
| `src/test/` | Vitest | `setup.ts` plus cross-cutting tests (routing, build config, navigation, public copy) |
| `scripts/cto/*.test.mjs` | `node --test` | agent-harness and policy tests; run with `node --test scripts/cto/*.test.mjs` |
| `e2e/` | Playwright | smoke, accessibility and responsive browser checks |
| `scripts/verify-journeys.mjs` | Node + Playwright | evidence generator; writes `test-evidence/`, not a gate |

Do not create a duplicate suite elsewhere. New logic gets a colocated test; a
browser-only concern gets an `e2e/` spec; a policy rule gets a `scripts/cto`
suite.

---

## 3. What the suite covers

- **Pure logic** — the bulk. Calculators, visibility rules, evidence handling,
  transaction maths, research rules, budget and cost arithmetic. These run with
  no database and no network, which is why they are fast and reliable.
- **Route handlers** — for example `src/routes/api/public/research/tick.test.ts`
  exercises the route object the framework registers, so a change to a handler
  fails the test.
- **Components** — a few React component tests (for example
  `src/components/DocumentScreen.test.tsx`).
- **Browser (Playwright, `e2e/`)** — layout and accessibility, which jsdom
  cannot check. This is why they exist: two real UI defects shipped with a fully
  green unit suite.

---

## 4. Rules for adding tests

1. **Test real code paths, not mocks.** Mocks are a last resort and must be
   justified in the pull request.
2. **New logic gets a test.** If a function decides something (a price, a
   visibility, a limit), it gets a test.
3. **Test the seam you changed.** The migration added `src/lib/site.ts` and the
   AI provider resolution; both have tests (`site.test.ts`,
   `pricing.test.ts`) because those are the new boundaries.
4. **Regression tests name the bug.** A test that guards a past defect says so in
   a comment, so nobody deletes it as redundant.
5. **Do not test the framework.** Test your decision, not that React renders.

---

## 5. What a pull request must state (from `AGENTS.md`)

1. What problem this solves.
2. What exactly changed.
3. How it was tested.
4. **What was not tested, and what remains uncertain.**
5. Whether it can affect security, data, or the public site.

Point 4 is the important one. "I could not exercise the photo-upload path
because it needs a live database" is more useful than a confident claim that
turns out to be wrong.

---

## 6. Testing the migration specifically

| Change | How it is proven |
| --- | --- |
| URL de-coupling | `site.test.ts`; `bun run build`; check a page's canonical tag |
| Auth swap | Manual: email and Google sign-in on the deployed site |
| AI provider | `pricing.test.ts`; manual: assistant off with no key, answers with one |
| Secret renames | The code reads the new name first; the old name still works |
| Build-config swap | `bun run build` on a clean clone; deploy to Cloudflare |
| Deploy | The §4 checklist in `docs/OPERATIONS.md` |

Anything that needs a live backend or a browser is a **manual** check, and the
plan marks it as such rather than pretending the unit suite covers it.
