# PropWise AI CTO agent hub: one-time Windows readiness check

**Stage:** Safe preflight only. GitHub Issue [#62](https://github.com/Manera01ad/emerald-property-hub/issues/62) tracks the unfinished agent connection. Existing #51–#55 remain separate development tasks.

The owner already uses **Ollama**, **DeepSeek** and **Antigravity** and wants OpenHands to join a coordinated, no-repeat-prompt development team. Having an application installed does **not** prove its command-line runner or local model has been configured.

## Do this once

1. After reviewing and approving the PR that added this document, open [`scripts/cto/local-agent-readiness.ps1`](../../scripts/cto/local-agent-readiness.ps1) in GitHub and select **Raw → Save as** in Downloads. Inspect the downloaded file before running it.
2. Open **Windows PowerShell**. Run the commands below from Downloads:

   ```powershell
   cd "$HOME\Downloads"
   .\local-agent-readiness.ps1
   ```

3. If Windows blocks the downloaded file, read the contents in Notepad. If you trust it and your computer policy permits it, unblock **only that file** with `Unblock-File .\local-agent-readiness.ps1`. Do **not** disable antivirus or globally weaken script execution policy.
4. Share the output titled `PropWise AI: local agent readiness` here. **Never share API keys, password screens, environment files, or personal account tokens.** This script doesn't read those.

The check is **read-only**. It does not download or install software, start an AI model, clone code, launch OpenHands, invoke DeepSeek/Antigravity, push to GitHub, or write data.

## What the results mean

| Result | What it tells us | What it does **not** prove |
| --- | --- | --- |
| Ollama model server & models | Local model API is reachable and reports installed models | Agentic coding capability, GPU memory, context window or speed |
| Docker engine & cached image | Docker Desktop is running and the earlier OpenHands image may already be cached | OpenHands is installed/configured or an agent job ran |
| DeepSeek Harness CLI (`dsh`) | Headless command is available on PATH | Account/model entitlement, available free tokens or a completed task |
| Antigravity CLI (`agy`) | Headless command is available on PATH | Authenticated model, usage cost or sandbox permissions |
| Git / Node / RAM | Core local prerequisites and rough hardware capacity | That all agents will work unattended on this PC |

**Do not enable paid API credentials** to make a check turn green. The report uses only a loopback GET to Ollama, read-only Docker diagnostics and OS/command lookup.

## Agent responsibilities (unchanged)

| Role | Tool | Task ownership |
| --- | --- | --- |
| CTO / reviewer | ChatGPT + GitHub | GitHub task assignments, architecture decisions, safe review and owner approval |
| AI/backend specialist | DeepSeek Harness | Issue #51: assistant and budget safety |
| UI developer | Antigravity CLI | Issue #52: lease, buyer journey and UX |
| QA developer | OpenHands | Issue #53: authenticated mock/staging quality tests |

The codebase already contains `scripts/cto/orchestrator.mjs`, a GitHub queue reader, and a manual OpenHands workflow. **Neither currently executes all three agents automatically.** The existing workflow execution gate remains disabled.

### Once the readiness check is green

- Run **one local QA pilot only**, in the isolated public clone using the existing `scripts/cto/local-openhands-free-pilot.ps1`. The model is local through Ollama, but may need more RAM/context than your machine has. First task: #53, mock-only; no production credentials or database.
- Independently verify `dsh --profile headless --help` and `agy --help` on your own computer (these are help commands, not agent task calls). A GUI-only installation may not place those commands on PATH.
- Prepare a separately reviewed local dispatcher with one active worker per workstream, isolated worktrees, timeouts, no automatic escalation, a log of real test results, no auto-merge/deploy and no paid calls unless the owner explicitly approves a cost cap.
- Do **not** open unattended tasks on production. Do not install `--dangerously-skip-permissions` or use `danger-full-access` to avoid prompts.

## Verified official headless interfaces

- DeepSeek Harness: `dsh --profile headless "task"`. <https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/headless/README.md>
- Antigravity CLI: `agy -p "task"`. <https://antigravity.google/docs/cli/headless/>
- OpenHands local model setup: <https://github.com/OpenHands/docs/blob/main/openhands/usage/llms/local-llms.mdx>

These are reference commands only, **not invoked by the readiness script**. Using an app or CLI with a paid cloud model can still incur usage charges; verify each provider before activation.

## Operational constraint

This setup runs on the **owner's Windows machine**, not magically in GitHub's cloud. The PC, Docker and Ollama model server must be on for local execution. GitHub's green "Prepare task packet" checks mean routing works, not that an agent coded overnight.
