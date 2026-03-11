param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$OpenClawArgs
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $projectRoot
$workspaceDir = Join-Path $repoRoot "workspace"
$legacyStateDir = Join-Path $repoRoot "openclaw-data"
$stateDir = Join-Path $projectRoot ".openclaw-state"
$configPath = Join-Path $stateDir "openclaw.json"

if (-not (Test-Path $workspaceDir)) {
  Write-Error "OpenClaw workspace not found: $workspaceDir"
  exit 1
}

if (-not (Test-Path $stateDir)) {
  if (Test-Path $legacyStateDir) {
    New-Item -ItemType Directory -Path $stateDir | Out-Null
    Copy-Item -Path (Join-Path $legacyStateDir "*") -Destination $stateDir -Recurse -Force
  } else {
    New-Item -ItemType Directory -Path $stateDir | Out-Null
  }
}

$workspaceDir = (Resolve-Path $workspaceDir).Path
$stateDir = (Resolve-Path $stateDir).Path

if (-not (Test-Path $configPath)) {
  $workspacePath = $workspaceDir -replace '\\', '/'
  $configJson = @"
{
  "agents": {
    "defaults": {
      "workspace": "$workspacePath"
    }
  }
}
"@
  Set-Content -Path $configPath -Value $configJson -Encoding utf8
}

$env:OPENCLAW_STATE_DIR = $stateDir
$env:OPENCLAW_CONFIG_PATH = $configPath

if (-not $OpenClawArgs -or $OpenClawArgs.Count -eq 0) {
  $OpenClawArgs = @("status")
}

if ($OpenClawArgs[0] -eq "setup" -and ($OpenClawArgs -notcontains "--workspace")) {
  $OpenClawArgs += @("--workspace", $workspaceDir)
}

$openclawCmdShim = Join-Path $env:APPDATA "npm\openclaw.cmd"

if (Test-Path $openclawCmdShim) {
  & $openclawCmdShim @OpenClawArgs
  exit $LASTEXITCODE
}

$openclawCommand = Get-Command openclaw -ErrorAction SilentlyContinue

if ($openclawCommand) {
  & $openclawCommand.Source @OpenClawArgs
  exit $LASTEXITCODE
}

$npxCommand = Get-Command npx -ErrorAction SilentlyContinue

if ($npxCommand) {
  & $npxCommand.Source -y openclaw @OpenClawArgs
  exit $LASTEXITCODE
}

Write-Error "OpenClaw CLI not found. Install it globally or use a Node.js setup that provides npx."
exit 1
