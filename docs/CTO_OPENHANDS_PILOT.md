# OpenHands QA pilot: owner-controlled preview

**Current state:** This workflow prepares the first QA task for OpenHands but **never launches an external agent**. GitHub workflow `.github/workflows/cto-openhands-pilot.yml` has a permanently hard-disabled execution job (`if: false`) and no schedule or issue/comment triggers. Nothing happens merely because this file is merged.

## Why this pilot

PropWise AI already has a CTO queue and a manual plan-only GitHub Actions workflow. The first external agent to connect is OpenHands, limited to **Issue #53: authenticated-flow QA**. The task packet is generated from reviewed instructions, not arbitrary GitHub issue/comment text. The implementation is intentionally smaller than deploying three agents at once.

The official action is pinned to **OpenHands/openhands-github-action@299f19e5122ec18b2b6ede744cbf51801096dc80** (the v1 Git commit verified during preparation). The action is specified only in a disabled job, and is not downloaded, run or billed by normal preview runs. Its official inputs include a prompt, repository, selected branch, timeout and an OpenHands API key.

## Owner dry run, after PR review/merge

1. Open **GitHub → Actions → CTO OpenHands QA Pilot (disabled)**.
2. Select **Run workflow**, choose branch `main` and `issue=53`.
3. Review the workflow summary and short-lived artifact `openhands-qa-preview-<run_id>`.
4. Expect `status.json` with `status=prompt-prepared` when #53 is still open and unclaimed, or `status=blocked` with reasons if it is already in progress or conflicts with an open PR.
5. Expect the summary to say **Agent launched: No**. No OpenHands API key is required for this preview.

The preview runs existing CTO tests plus eight dedicated QA-pilot safety tests. This code has not been proven by a live manual workflow run until the owner runs this step.

## Required approval before real execution

**Do not enable the disabled job by simply deleting `if: false`.** A separate reviewed PR and specific owner approval must establish all of these controls first:

- Confirm which OpenHands account/host, model and billing plan will execute the task. Verify the provider-enforced maximum **per job and per day**, not just the GitHub job timeout. Obtain explicit spending approval.
- Add a dedicated GitHub environment `cto-openhands-pilot` with required reviewer(s), no bypass and branch restrictions. Confirm it is actually protected rather than relying on the environment name alone.
- Keep credentials only in that protected environment. Never add the OpenHands API key to issue text, conversation, commit, `.env`, unprotected job or public artifact.
- Check which GitHub write permissions the OpenHands cloud account has. Do not reuse the owner's unrestricted credentials. It must create an isolated branch and draft PR, never update `main`, production data, RLS/auth code, deployments or workflows.
- Precreate/review a dedicated task branch, because the disabled action currently specifies `agent/qa-issue-53` as its target branch. Only allow `e2e/` and `src/test/` changes.
- Prove a no-cost or separately approved low-spend smoke test with exact outputs, verify task/PR overlap locks, and confirm cancellation handling.
- Only then propose a scheduled dispatcher for approved low-risk tasks. Never treat arbitrary `fix-me` labels or comments as authorization to spend money.

## How it fits the four-agent team

The CTO queue is the source of task identity, ownership, dependency and status. Antigravity owns buyer UI, DeepSeek owns assistant/backend, OpenHands handles tests/review. ChatGPT reviews PRs and coordinates GitHub. A future approved dispatch layer can launch agents without repeated prompts and hand off new PRs for human review, but **that dispatch layer is not active today**.

## Where to look

- Queue: `scripts/cto/orchestrator.mjs`
- Existing execution lock: `scripts/cto/prepare-run.mjs`
- OpenHands task preview: `scripts/cto/openhands-pilot.mjs`
- Tests: `scripts/cto/openhands-pilot.test.mjs`
- Team policy: `docs/CTO_TEAM.md`
- Control center: https://github.com/Manera01ad/emerald-property-hub/issues/50

References: https://github.com/OpenHands/openhands-github-action and https://docs.openhands.dev/openhands/usage/run-openhands/github-action
