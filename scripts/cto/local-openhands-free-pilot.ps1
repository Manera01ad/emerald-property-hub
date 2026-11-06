# PropWise AI — OpenHands + Ollama local pilot for Windows.
# Read-only diagnostics by default. -Start opts into an isolated local Docker
# Canvas with only a public repo clone and isolated OpenHands state mounted.
# No cloud model API keys, GitHub pushes, admin elevation or database migrations.
[CmdletBinding()]
param(
  [switch]$Start,
  [ValidateSet('qwen2.5-coder:7b', 'qwen2.5-coder:14b')]
  [string]$Model = 'qwen2.5-coder:7b'
)

$ErrorActionPreference = 'Stop'

function Say([string]$message) { Write-Host "[PropWise pilot] $message" }
function HasCommand([string]$command) {
  return $null -ne (Get-Command $command -ErrorAction SilentlyContinue)
}

if ($env:OS -ne 'Windows_NT') {
  throw "This setup is for Windows PowerShell. Follow official OpenHands instructions for other systems."
}

$ramGb = $null
try {
  $ramGb = [math]::Round((Get-CimInstance -ClassName Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
} catch {
  Say "Unable to detect installed RAM automatically."
}

$hasDocker = HasCommand 'docker'
$hasGit = HasCommand 'git'
$hasOllamaCommand = HasCommand 'ollama'
$dockerReady = $false
if ($hasDocker) {
  try {
    $dockerInfo = & docker info --format '{{.ServerVersion}}' 2>$null
    $dockerReady = ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace("$dockerInfo"))
  } catch {
    $dockerReady = $false
  }
}

$ollamaReady = $false
$installedModels = @()
try {
  $response = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -Method Get -TimeoutSec 4
  $ollamaReady = $true
  $installedModels = @($response.models | ForEach-Object { $_.name })
} catch {
  $ollamaReady = $false
}
$modelPresent = $installedModels -contains $Model

Say "Windows RAM: $(if ($null -ne $ramGb) { "$ramGb GB" } else { 'unknown' })"
Say "Git installed: $hasGit"
Say "Docker installed: $hasDocker; Docker engine running: $dockerReady"
Say "Ollama installed: $hasOllamaCommand; Ollama local API reachable: $ollamaReady"
Say "Local Ollama models: $(if ($installedModels.Count -gt 0) { $installedModels -join ', ' } else { 'none detected' })"
Say "Selected free model: $Model; already downloaded: $modelPresent"

if ($null -ne $ramGb) {
  if ($ramGb -lt 16) {
    Say "RAM below 16 GB: do not start an OpenHands coding pilot. Use another machine."
  } elseif ($ramGb -lt 32) {
    Say "16-31 GB RAM: 7B is for connectivity testing; agentic coding may be slow or unreliable."
  } else {
    Say "32+ GB RAM: larger local models may be possible; monitor memory first."
  }
}

if (-not $Start) {
  Say "CHECK ONLY: nothing downloaded, installed, cloned or started."
  if (-not $hasDocker) { Say "Install Docker Desktop: https://docs.docker.com/desktop/setup/install/windows-install/" }
  if ($hasDocker -and -not $dockerReady) { Say "Start Docker Desktop and its WSL 2 engine." }
  if (-not $ollamaReady) { Say "Install/start Ollama: https://ollama.com/download/windows" }
  if ($ollamaReady -and -not $modelPresent) { Say "Manual model download: ollama pull $Model (consumes internet data and disk space)" }
  if (-not $hasGit) { Say "Install Git for Windows: https://git-scm.com/downloads/win" }
  Say "When ready, run this same script with -Start. Do not use cloud model API keys."
  return
}

if ($null -eq $ramGb) { throw "Cannot start without a RAM reading. Check your Windows system specs first." }
if ($ramGb -lt 16) { throw "Refusing to start below 16 GB RAM to avoid freezing the computer." }
if ($Model -eq 'qwen2.5-coder:14b' -and $ramGb -lt 32) {
  throw "Refusing 14B under 32 GB RAM. Choose the smaller model for a connectivity-only pilot."
}
if (-not $hasGit) { throw "Git is missing. Install Git for Windows first." }
if (-not $dockerReady) { throw "Docker Desktop is not running. Start it first." }
if (-not $ollamaReady) { throw "Ollama API not reachable at 127.0.0.1:11434. Start Ollama first." }
if (-not $modelPresent) { throw "Model $Model is not downloaded. Run: ollama pull $Model (confirm download cost/size first)." }

$root = Join-Path $env:USERPROFILE 'PropWise-OpenHands-Free-Pilot'
$workspace = Join-Path $root 'workspaces'
$state = Join-Path $root 'openhands-state'
$checkout = Join-Path $workspace 'emerald-property-hub'
New-Item -ItemType Directory -Path $workspace, $state -Force | Out-Null

if (-not (Test-Path $checkout)) {
  Say "Cloning PUBLIC PropWise repository into an isolated local folder."
  & git -c credential.helper= clone --depth 1 https://github.com/Manera01ad/emerald-property-hub.git "$checkout"
  if ($LASTEXITCODE -ne 0) { throw "Public clone failed; no container started." }
} elseif (-not (Test-Path (Join-Path $checkout '.git'))) {
  throw "Pilot checkout exists but is not a Git repository. Will not overwrite existing files."
} else {
  Say "Reusing the isolated local repo checkout. No automatic reset or pull."
}

# Only two dedicated pilot folders are mounted. Never mount home, SSH,
# production secrets, the Docker socket or your normal project checkout.
Say "Starting LOCAL Agent Canvas. Open http://localhost:8000/canvas once ready."
Say "LLM settings: Model = openai/$Model"
Say "LLM base URL = http://host.docker.internal:11434/v1"
Say "LLM API key = local-llm (placeholder, NOT a paid key)"
Say "OpenHands needs ~22000+ context tokens; configure Ollama accordingly (may require more RAM)."
Say "Only work under /projects/emerald-property-hub, using the QA-only task in docs."
Say "Press Ctrl+C to stop. Nothing pushes to GitHub automatically."

& docker run --rm -it --name propwise-openhands-free-pilot -p '127.0.0.1:8000:8000' -e 'AGENT_CANVAS_ALLOW_LAN_SESSION_KEY=true' -v "$($state):/home/openhands/.openhands" -v "$($workspace):/projects" 'ghcr.io/openhands/agent-canvas:1.36.0'
