# CTO Agent Runner: review, test and activation

**Status: prepared but NOT activated.** This document belongs with `.github/workflows/cto-agent-runner.yml`, the read-only GitHub Actions task preparation workflow. The first version does **not** use any AI model or paid API, launch Antigravity/DeepSeek/OpenHands, write to the repository, merge PRs, apply database SQL or deploy.

## What is working

GitHub Actions **workflow_dispatch** can create a task queue from the committed `scripts/cto/orchestrator.mjs` and a preflight packet for a selected issue. Only reviewed work orders #51–#55 are accepted; file conflicts, already-open PRs, closed issues, owner-only R3 work and wrong agent selections are blocked. The result is uploaded as a short-lived artifact and written in the workflow summary.

This workflow **has no schedule**, issue trigger, comment trigger, automatic dispatch, or installed coding-agent adapter. The ChatGPT CTO morning/nightly summaries are separate scheduled tasks and do not activate the three external agents.

## Owner's initial smoke test (no API keys required)

1. **Review** the GitHub PR that adds this workflow and its tests; require Verify and Security green. Merge only after approval. Changing workflows and GitHub runner permissions is an R3 operation.
2. Navigate to **Actions → CTO Agent Runner (gated) → Run workflow**.
3. Choose branch **main**, `mode=plan`, `issue=all`, `agent=auto`; run it once. This uses GitHub-hosted runner time but **does not** call a paid AI provider.
4. Read the job summary and download the `cto-plan-<run-id>` artifact. Verify it reports current issue states and `Agent launched: No`.
5. To verify issue packet generation, select `mode=plan`, `issue=53`, `agent=openhands` if #53 is still ready; an active PR or closed issue should correctly block it. Recheck issue status before interpreting the result.

Do **not** set `CTO_AGENT_EXECUTION_ENABLED` yet. Do **not** put provider keys in repository variables, issue comments, .env files committed to Git, or unprotected workflow steps.

## What "request-execution" means today

It is a **locked path** so the system can be tested without accidental billing. The preflight always reports a missing approved agent adapter. The optional `execution-locked` job is gated by all of:

- Manual `request-execution` dispatch (not schedule or issue comments).
- The owner account `Manera01ad` on the reviewed `main` branch.
- Repository variable `CTO_AGENT_EXECUTION_ENABLED=true` (not configured by this PR).
- A GitHub environment named `cto-agent-execution` (to be created and configured with a required owner reviewer before future activation).
- A separate owner-approved PR replacing the final intentional fail-closed step with a pinned, limited agent adapter.

**Even if the variable is mistakenly enabled**, this version's execution job exits unsuccessfully without running an AI tool. Don't interpret a green "prepare" job as an agent having run.

## One-time activation phase (requires fresh owner approval)

The next PR should connect **one agent at a time**, starting with the least risky and most verifiable workflow. For every adapter:

1. Independently verify the official integration, version/tag/commit pin and authentication model. Never dynamically execute an unpinned remote installer or a third-party repository script.
2. Create a **dedicated** GitHub environment with required reviewers and no bypass, restricted to the default branch. Required reviewers are available for public repositories; ensure the environment actually has protection before any secrets are configured. Do not rely on referencing a new, unconfigured environment as sufficient approval.
3. Use ephemeral GitHub-hosted runners and restricted per-agent credentials. No production service-role keys, migration strings, assistant AI production key, personal browser sessions, or local Windows drive access.
4. Set a provider-enforced spending cap, a small max-iterations budget, an execution timeout and a concurrency limit. A timeout alone does **not** guarantee a currency cap. Get owner signoff for a maximum cost per task and per day.
5. Dispatch only allowlisted, `ready` issues. Require an issue ownership claim and detect active PR conflicts; never execute issue body or comments as shell commands. Prompt content is untrusted data.
6. Use a branch for each change. Enforce Verify + Security and human approval; no automatic merging, deploy, schema changes or GitHub branch-rule edits.
7. Run a small dry-run issue, inspect the diff, cost and logs, then consider scheduled **dispatch** in another explicitly reviewed PR.

### Candidate agent adapters, NOT yet installed

- **OpenHands:** GitHub Action/integration exists, but needs its OpenHands API key, provider spend control and reviewed version. Documentation: https://github.com/OpenHands/openhands-github-action and https://docs.openhands.dev/openhands/usage/run-openhands/github-action
- **DeepSeek Harness:** official one-shot entrypoint `dsh --profile headless`. Its headless profile requires suitable model credentials and sandbox permissions; never enable unrestricted `danger-full-access`. Documentation: https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/headless/README.md
- **Antigravity:** CLI headless mode is available, but authentication, availability and scoped permissions in Linux CI must be proved. Never use `--dangerously-skip-permissions`. Documentation: https://antigravity.google/docs/cli/headless/

## Safety checks and proof

```sh
node --test scripts/cto/orchestrator.test.mjs scripts/cto/prepare-run.test.mjs
node scripts/cto/orchestrator.mjs --mode queue --format json
```

The read-only planning workflow also runs these tests. CI's Test and build and Security checks remain required for every PR. Work orders are statically allowlisted in the existing router; new tasks require a reviewed registry update.

## Known limits

- This is **not yet fully unattended development**. Actual agent launch adapters, GitHub environment settings, authentication, billing caps and any schedule need explicit approval and configuration.
- GitHub-hosted Actions runner usage may still count toward account limits, although no AI-provider cost is incurred by this planning job.
- Queue conflict detection only sees open PRs, not unpublished local edits in other agents' machines. An issue that stays open after a merged PR still requires the CTO to update acceptance state to prevent duplicate attempts.
- Live database/auth/storage access is not obtained or needed by this workflow.
