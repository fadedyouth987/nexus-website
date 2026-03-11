param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectUrl,
  [Parameter(Mandatory = $true)]
  [string]$AnonKey,
  [Parameter(Mandatory = $true)]
  [string]$ServiceRoleKey,
  [string]$EnvFile = ".env.local"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Mask([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) {
    return "(missing)"
  }
  if ($value.Length -le 10) {
    return "**********"
  }
  return "$($value.Substring(0, 6))...$($value.Substring($value.Length - 4, 4))"
}

function Set-EnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Key,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $lines = @()
  if (Test-Path $Path) {
    $lines = Get-Content $Path
  }

  $pattern = "^\s*$([Regex]::Escape($Key))="
  $updated = $false

  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) {
      $lines[$i] = "$Key=$Value"
      $updated = $true
      break
    }
  }

  if (-not $updated) {
    $lines += "$Key=$Value"
  }

  Set-Content -Path $Path -Value $lines -NoNewline:$false
}

if (-not (Test-Path $EnvFile)) {
  if (Test-Path ".env.local.template") {
    Copy-Item ".env.local.template" $EnvFile
  } else {
    New-Item -ItemType File -Path $EnvFile | Out-Null
  }
}

Set-EnvValue -Path $EnvFile -Key "NEXT_PUBLIC_SUPABASE_URL" -Value $ProjectUrl
Set-EnvValue -Path $EnvFile -Key "SUPABASE_URL" -Value $ProjectUrl
Set-EnvValue -Path $EnvFile -Key "NEXT_PUBLIC_SUPABASE_ANON_KEY" -Value $AnonKey
Set-EnvValue -Path $EnvFile -Key "SUPABASE_SERVICE_ROLE_KEY" -Value $ServiceRoleKey

Write-Output "Supabase config updated in $EnvFile"
Write-Output "NEXT_PUBLIC_SUPABASE_URL: $(Mask $ProjectUrl)"
Write-Output "SUPABASE_URL: $(Mask $ProjectUrl)"
Write-Output "NEXT_PUBLIC_SUPABASE_ANON_KEY: $(Mask $AnonKey)"
Write-Output "SUPABASE_SERVICE_ROLE_KEY: $(Mask $ServiceRoleKey)"
