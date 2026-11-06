# CTO Orchestrator (v1): Safe GitHub queue and handoffs

This is the **first runnable component** of PropWise AI's multi-agent development coordinator. It uses only Node.js 20+ built-ins, reads GitHub Issues/PRs and creates an actionable queue with task-owner and file-overlap safeguards. It **does not** launch coding agents, spend API credits, change issues/labels, run SQL, merge PRs, deploy, or access production. Those functions need an owner-approved, independently sandboxed runner.

## Commands

```sh
node scripts/cto/orchestrator.mjs --mode report
node scripts/cto/orchestrator.mjs --mode queue --format json
node scripts/cto/orchestrator.mjs --mode packet --issue 53
node --test scripts/cto/orchestrator.test.mjs
```

For GitHub Actions or higher request limits set a **read-only** `GITHUB_TOKEN` in the runtime (not source files or issue comments). Public repositories can be read without a token within GitHub's anonymous API limits.

## How it communicates

| Component | Input | Output | Writes? |
| --- | --- | --- | --- |
| CTO router | GitHub issues #51–#55, open PRs and changed filenames | Markdown status, JSON queue, agent task packet | **No** |
| ChatGPT overnight CTO review | Same GitHub state | Review commentary, possible separately-reviewed safe PR | Bounded by existing approval rules |
| OpenHands / DeepSeek / Antigravity | A task packet supplied by an **approved runner** | Separate branch, tests and PR | Only inside an authorized sandbox |
| Owner | PR diff, CI evidence and risk | Approve/decline | Only owner merges/deploys/authorizes sensitive work |

## Activating agent execution later (owner approval required)

1. Confirm official runner identity and headless behavior. As of this design, OpenHands has a GitHub issue-resolver Action; DeepSeek Harness exposes `dsh --profile headless`; Antigravity CLI supports headless operation. None is automatically invoked by this repository script.
2. Isolate each job in a fresh temporary worktree/container with no production secrets, service-role key, browser profile or host directory access. Use scoped GitHub credentials only.
3. Verify the cost per task, sandbox capabilities, timeout, max iteration count and ability to stop jobs before enabling dispatch.
4. Create an **owner-reviewed** `.github/workflows/cto-router.yml` (do not modify `.github/` through an unapproved agent). It can run `node scripts/cto/orchestrator.mjs --mode queue` on schedule or `workflow_dispatch`, upload/report JSON, then dispatch **only explicitly owner-approved task labels** to supported runners. Never trigger on arbitrary issue text.
5. Give each agent one issue and one branch; require PR review, Verify + Security and owner merge. No autonomous prod changes.

A GitHub issue alone does not power on the user's desktop agents. A scheduling/task runner is required. Treat **queue generated** separately from **agent executed** and **PR merged**.

## Limits of v1

- Tracks the five current issues in a static, auditable registry; add new tasks only through reviewed code changes.
- Conflicts are determined from changed PR filenames, not inferred from speculative agent thought processes or unpushed local changes.
- API only fetches the first 100 open PRs and first 100 changed files per PR. For larger repos, add pagination before scaling.
- API issue bodies are never executed as commands. The task packet comes from a local allowlisted registry.
- A clean report does not establish that the live application is healthy.
