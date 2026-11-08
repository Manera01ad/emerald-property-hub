# Documentation index

Start here, then follow the links. This folder is the source of truth for how the
product is built, operated and changed. Documents marked **historical** live in
[`archive/`](archive/README.md) and describe earlier states: do not follow them as
current instructions.

**Last reviewed:** 2026-11-08 (documentation reorganised; no product facts changed).

## Start here

| Order | Document | Why |
| --- | --- | --- |
| 1 | [`../README.md`](../README.md) | product summary and run commands |
| 2 | [`CURRENT_STATE.md`](CURRENT_STATE.md) | what works today; prioritised backlog |
| 3 | [`INDEPENDENCE_PLAN.md`](INDEPENDENCE_PLAN.md) | canonical completion plan |
| 4 | [`TESTING.md`](TESTING.md) | how to prove a change works |

## Architecture and data

| Document | Contents |
| --- | --- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | components, trust boundaries, hosting |
| [`DATA_FLOW.md`](DATA_FLOW.md) | clients, writes/reads, row-level security map |
| [`PRODUCT_MAP.md`](PRODUCT_MAP.md) | routes and modules (audited 2026-10-29) |

## Operations

| Document | Contents |
| --- | --- |
| [`OPERATIONS.md`](OPERATIONS.md) | run, deploy, verify and roll back the site |
| [`APPLY_RUNBOOK.md`](APPLY_RUNBOOK.md) | owner steps to apply pending SQL migrations |
| [`SQL_TEST_FINDINGS.md`](SQL_TEST_FINDINGS.md) | findings from the SQL test harness |
| [`COST_MODEL.md`](COST_MODEL.md) | free-tier limits and cost switches |
| [`TESTING.md`](TESTING.md) | test commands and rules |

## Agent team and CTO operations

| Document | Contents |
| --- | --- |
| [`cto/CTO_TEAM.md`](cto/CTO_TEAM.md) | roles, approvals and nightly operating rules |
| [`cto/CTO_RUNNER_ACTIVATION.md`](cto/CTO_RUNNER_ACTIVATION.md) | the gated GitHub Actions task runner |
| [`cto/CTO_OPENHANDS_PILOT.md`](cto/CTO_OPENHANDS_PILOT.md) | the disabled OpenHands QA workflow preview |
| [`cto/CTO_LOCAL_AGENT_HUB.md`](cto/CTO_LOCAL_AGENT_HUB.md) | one-time Windows agent readiness check (#62) |
| [`cto/CTO_FREE_OPENHANDS_LOCAL.md`](cto/CTO_FREE_OPENHANDS_LOCAL.md) | local Docker + Ollama OpenHands pilot |
| [`cto/CTO_FREE_QA_TASK.md`](cto/CTO_FREE_QA_TASK.md) | the pilot's QA-only task prompt |

## Evidence

Generated screenshots that back pull-request claims live in
[`../test-evidence/`](../test-evidence/README.md), not in this folder. The script
that produces them is `scripts/verify-journeys.mjs`.

## Archive

[`archive/`](archive/README.md) keeps superseded plans, audits and reports for
history: 11 documents plus the old root `roadmap.md`. It also holds the
[reorganisation decision record](archive/ORGANIZATION_PLAN.md) explaining why the
documentation was restructured on 2026-11-08.
