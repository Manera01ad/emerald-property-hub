# PropWise AI local-agent readiness check (Windows PowerShell 5.1+).
# READ-ONLY: no installations, API model calls, git writes, Docker runs,
# downloads, background jobs, credentials reads, or paid API access.
[CmdletBinding()]
param([switch]$Json)

$ErrorActionPreference = 'Stop'

function CommandAvailable([string]$name) {
  return $null -ne (Get-Command -Name $name -ErrorAction SilentlyContinue)
}

function TryReadMemoryGB {
  try {
    $bytes = (Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop).TotalPhysicalMemory
    if ($bytes -gt 0) { return [math]::Round(($bytes / 1GB), 1) }
  } catch { }
  return $null
}

if ($env:OS -ne 'Windows_NT') {
  throw 'Run this checker in Windows PowerShell on the computer where you installed the agents.'
}

$commands = [ordered]@{
  Git = (CommandAvailable 'git')
  Node = (CommandAvailable 'node')
  Docker = (CommandAvailable 'docker')
  Ollama = (CommandAvailable 'ollama')
  DeepSeekHarnessCLI = (CommandAvailable 'dsh')
  AntigravityCLI = (CommandAvailable 'agy')
  OpenHandsCLI = (CommandAvailable 'openhands')
}

$dockerEngine = $false
$canvasImageCached = $false
if ($commands.Docker) {
  try {
    $serverVersion = & docker info --format '{{.ServerVersion}}' 2>$null
    $dockerEngine = ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace("$serverVersion"))
  } catch { $dockerEngine = $false }

  if ($dockerEngine) {
    try {
      $null = & docker image inspect 'ghcr.io/openhands/agent-canvas:1.36.0' 2>$null
      $canvasImageCached = ($LASTEXITCODE -eq 0)
    } catch { $canvasImageCached = $false }
  }
}

$ollamaServer = $false
$modelNames = @()
try {
  # Loopback only. This is a read-only GET and sends no prompts or credentials.
  $response = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -Method Get -TimeoutSec 4 -ErrorAction Stop
  $ollamaServer = $true
  $modelNames = @($response.models | ForEach-Object { $_.name } | Where-Object { $_ })
} catch {
  $ollamaServer = $false
}

$ram = TryReadMemoryGB
$notes = @()
if (-not $commands.Git) { $notes += 'Install Git for Windows to clone an isolated pilot repository.' }
if (-not $commands.Docker) { $notes += 'Docker Desktop is not installed or not on PATH.' }
elseif (-not $dockerEngine) { $notes += 'Docker is installed but its local engine is not running.' }
if (-not $commands.Ollama) { $notes += 'Ollama CLI not found; check installation or PATH.' }
if (-not $ollamaServer) { $notes += 'Local Ollama model server is not reachable on 127.0.0.1:11434.' }
elseif ($modelNames.Count -eq 0) { $notes += 'Ollama is running but no local model is downloaded; installing Ollama alone is not enough.' }
if (-not $commands.DeepSeekHarnessCLI) { $notes += 'DeepSeek app may be running but the dsh headless CLI is not available on PATH.' }
if (-not $commands.AntigravityCLI) { $notes += 'Antigravity app may be running but the agy headless CLI is not available on PATH.' }
if ($null -eq $ram) { $notes += 'Could not measure installed RAM; verify Windows Settings > System > About.' }
elseif ($ram -lt 16) { $notes += 'Under 16 GB RAM: do not start the local OpenHands coding-model pilot on this machine.' }
elseif ($ram -lt 32) { $notes += '16-31 GB RAM: a 7B model may help test connectivity but can struggle with autonomous coding.' }
if ($commands.DeepSeekHarnessCLI -or $commands.AntigravityCLI) {
  $notes += 'CLI presence does not prove authentication or zero token charges. No agent was launched.'
}

$result = [ordered]@{
  checked_at_utc = (Get-Date).ToUniversalTime().ToString('o')
  check_only = $true
  agents_started = $false
  model_api_requests_sent = 0
  git_changes_made = $false
  installed_ram_gb = $ram
  commands_present = $commands
  docker_engine_running = $dockerEngine
  openhands_canvas_image_cached = $canvasImageCached
  ollama_server_reachable = $ollamaServer
  ollama_installed_models = $modelNames
  notes = $notes
}

if ($Json) {
  $result | ConvertTo-Json -Depth 5
} else {
  Write-Host '=== PropWise AI: local agent readiness ==='
  Write-Host "RAM: $(if ($null -eq $ram) { 'unknown' } else { "$ram GB" })"
  foreach ($entry in $commands.GetEnumerator()) {
    Write-Host ('{0}: {1}' -f $entry.Key, $(if ($entry.Value) { 'Detected' } else { 'Not found on PATH' }))
  }
  Write-Host "Docker engine running: $dockerEngine"
  Write-Host "OpenHands image already cached: $canvasImageCached"
  Write-Host "Ollama local server running: $ollamaServer"
  Write-Host "Ollama models: $(if ($modelNames.Count) { $modelNames -join ', ' } else { 'none detected' })"
  foreach ($note in $notes) { Write-Host "NOTE: $note" }
  Write-Host 'RESULT: Check only. No agents started; no model API requests, downloads, git writes or paid actions.'
}
