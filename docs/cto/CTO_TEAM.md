# PropWise AI — CTO Team Operating System

**Version:** 2026-11-07. **Status:** operational policy proposed in a documentation-only pull request; adoption requires owner review and merge. **Control center:** [GitHub Issue #50](https://github.com/Manera01ad/emerald-property-hub/issues/50).

## One-sentence mission

Complete and operate the existing **independent** PropWise AI Chennai-first buy/rent/lease decision platform with trustworthy evidence, manageable costs and a clear path to users. **Do not restart a Lovable migration.**

This document is not a coding agent or server. It specifies the work orders and guardrails that connected coding tools and scheduled ChatGPT checks should follow. It does **not** automatically launch Antigravity, DeepSeek Harness or OpenHands; they need separately configured executors and permissions.

## Sources of truth

1. **GitHub main:** shipped code. Inspect the latest state before every change.
2. **`AGENTS.md`:** mandatory engineering safety rules. Two keys for every merge: green Verify + owner approval. No agent self-merges, deploys, uses production secrets or applies SQL.
3. **`docs/INDEPENDENCE_PLAN.md`:** product strategy and architectural constraints.
4. **`docs/CURRENT_STATE.md`:** dated repository inventory and findings, not proof of today's production backend.
5. **Issue #50:** product/engineering board; each actionable task gets a linked issue and exactly one owner.
6. **Pull request:** the only route for implementation. Requires evidence, tests, rollback and user-impact statement.

When docs conflict, current owner decisions and verified code/runtime evidence supersede dated status notes. Avoid re-running broad audits already completed.

## Four roles and non-overlapping work

| Seat | Primary output | Currently assigned area | Avoid |
| --- | --- | --- | --- |
| **ChatGPT, acting CTO/product integrator** | Priorities, small safe PRs, cross-PR code review, approvals requested, nightly summary | #50, #55; code fixes outside other agents' active files | Claiming to control other agents' computers or run continuously without automation |
| **Antigravity, user-journey developer** | UI implementation, browser tests, screenshots, small PRs | #52 buy/rent/lease and property user journey | AI backend/budget internals |
| **DeepSeek Harness, AI/backend specialist** | AI fault isolation, deterministic tests, small PRs | #51 assistant 503, budgeting and safe refusal | UI scope owned by Antigravity; production SQL |
| **OpenHands, QA/reliability reviewer** | Regression tests, code review and independent evidence | #53 authenticated staging test plan | Broad audit loops, editing dependencies or installing bypasses |

One agent = one branch = one issue = one bounded problem. If two changes touch the same file, hold the lower-priority task until the first PR is resolved. No speculative feature rewrites.

## Approvals: what exceptional authorization does and does not mean

| Level | Examples | Autonomous actions allowed | Owner action required |
| --- | --- | --- | --- |
| **R0: read-only** | Source review, tests in safe sandbox, task planning, GitHub comments, issue updates | Yes | None |
| **R1: reversible safe development** | Docs, isolated pure utilities and tests, small refactors with no permission/config impact | Branch, commit, test, PR | **Review/approval before merging** |
| **R2: customer-visible or moderate-risk changes** | UI flows, AI prompts/models/pricing config, data queries, feature flags, package/removal changes | Prepare PR with evidence; not deploy | Explicit owner review and verified checks |
| **R3: sensitive or irreversible** | Production DB changes/backups, migrations, credentials, RLS/auth/security, billing, external paid agents/APIs, deletion of user data, domain/DNS, deploy, CI/branch protection edits | Read-only diagnosis or proposal only | Separate explicit authorization for the exact action |

The owner permits autonomous **preparation** of low-risk work, not unrestricted credentials, spending, deployment or merging. If uncertain, escalate classification. Never bypass budget guards to make a feature appear healthy. No unrestricted local host permissions; use isolated CI where possible. Redact secrets and personal information.

## Delivery workflow (every task)

1. **Intake:** write a GitHub issue with observable user problem, target owner, exact scope, priority and acceptance tests.
2. **Claim:** agent comments with planned branch and files; only one claimant per path.
3. **Implement:** new branch off current main, minimal diff; keep tests adjacent; no direct push to main.
4. **Prove:** run targeted and full tests/build/typecheck as available, check CI, and state any environment restrictions. Never call a failed local test 'passed' because a temporary dependency shim was used.
5. **Review:** PR must state problem, changed files, tests passed/blocked, missing integration evidence, data/security/cost/public impact, rollback.
6. **Approve:** green Verify + owner review; owner handles production-affecting action and any release.
7. **Close:** link merged PR from task issue; record proof of real user journey in current environment and update `docs/CURRENT_STATE.md` only for genuinely changed status.

### Stop conditions

Halt a task and return a blocking issue if: a required privilege is unavailable; any action would touch production data or secrets; a dependency asks for danger-full-access; a paid provider/model can incur unbounded cost; a test requires changing installed dependencies; or an agent would edit a file another agent already owns. Report a specific safer alternative.

## Sprint queue and definition of done

**Now:** #51 Assistant availability with fail-closed budget enforcement; #52 lease preferences and end-to-end discovery; #53 authenticated staging QA. PR #48 verification date guards and #49 agent-contract correction are awaiting owner review at plan creation time. Always check current GitHub status; do not assume this paragraph stays current.

**Next:** #54 independent build dependency cleanup after core journeys pass; #55 safe code/doc cleanup; reliable provenance and pricing context; data-source authorization; simplify admin and consultation path.

**Launch gate:** a first-time buyer/renter can discover, compare and ask a question, receive honest evidence/limitations, save a report or enquire; admin can review; published/permissioned records only; private records remain private; AI costs fail closed; rollback and monitoring documented. Green unit tests alone do not prove live user journeys.

## Nightly CTO loop and morning delivery

### Night review (scheduled when enabled)

1. Read Issue #50 and linked #51–#55, latest main, open PRs and workflow conclusions. Use no secrets.
2. Deduplicate ownership and flag incompatible PRs.
3. If permitted and realistically verifiable with tools provided: produce **at most one small, isolated R1** docs/test/pure-logic PR from an unowned issue, with no restricted file changes; otherwise add a succinct blocker/recommendation to #50. Never fabricate test results.
4. Inspect review requirements; record ready PRs, red CI, model-cost/migration/auth blockers. Do not merge/deploy/apply SQL.
5. Summarize completed work, pending review and top three next actions. Do not claim that an external agent executed overnight unless there is a visible GitHub branch/PR and check evidence.

### Automation boundary

A ChatGPT scheduled task can revisit GitHub and report, and may perform a scoped GitHub action if its connected environment permits. It **cannot by itself keep Antigravity, DeepSeek Harness and OpenHands running on their local computers overnight**. True autonomous coding requires each tool's supported queue/runner, a secured service account, bounded spending and owner-approved configuration. Until then use GitHub Issues/PRs plus scheduled review rather than pretend there is an always-on four-agent swarm.

### Daily summary format

**Built:** PR #, changed behavior, test result. **Review:** PR #, why approval needed. **Blocked:** exact missing fact/access; risk level. **Next:** three issue IDs, owner, acceptance condition. **Cost:** confirmed expenditure or “not measured”, never imply ₹0 without evidence.

## Minimal owner interaction

The owner reviews PR diffs and checks in GitHub, approves only changes they understand, and personally authorizes risky actions. No repeated prompt-pasting: assign one issue URL to each external agent once, and instruct it to work only on its claimed issue(s) according to this operating contract. If that platform cannot auto-poll issues, the handoff must be configured through its supported tooling; the issue alone does not start it.

## First backlog links

- [#50 CTO Control Center](https://github.com/Manera01ad/emerald-property-hub/issues/50)
- [#51 AI assistant reliability](https://github.com/Manera01ad/emerald-property-hub/issues/51)
- [#52 Lease seeker preferences](https://github.com/Manera01ad/emerald-property-hub/issues/52)
- [#53 Authenticated staging QA](https://github.com/Manera01ad/emerald-property-hub/issues/53)
- [#54 Build and package independence](https://github.com/Manera01ad/emerald-property-hub/issues/54)
- [#55 Safe code/documentation cleanup](https://github.com/Manera01ad/emerald-property-hub/issues/55)
