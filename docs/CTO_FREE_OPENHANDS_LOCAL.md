# PropWise AI: free local OpenHands QA pilot (Windows)

**Purpose:** run a first QA experiment on **Issue #53** without a paid LLM API, production credentials, or changing the current GitHub Actions workflows. This uses **OpenHands Agent Canvas in Docker** + a **locally hosted Ollama model** on the owner's Windows PC.

**Cost boundary:** no paid model API key is supplied or used by this setup. The public Git clone, Ollama model download, Docker image and local inference use internet data, disk space, electricity and your hardware. Running a local model can be slow or unreliable for complex coding. **This setup is not an always-on cloud coding agent**; the PC and Docker/Ollama must remain running.

The GitHub Action in `.github/workflows/cto-openhands-pilot.yml` remains hard-disabled and is intentionally **not touched**. Do not set `CTO_AGENT_EXECUTION_ENABLED` or `OPENHANDS_API_KEY` for this local pilot.

## Step 1: Download and run the safe check

Download `scripts/cto/local-openhands-free-pilot.ps1` from the reviewed repository. Save it to a convenient folder on your Windows machine. Read it before running, as you would any downloaded script.

Open **Windows PowerShell** in that folder and run:

```powershell
.\local-openhands-free-pilot.ps1
```

This is **check-only by default**: it prints RAM and whether Git, Ollama, Docker Desktop and the chosen local model are present. It does not install or launch anything, download models, clone the repository, read secrets or ask for admin rights.

If Windows blocks the downloaded script, review its contents and follow your organization's script-execution policy. If allowed, unblock only that downloaded file with `Unblock-File .\local-openhands-free-pilot.ps1`, then try again. Do not globally weaken execution policy.

## Step 2: Install only the missing free tools

- **Git for Windows:** https://git-scm.com/downloads/win
- **Ollama for Windows:** https://ollama.com/download/windows
- **Docker Desktop:** https://docs.docker.com/desktop/setup/install/windows-install/ (requires supported Windows edition/hardware and WSL 2; review Docker's license for your use)
- **Model download:** once Ollama is installed and running, use `ollama pull qwen2.5-coder:7b` for a *connectivity-only* pilot. The model download takes several GB of data/disk space. For a machine with 32 GB+ RAM you may later test `qwen2.5-coder:14b` explicitly by passing `-Model 'qwen2.5-coder:14b'`. These are exploratory suggestions, not a guarantee of dependable agent performance.

**Hardware safeguard:** the script refuses the `-Start` option below 16 GB RAM; 7B coding-agent results on 16 GB are not guaranteed. For meaningful autonomous coding, a stronger model and more RAM/GPU memory are normally necessary. If hardware is insufficient, stop here rather than forcing a costly or unstable setup.

**Context:** OpenHands docs recommend a minimum local-model context around **22,000 tokens**, preferably **32,768**. Ollama may default to too small a context. Configure Ollama context explicitly before treating an agent failure as an integration failure, knowing that large contexts can significantly increase memory consumption. See [OpenHands local LLM guide](https://github.com/OpenHands/docs/blob/main/openhands/usage/llms/local-llms.mdx).

## Step 3: Start isolated Canvas when ready

```powershell
.\local-openhands-free-pilot.ps1 -Start
```

This explicit action creates `%USERPROFILE%\PropWise-OpenHands-Free-Pilot\` and a **fresh public** copy of `Manera01ad/emerald-property-hub` inside it, unless it already exists. It **never resets or updates** an existing local checkout. It then launches a local-only Docker container from `ghcr.io/openhands/agent-canvas:1.36.0`.

Only the dedicated pilot workspaces and agent state are mounted. **Never copy production .env files, personal GitHub tokens, cloud API keys or sensitive datasets into that directory.** Docker and Ollama must both be on. Image pulls use internet data.

The local UI will be available at **http://localhost:8000/canvas**.

## Step 4: Connect only the local Ollama model

In Agent Canvas advanced LLM settings:

| Field | Value |
| --- | --- |
| Provider / Custom Model | `openai/qwen2.5-coder:7b` |
| Base URL | `http://host.docker.internal:11434/v1` |
| API key | `local-llm` (dummy placeholder only) |

If you explicitly chose 14B, use `openai/qwen2.5-coder:14b` instead.

**Do not select OpenAI, Anthropic, OpenHands Cloud or any paid service** for this free pilot. The example API key is not a real secret and must never be used as a production credential. If local model connectivity fails from the Docker container, stop and troubleshoot; **do not open Ollama's port to the public internet or disable your firewall** as a workaround.

## Step 5: Run one QA-only task in the isolated clone

Open `/projects/emerald-property-hub` in the local Canvas and provide the prewritten task from [CTO_FREE_QA_TASK.md](CTO_FREE_QA_TASK.md). This is a one-time manual pilot, not an unattended run. It must edit only `e2e/` or `src/test/`, and must not access the real backend. Inspect its local code changes before deciding whether to copy them into a new branch or PR. The container cannot merge or deploy and has no production tokens unless you add them.

**No automatic GitHub PR is created by this pilot.** Automatic overnight collaboration would require a separately designed *local* runner that manages repository credentials and bounded agent sessions. The existing cloud GitHub Action is not made free by running it against an API key: it calls the provider's service.

## Stopping and cleanup

Press **Ctrl+C** in the PowerShell window to stop OpenHands; Docker runs the container with `--rm`. Leave the dedicated workspace alone until you inspect changes. Delete the pilot directory manually only after saving anything you want. No changes to production are made by these scripts.

## Safety checklist

- GitHub branch protection stays active.
- No secrets, service-role keys, paid APIs or migrations in the local pilot.
- Readiness check is read-only, start requires `-Start`.
- Docker UI is bound to `127.0.0.1:8000`; no Docker socket or entire user home mounted.
- All model output remains untrusted. Treat it as proposed code, not reviewed code.
- No automatic pushing, PR merge, deployment or spending.

**Official references:** [Agent Canvas](https://github.com/OpenHands/OpenHands/blob/main/README.md), [Windows setup](https://github.com/OpenHands/OpenHands/blob/main/README.windows.md), [Local LLMs](https://github.com/OpenHands/docs/blob/main/openhands/usage/llms/local-llms.mdx).
