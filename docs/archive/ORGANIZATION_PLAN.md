# Repository organisation plan (OpenHands-inspired)

> **Status: Phase 1 approved and implemented on 2026-11-08.** This document is kept
> as the decision record for the move; it is not current guidance. See
> [`../README.md`](../README.md) for the current documentation index.
> Phase 2 (`.agents/skills` + PR template) and Phase 3 (tests/tooling tidy) still
> need separate approval.

**Date:** 2026-11-08
**Prepared on:** branch `dsh-6d0a0616-92a8` (scratch worktree)
**Covers:** `docs/` and root markdown · code/test/tooling layout · OpenHands agent-context files

---

## 1. Short answer

OpenHands/OpenHands is a useful model for **conventions**, not for layout. Its top level is large
because it ships an Electron desktop app, a Helm chart, Docker images and an npm package.
Emerald Property Hub is a TanStack Start app deployed as a Cloudflare Worker: copying those
directories would add CI and packaging cost with no benefit.

Five OpenHands conventions are worth copying, and they are the whole of this plan:

1. **`docs/README.md` as an index** — one line per document, with canonical/historical labels.
   You currently have 27 loose docs in `docs/` plus `roadmap.md` at the root.
2. **`docs/archive/` for superseded plans**, so current documents stay obvious.
3. **`.agents/skills/<area>/SKILL.md` with `AGENTS.md` as the router** — area rules load only
   when relevant instead of every agent reading everything.
4. **One home for generated proof** (`test-evidence/`), kept separate from documentation.
5. **A pull-request template** that forces the five evidence points `AGENTS.md` already demands.

**What I recommend *not* doing:** restructuring `src/`, moving tests to a root `tests/`,
splitting root config files into `config/`, or copying `electron/`, `helm/`, `docker/`, `bin/`,
`tools/`, `.openhands/setup.sh`, `release-please`, or OpenHands' five Playwright configs.
Reasons are in §7; the honest summary is that those moves cost review effort and import
rewrites while adding no control the repository lacks.

---

## 2. Target layout after all phases

```
.
├── AGENTS.md                       # contract + router table pointing to .agents/skills
├── README.md                       # product entry; links to docs/README.md
├── .agents/
│   └── skills/                     # NEW: area rules, one folder each
│       ├── repo-map/SKILL.md
│       ├── supabase-rls/SKILL.md
│       ├── research-engine/SKILL.md
│       ├── assistant-budget/SKILL.md
│       ├── buyer-maths/SKILL.md
│       ├── mcp-integration/SKILL.md
│       ├── public-site/SKILL.md
│       ├── cto-queue/SKILL.md
│       └── verification/SKILL.md
├── .github/
│   ├── CODEOWNERS                  # unchanged
│   ├── PULL_REQUEST_TEMPLATE.md    # NEW
│   └── workflows/                  # unchanged paths
├── docs/
│   ├── README.md                   # NEW index + status board
│   ├── INDEPENDENCE_PLAN.md        # canonical, stays
│   ├── CURRENT_STATE.md            # canonical, stays
│   ├── ARCHITECTURE.md  DATA_FLOW.md  PRODUCT_MAP.md
│   ├── OPERATIONS.md  APPLY_RUNBOOK.md  TESTING.md
│   ├── COST_MODEL.md  SQL_TEST_FINDINGS.md
│   ├── cto/                        # NEW: 6 CTO / agent-ops docs
│   ├── archive/                    # NEW: 11 superseded docs + roadmap.md
│   └── evidence/                   # removed (see test-evidence/)
├── test-evidence/                  # NEW: 12 generated screenshots
├── e2e/                            # unchanged (browser tests)
├── scripts/                        # unchanged: cto/, sql-check/, verify-journeys.mjs
├── src/                            # unchanged layout
├── drizzle/  supabase/  public/    # unchanged
└── root config files               # unchanged — tools must find them here
```

Net effect: no current document contradicting another at the same level; 12 files archived
(11 docs + `roadmap.md`); 6 grouped under `docs/cto/`; 12 generated images separated; agents get
a map instead of 327 files.

---

## 3. Phase 1 — documentation and evidence (one PR, no app code)

### 3.1 Moves (`git mv`; history preserved)

**Keep in `docs/` (10)** — canonical or procedure, and several are referenced by scripts:

| File | Why it stays |
| --- | --- |
| `INDEPENDENCE_PLAN.md` | canonical plan (`AGENTS.md`) |
| `CURRENT_STATE.md` | canonical state (`AGENTS.md`); read by CTO scripts |
| `ARCHITECTURE.md`, `DATA_FLOW.md` | current architecture + data/RLS map |
| `PRODUCT_MAP.md` | current route/module map |
| `OPERATIONS.md` | deploy/rollback; supersedes `runbook.md` |
| `APPLY_RUNBOOK.md` | read by `scripts/sql-check/` |
| `TESTING.md` | read by CTO scripts; current test rules |
| `COST_MODEL.md` | current cost limits |
| `SQL_TEST_FINDINGS.md` | read by `scripts/sql-check/` |

**Move to `docs/cto/` (6)** — one topic: the agent/CTO operating system:

`CTO_TEAM.md`, `CTO_RUNNER_ACTIVATION.md`, `CTO_OPENHANDS_PILOT.md`,
`CTO_LOCAL_AGENT_HUB.md`, `CTO_FREE_OPENHANDS_LOCAL.md`, `CTO_FREE_QA_TASK.md`

**Move to `docs/archive/` (11 + 1)** — superseded, overlapping or stale, kept for history:

| File | Classification |
| --- | --- |
| `PLAN.md` | historical by `AGENTS.md` |
| `LOVABLE_EXIT.md` | historical by `AGENTS.md` |
| `runbook.md` | duplicate of `OPERATIONS.md` |
| `PULL_REQUEST.md` | a checked-in PR body; images use absolute `C:/Users/...` paths |
| `audit-2026-10-29.md` | dated audit snapshot |
| `architecture-pan-india.md` | unapplied proposal |
| `FEATURE_INVENTORY.md` | superseded by `CURRENT_STATE.md §2` |
| `integration-plan.md` | dated branch working plan |
| `IMPLEMENTATION_TRACKER.md` | superseded by `CURRENT_STATE.md` |
| `DELIVERY_REPORT.md` | report; overlaps `RELEASE_AUDIT.md` |
| `RELEASE_AUDIT.md` | report; overlaps `DELIVERY_REPORT.md` |
| `roadmap.md` (root) | stale, 22 lines, referenced only by `PLAN.md` |

### 3.2 New files in this phase

- `docs/README.md` — index: one line per doc, grouped as **Start here / Current / Guides /
  CTO / Archive**, each marked canonical or historical. Start-here path:
  `README.md → docs/CURRENT_STATE.md → docs/INDEPENDENCE_PLAN.md → docs/TESTING.md`.
- `docs/archive/README.md` — one paragraph: "these are historical; do not treat as current",
  date and the reason they were archived. Archive files are frozen except for link fixes.
- `test-evidence/README.md` — what each screenshot proves, the command that regenerates it,
  and the commit/date it was captured.

### 3.3 Evidence move (same PR, or split into its own if you prefer)

- `docs/evidence/*.png` (12 files, 1.8 MB) → `test-evidence/*.png`, names unchanged.
  These are generated output, not documentation.
- `scripts/verify-journeys.mjs:5` — `resolve("docs/evidence")` → `resolve("test-evidence")`.
- `docs/archive/PULL_REQUEST.md` — seven absolute `C:/Users/...` image paths → relative
  `../test-evidence/...`; five of the twelve screenshots are currently unreferenced.

### 3.4 Links and references that must change in the same PR

| File | Change |
| --- | --- |
| `README.md` (lines 8–18) | `PLAN.md`/`LOVABLE_EXIT.md` → `docs/archive/...`; `CTO_TEAM.md` → `docs/cto/...`; add `CURRENT_STATE` and `docs/README.md` (currently the entry page never links the canonical state doc) |
| `AGENTS.md` | platform-status block: `docs/PLAN.md` → `docs/archive/PLAN.md`, same for `LOVABLE_EXIT.md` (canonical paths unchanged) |
| `.github/workflows/verify.yml` (line 7 comment) | `docs/PLAN.md` → `docs/archive/PLAN.md` |
| `scripts/cto/orchestrator.mjs` | prompt string `docs/CTO_TEAM.md` → `docs/cto/CTO_TEAM.md` |
| `scripts/cto/openhands-pilot.mjs` | same |
| `docs/ARCHITECTURE.md` | five `PLAN`/`LOVABLE_EXIT` references |
| `docs/OPERATIONS.md` | `PLAN` ×2, `runbook` ×3 |
| `docs/COST_MODEL.md`, `docs/TESTING.md` | `PLAN` references |
| `docs/INDEPENDENCE_PLAN.md` §5 | preferred-docs list |
| `docs/CURRENT_STATE.md` (lines 9–11) | companion links |
| `docs/PLAN.md`, `docs/LOVABLE_EXIT.md`, other archived docs | internal relative links gain `../` |

`APPLY_RUNBOOK.md`, `SQL_TEST_FINDINGS.md`, `CURRENT_STATE.md`, `TESTING.md` are **not moved**,
so the `scripts/sql-check/` and CTO scope references keep working untouched.

**Risk:** documentation only; no build or test behaviour changes. The only executable change is
two prompt strings in `scripts/cto/`, covered by `node --test scripts/cto/*.test.mjs`.
**Revert:** `git revert` restores all paths because moves are recorded as renames.

---

## 4. Phase 2 — OpenHands-style agent context (one PR)

### 4.1 `.agents/skills/` (new)

Nine small files, each ~25–40 lines: when to use, invariants, where the code lives, what not to
touch. Content comes from rules already written in `AGENTS.md`, `ARCHITECTURE.md`,
`CURRENT_STATE.md` and `docs/cto/` — this is mostly *relocation and indexing*, not new policy.

| Skill | Covers |
| --- | --- |
| `repo-map` | where everything lives (the tree in §2); stops agents scanning 327 files |
| `supabase-rls` | browser client + RLS, public-visibility rule, private photo bucket + signed links, `app_settings` rates, first-admin trigger |
| `research-engine` | `src/lib/research` pure core + server I/O, admin client only from scheduler/admin function, scheduler token, `research_ticks`, authorised+enabled sources, draft-only output |
| `assistant-budget` | token verification, chat RLS, server-side AI keys, cost/budget modules |
| `buyer-maths` | pure `src/lib/buyer.ts`, `buyer_profiles`/`buyer_reports` RLS |
| `mcp-integration` | `src/lib/mcp`, one tool per file, OAuth sign-in, re-apply visibility filter |
| `public-site` | head metadata + sitemap publishable client, static-route decisions, keyless Leaflet maps |
| `cto-queue` | `scripts/cto` queue, issue ownership claims, allowlisted scopes, no push/merge/deploy |
| `verification` | commands, tiers, evidence points, **where the five test locations are**, never run `drizzle-kit` |

### 4.2 `AGENTS.md` becomes a router — without losing the contract

`AGENTS.md` is only 107 lines, so I do **not** recommend cutting it in half. Instead:

- Keep all normative content in `AGENTS.md`: platform status, two-key rule, never-list,
  change tiers, evidence points, secrets, checks, PR size.
- Compress the long *architecture* bullet list into a short invariants summary that names the
  matching skill, e.g. "Data access, RLS and public visibility → `.agents/skills/supabase-rls`".
- Add a **Skills** table (area → path → when it applies), matching OpenHands' router pattern.

Result: no rule disappears, and agents stop loading detail they do not need.

### 4.3 Pull-request template (`.github/PULL_REQUEST_TEMPLATE.md`)

Exactly the five evidence points from `AGENTS.md`, plus a `HUMAN:` section reserved for the
owner that agents must not edit (an OpenHands convention that reinforces your two-key rule),
plus checkboxes: Verify green, no secrets, no migration applied, no deploy.

### 4.4 Two small safeguards

- `.gitignore`: add `.agents/worktrees/`. DeepSeek Harness creates local worktrees under
  `.agents/`; without this rule `git add .agents` could commit scratch checkouts of the repo.
- Do **not** add `.openhands/` yet. In OpenHands' repository it holds only `setup.sh`, a
  bootstrap for its hosted sandbox; your local Canvas pilot already mounts a real clone and
  reads `AGENTS.md`. Add it only if you enable the cloud GitHub Action.

**Risk:** no executable code. `AGENTS.md` is the file agents must obey, so it needs the owner's
read before merging. **Revert:** revert the commit.

---

## 5. Phase 3 — tests, tooling and naming (one small PR)

Your `AGENTS.md` promises "tests and build" as the gate; the layout should make that obvious.
Recommendation: **document, do not move.** OpenHands itself colocates unit tests
(`src/root.test.tsx`) and keeps only browser tests in `tests/e2e/` — your 66 colocated test
files are already the conventional shape.

| Action | Detail |
| --- | --- |
| Document the five test locations | `docs/TESTING.md` + `verification` skill: vitest colocated, `src/test/` (setup + 4 cross-cutting), `node:test` in `scripts/cto/`, Playwright in `e2e/`, generator `scripts/verify-journeys.mjs` |
| Rename package | `package.json` `"name": "tanstack_start_ts"` → `"propwise-ai"` (private package; nothing imports it) |
| Optional | move `scripts/verify-journeys.mjs` → `e2e/generate-evidence.mjs`; it is browser tooling, not a shell helper |
| Optional | add `scripts/check-docs-links.mjs` (Node, ~40 lines) to fail on broken relative links in `docs/` |

**Owner decision, not an agent change:** `scripts/cto/orchestrator.mjs` allowlists only
`e2e/` and `src/test/` as writable scopes, but 55 of your 66 test files are colocated with
source. Either widen the allowlist to colocated `*.test.ts(x)` or accept that agents cannot
touch most tests. This is a control change — your call, in its own reviewed PR.

Wiring a link check into `.github/workflows/verify.yml` is a `.github/` change, which
`CODEOWNERS` reserves for you.

---

## 6. Deferred on purpose (explicitly *not* in these phases)

| Idea | Why not now |
| --- | --- |
| Split flat `src/lib` (117 files) into `core/`, `data/`, `server/` | Rewrites many imports and touches `CODEOWNERS` Tier-3 paths (`research`, `visibility`, `supabase`, server functions). Review risk is high, gate value zero. Revisit only as a deliberate, isolated refactor |
| Create root `tests/` and move `src/test/` | 66 files and imports change; CI gains nothing; OpenHands keeps tests colocated |
| Move configs into `config/` | Vite, vitest, Playwright, eslint, drizzle and tsconfig must sit at the root; OpenHands' own root is messier than yours |
| Copy `.openhands/setup.sh`, `electron/`, `helm/`, `docker/`, `bin/`, `tools/`, `release-please` | Desktop/K8s/npm packaging for a Worker deployment; pure maintenance cost |
| Merge or delete archived docs, consolidate the five CTO runner docs | Content decisions, not moves. Do after Phase 1, in a dedicated PR |
| Remove Lovable packages and `.lovable/` | `AGENTS.md` allows it only after proving unused; separate cleanup PR (see §8.5) |

---

## 7. Found while auditing — five risks that matter more than folder names

These are not part of the reorganise PRs, but you should know them before agents are pointed at
this repository.

1. **`bun.lock` is pinned to Lovable's private registry.** 208 resolved URLs point at
   `europe-west1-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache`. `Verify` runs
   `bun install --frozen-lockfile`, so CI and every fresh clone depend on that cache staying
   reachable. If Lovable access ends, installs fail — a build-continuity risk, not a style issue.
   Fix: regenerate the lockfile against public npm in a throwaway branch, then prove
   `bun install && bun run test && bun run build`. Owner-only.
2. **`drizzle-kit` is a live trap.** `drizzle/schema.ts` is one comment line
   ("auto-generated and intentionally left blank"), `drizzle.config.ts` points at it, and
   `drizzle-orm` is imported nowhere in `src/`. Running `drizzle-kit generate` or `push` would
   diff an empty schema against the database. `drizzle/pending/0017–0021` also collides with the
   already-applied `0017`/`0018` numbering. Fix: delete the drizzle tooling or mark it clearly
   disabled; until then the `verification` skill says "never run drizzle-kit".
3. **`supabase/` implies a schema that does not exist.** `supabase/config.toml` is one line
   (`project_id`), yet a test asserts its contents. The schema source of truth is the hand-written
   SQL in `drizzle/migrations/` plus `drizzle/pending/`; `supabase start` cannot work. Document
   this, do not move the folder.
4. **No `wrangler.toml`** although `README.md` documents a wrangler deploy; the config is
   generated into `.output/server/wrangler.json` by the build. Fine — worth one sentence in
   `OPERATIONS.md`.
5. **Lovable residue in the dependency graph.** `@lovable.dev/cloud-auth-js` has zero importers;
   `bunfig.toml` exempts two `@lovable.dev` packages that are not dependencies; and
   `.lovable/mcp/manifest.json` still names an old project ref. `@lovable.dev/mcp-js` and
   `@lovable.dev/vite-tanstack-config` are used (generated MCP routes; the `@` alias lives in that
   plugin) — do not remove those two without replacing the alias configuration first.

---

## 8. OpenHands adopt / adapt / skip

| OpenHands convention | Verdict here |
| --- | --- |
| `docs/README.md` index, flat canonical docs | **Adopt** |
| `docs/archive/` for superseded plans | **Adopt** |
| `.agents/skills/<area>/SKILL.md`, `AGENTS.md` as router | **Adopt** (light version: contract stays in `AGENTS.md`) |
| `test-evidence/` for committed proof | **Adopt** |
| `.pr/<change>/` per-change review bundles | **Adapt** → `test-evidence/` + PR template; no separate `.pr/` tree for a solo owner |
| AGENTS.md "PR description human check" (`HUMAN:` section) | **Adopt** |
| Colocated unit tests, `tests/e2e/` only at root | **Already matches** — keep `e2e/` and colocated tests |
| `.openhands/setup.sh` | **Skip** (hosted-sandbox bootstrap; your pilot mounts a clone) |
| `tools/`, `bin/`, `electron/`, `helm/`, `docker/`, `vercel.json` | **Skip** |
| Five Playwright configs, multiple tsconfigs, release-please, `.npmignore` | **Skip** |

---

## 9. How each phase is verified

| Phase | Checks |
| --- | --- |
| 1 | all links in `docs/` and `README.md` resolve (link check); `node --test scripts/cto/*.test.mjs`; grep for the 12 old paths returns only archive-internal references; CI `Verify` green |
| 2 | `AGENTS.md` still contains every normative rule (diff review); skills reference real paths; `git status` shows no `.agents/worktrees`; CI `Verify` green |
| 3 | `node --test scripts/cto/*.test.mjs`; `node scripts/check-docs-links.mjs`; CI `Verify` green |

**Important limitation:** this machine has Node 22 but **no Bun** (`bun` is not on PATH), and
`bun run test` / `bun run build` are the blocking gate. So I cannot reproduce `Verify` locally
today. Two options: install Bun first (`npm install -g bun`, or winget `Oven-sh.Bun`), or accept
Node-only checks locally and let CI `Verify` be the proof. I have not run either command yet —
this plan touched only this file.

Also not verified and worth knowing: which `drizzle/pending/` migrations are actually applied
(needs the database), whether `bun install --frozen-lockfile` succeeds without Lovable registry
access, and whether `src/routes/mcp.ts` / `[.well-known]/` are regenerated during `vite build`.

---

## 10. Decisions I need from you

1. **Archive list** — approve the 11 docs + `roadmap.md` moving to `docs/archive/`? Anything
   there you still use as current (for example `IMPLEMENTATION_TRACKER.md`)?
2. **`docs/cto/`** — group the six CTO docs under one folder, or keep them flat in `docs/`?
3. **Evidence** — move `docs/evidence/` to `test-evidence/` (recommended), or keep it?
4. **Agent context** — approve `.agents/skills/` + the light `AGENTS.md` router, and the
   `.gitignore` rule for `.agents/worktrees/`?
5. **PR template** — add `.github/PULL_REQUEST_TEMPLATE.md` with the `HUMAN:` section?
6. **Test policy** — widen the CTO agent allowlist to colocated tests, or leave it?
7. **Deferred refactor** — is `src/lib` splitting ever wanted, or should it be ruled out?
8. **Risk fixes (§7)** — do you want separate PR drafts for the lockfile and the `drizzle-kit`
   trap after the organisation work?

On approval I will implement **Phase 1** first (a single docs-and-evidence PR-sized change in a
clean branch), show you the diff and the verification output, then stop for review before
Phase 2. `gh` is not authenticated in this environment, so I prepare branches and commits; you
push and open the PRs.
