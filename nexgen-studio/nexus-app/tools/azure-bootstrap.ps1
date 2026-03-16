param(
  [Parameter(Mandatory = $true)]
  [string]$SubscriptionId,
  [Parameter(Mandatory = $true)]
  [string]$ResourceGroupName,
  [Parameter(Mandatory = $true)]
  [string]$Location,
  [Parameter(Mandatory = $true)]
  [string]$DomainName,
  [Parameter(Mandatory = $true)]
  [string]$AdminUsername,
  [Parameter(Mandatory = $true)]
  [string]$SshPublicKeyPath,
  [string]$VmName = "nexus-comfy-01",
  [string]$VmSize = "Standard_NC4as_T4_v3",
  [string]$VnetName = "nexus-vnet",
  [string]$SubnetName = "gpu-subnet",
  [string]$NsgName = "nexus-comfy-nsg",
  [string]$NicName = "nexus-comfy-nic",
  [string]$PublicIpName = "nexus-comfy-pip",
  [string]$WebSubdomain = "www",
  [string]$WebARecordIp,
  [string]$WebCNameTarget,
  [string]$ComfySfwSubdomain = "comfy-sfw",
  [string]$ComfyNsfwSubdomain = "comfy-nsfw",
  [switch]$ExternalDns,
  [string]$AllowedSshCidr,
  [string]$EnvFile,
  [switch]$UpdateEnvFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-AzureCliOnPath {
  if (Get-Command az -ErrorAction SilentlyContinue) {
    return
  }

  $candidateDirectories = @(
    (Join-Path ${env:ProgramFiles} "Microsoft SDKs\Azure\CLI2\wbin"),
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft SDKs\Azure\CLI2\wbin")
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

  foreach ($directory in $candidateDirectories) {
    if (Test-Path (Join-Path $directory "az.cmd")) {
      $env:Path = "$env:Path;$directory"
      return
    }
  }
}

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Invoke-AzRaw {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $hasNativePreference = Test-Path variable:PSNativeCommandUseErrorActionPreference
  $previousNativePreference = if ($hasNativePreference) { $PSNativeCommandUseErrorActionPreference } else { $null }
  try {
    $ErrorActionPreference = "Continue"
    if ($hasNativePreference) {
      $PSNativeCommandUseErrorActionPreference = $false
    }
    $output = & az @Args --only-show-errors 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw "Azure CLI command failed: az $($Args -join ' ')`n$output"
    }
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
    if ($hasNativePreference) {
      $PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }
  }
  return $output
}

function Invoke-AzJson {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  $raw = Invoke-AzRaw -Args ($Args + @("-o", "json"))
  if ([string]::IsNullOrWhiteSpace(($raw -join ""))) {
    return $null
  }
  return (($raw -join [Environment]::NewLine) | ConvertFrom-Json)
}

function Invoke-AzTsv {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  $raw = Invoke-AzRaw -Args ($Args + @("-o", "tsv"))
  return ($raw -join [Environment]::NewLine).Trim()
}

function Test-AzLoggedIn {
  $previousErrorActionPreference = $ErrorActionPreference
  $hasNativePreference = Test-Path variable:PSNativeCommandUseErrorActionPreference
  $previousNativePreference = if ($hasNativePreference) { $PSNativeCommandUseErrorActionPreference } else { $null }
  try {
    $ErrorActionPreference = "Continue"
    if ($hasNativePreference) {
      $PSNativeCommandUseErrorActionPreference = $false
    }
    & az account show --only-show-errors 1>$null 2>$null
    return $LASTEXITCODE -eq 0
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
    if ($hasNativePreference) {
      $PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }
  }
}

function Test-AzExists {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $hasNativePreference = Test-Path variable:PSNativeCommandUseErrorActionPreference
  $previousNativePreference = if ($hasNativePreference) { $PSNativeCommandUseErrorActionPreference } else { $null }
  try {
    $ErrorActionPreference = "Continue"
    if ($hasNativePreference) {
      $PSNativeCommandUseErrorActionPreference = $false
    }
    & az @Args --only-show-errors 1>$null 2>$null
    return $LASTEXITCODE -eq 0
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
    if ($hasNativePreference) {
      $PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }
  }
}

function Get-DetectedPublicCidr {
  $candidates = @(
    "https://api.ipify.org",
    "https://ifconfig.me/ip"
  )

  foreach ($uri in $candidates) {
    try {
      $ip = (Invoke-RestMethod -Uri $uri -TimeoutSec 10).ToString().Trim()
      if ($ip -match '^\d{1,3}(\.\d{1,3}){3}$') {
        return "$ip/32"
      }
    } catch {
      continue
    }
  }

  throw "Could not detect your public IP automatically. Re-run with -AllowedSshCidr x.x.x.x/32"
}

function Ensure-DnsARecord {
  param(
    [Parameter(Mandatory = $true)][string]$ZoneName,
    [Parameter(Mandatory = $true)][string]$RecordName,
    [Parameter(Mandatory = $true)][string]$IpAddress
  )

  $existing = $null
  try {
    $existing = Invoke-AzJson -Args @("network", "dns", "record-set", "a", "show", "-g", $ResourceGroupName, "-z", $ZoneName, "-n", $RecordName)
  } catch {
    $existing = $null
  }

  if ($null -eq $existing) {
    Invoke-AzRaw -Args @("network", "dns", "record-set", "a", "create", "-g", $ResourceGroupName, "-z", $ZoneName, "-n", $RecordName, "--ttl", "300") | Out-Null
    Invoke-AzRaw -Args @("network", "dns", "record-set", "a", "add-record", "-g", $ResourceGroupName, "-z", $ZoneName, "-n", $RecordName, "-a", $IpAddress) | Out-Null
    return
  }

  $hasRecord = @($existing.aRecords | ForEach-Object { $_.ipv4Address }) -contains $IpAddress
  if (-not $hasRecord) {
    Invoke-AzRaw -Args @("network", "dns", "record-set", "a", "add-record", "-g", $ResourceGroupName, "-z", $ZoneName, "-n", $RecordName, "-a", $IpAddress) | Out-Null
  }
}

function Ensure-DnsCNameRecord {
  param(
    [Parameter(Mandatory = $true)][string]$ZoneName,
    [Parameter(Mandatory = $true)][string]$RecordName,
    [Parameter(Mandatory = $true)][string]$Target
  )

  Invoke-AzRaw -Args @("network", "dns", "record-set", "cname", "set-record", "-g", $ResourceGroupName, "-z", $ZoneName, "-n", $RecordName, "-c", $Target) | Out-Null
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

function Ensure-AzExtension {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [switch]$AllowPreview
  )

  if (Test-AzExists -Args @("extension", "show", "--name", $Name)) {
    return
  }

  $args = @("extension", "add", "--name", $Name, "--yes")
  if ($AllowPreview.IsPresent) {
    $args += @("--allow-preview", "true")
  }

  Invoke-AzRaw -Args $args | Out-Null
}

function Ensure-AzProviderRegistration {
  param(
    [Parameter(Mandatory = $true)][string]$Namespace
  )

  $registrationState = Invoke-AzTsv -Args @("provider", "show", "--namespace", $Namespace, "--query", "registrationState")
  if ($registrationState -eq "Registered") {
    return
  }

  Invoke-AzRaw -Args @("provider", "register", "--namespace", $Namespace, "--wait") | Out-Null
}

function Get-QuotaInfo {
  param(
    [Parameter(Mandatory = $true)][string]$Scope,
    [Parameter(Mandatory = $true)][string]$ResourceName
  )

  for ($attempt = 0; $attempt -lt 6; $attempt++) {
    try {
      return Invoke-AzJson -Args @("quota", "show", "--scope", $Scope, "--resource-name", $ResourceName)
    } catch {
      if ($_.Exception.Message -notmatch "MissingRegistrationForResourceProvider" -or $attempt -eq 5) {
        throw
      }

      Start-Sleep -Seconds 5
    }
  }

  throw "Failed to fetch quota info for '$ResourceName' at scope '$Scope'."
}

function Get-VmSkuInfo {
  param(
    [Parameter(Mandatory = $true)][string]$LocationName,
    [Parameter(Mandatory = $true)][string]$VmSkuName
  )

  $skuResults = @(Invoke-AzJson -Args @("vm", "list-skus", "--location", $LocationName, "--resource-type", "virtualMachines", "--size", $VmSkuName, "--all"))
  $sku = $skuResults | Where-Object { $_.name -eq $VmSkuName -and ($_.locations -contains $LocationName) } | Select-Object -First 1
  if ($null -eq $sku) {
    throw "VM size '$VmSkuName' is not available in Azure region '$LocationName'."
  }

  return $sku
}

function Get-VmSkuVcpuCount {
  param(
    [Parameter(Mandatory = $true)]$Sku
  )

  $capability = @($Sku.capabilities | Where-Object { $_.name -eq "vCPUs" } | Select-Object -First 1)
  if ($capability.Count -eq 0 -or [string]::IsNullOrWhiteSpace($capability[0].value)) {
    throw "Could not determine vCPU requirement for VM size '$($Sku.name)'."
  }

  return [int]$capability[0].value
}

function Ensure-VmQuota {
  param(
    [Parameter(Mandatory = $true)][string]$Subscription,
    [Parameter(Mandatory = $true)][string]$LocationName,
    [Parameter(Mandatory = $true)][string]$VmSkuName
  )

  Ensure-AzProviderRegistration -Namespace "Microsoft.Compute"
  Ensure-AzExtension -Name "quota" -AllowPreview
  Ensure-AzProviderRegistration -Namespace "Microsoft.Quota"

  $sku = Get-VmSkuInfo -LocationName $LocationName -VmSkuName $VmSkuName
  $requiredUnits = Get-VmSkuVcpuCount -Sku $sku
  $quotaFamily = $sku.family
  $quotaScope = "/subscriptions/$Subscription/providers/Microsoft.Compute/locations/$LocationName"

  $quota = Get-QuotaInfo -Scope $quotaScope -ResourceName $quotaFamily
  $currentLimit = [int]$quota.properties.limit.value
  if ($currentLimit -ge $requiredUnits) {
    Write-Host "[azure-bootstrap] Quota check passed for $VmSkuName in family '$quotaFamily' ($currentLimit/$requiredUnits)"
    return
  }

  Write-Host "[azure-bootstrap] Quota for '$quotaFamily' is $currentLimit; requesting increase to $requiredUnits"
  try {
    Invoke-AzRaw -Args @(
      "quota", "update",
      "--scope", $quotaScope,
      "--resource-name", $quotaFamily,
      "--resource-type", "dedicated",
      "--limit-object", "value=$requiredUnits"
    ) | Out-Null
  } catch {
    throw "VM size '$VmSkuName' requires $requiredUnits vCPUs in quota family '$quotaFamily' for region '$LocationName'. Current limit: $currentLimit. Automatic quota request failed.`n$($_.Exception.Message)"
  }

  $updatedQuota = Get-QuotaInfo -Scope $quotaScope -ResourceName $quotaFamily
  $updatedLimit = [int]$updatedQuota.properties.limit.value
  if ($updatedLimit -lt $requiredUnits) {
    throw "Quota request for '$quotaFamily' in '$LocationName' did not reach the required limit. Required: $requiredUnits. Current limit after request: $updatedLimit."
  }

  Write-Host "[azure-bootstrap] Quota request approved for '$quotaFamily' ($updatedLimit/$requiredUnits)"
}

Ensure-AzureCliOnPath
Require-Command "az"

if (-not (Test-AzLoggedIn)) {
  throw "Azure CLI is not logged in. Run 'az login' first."
}

if (-not (Test-Path $SshPublicKeyPath)) {
  throw "SSH public key file not found: $SshPublicKeyPath"
}

if ([string]::IsNullOrWhiteSpace($AllowedSshCidr)) {
  $AllowedSshCidr = Get-DetectedPublicCidr
}

$scriptDir = Split-Path -Parent $PSCommandPath
$cloudInitTemplatePath = Join-Path $scriptDir "azure-comfy-cloud-init.yaml"
$cloudInitTempPath = Join-Path ([System.IO.Path]::GetTempPath()) ("nexus-comfy-cloud-init-" + [guid]::NewGuid().ToString() + ".yaml")

$webHost = if ([string]::IsNullOrWhiteSpace($WebSubdomain)) { $DomainName } else { "$WebSubdomain.$DomainName" }
$webRecordName = if ([string]::IsNullOrWhiteSpace($WebSubdomain)) { "@" } else { $WebSubdomain }
$comfySfwHost = "$ComfySfwSubdomain.$DomainName"
$comfyNsfwHost = "$ComfyNsfwSubdomain.$DomainName"

try {
  $cloudInit = (Get-Content $cloudInitTemplatePath -Raw).
    Replace("__COMFY_SFW_HOST__", $comfySfwHost).
    Replace("__COMFY_NSFW_HOST__", $comfyNsfwHost)
  Set-Content -Path $cloudInitTempPath -Value $cloudInit -NoNewline:$false

  Write-Host "[azure-bootstrap] Using SSH CIDR $AllowedSshCidr"
  Write-Host "[azure-bootstrap] Selecting subscription $SubscriptionId"
  Invoke-AzRaw -Args @("account", "set", "--subscription", $SubscriptionId) | Out-Null

  Write-Host "[azure-bootstrap] Ensuring resource group $ResourceGroupName"
  Invoke-AzRaw -Args @("group", "create", "-n", $ResourceGroupName, "-l", $Location) | Out-Null

  if (-not (Test-AzExists -Args @("vm", "show", "-g", $ResourceGroupName, "-n", $VmName))) {
    Write-Host "[azure-bootstrap] Preflighting quota for VM size $VmSize"
    Ensure-VmQuota -Subscription $SubscriptionId -LocationName $Location -VmSkuName $VmSize
  }

  if (-not $ExternalDns.IsPresent) {
    Write-Host "[azure-bootstrap] Ensuring DNS zone $DomainName"
    Invoke-AzRaw -Args @("network", "dns", "zone", "create", "-g", $ResourceGroupName, "-n", $DomainName) | Out-Null
  }

  Write-Host "[azure-bootstrap] Ensuring virtual network and subnet"
  Invoke-AzRaw -Args @(
    "network", "vnet", "create",
    "-g", $ResourceGroupName,
    "-n", $VnetName,
    "--address-prefixes", "10.20.0.0/16",
    "--subnet-name", $SubnetName,
    "--subnet-prefixes", "10.20.1.0/24"
  ) | Out-Null

  Write-Host "[azure-bootstrap] Ensuring network security group and rules"
  Invoke-AzRaw -Args @("network", "nsg", "create", "-g", $ResourceGroupName, "-n", $NsgName) | Out-Null
  Invoke-AzRaw -Args @(
    "network", "nsg", "rule", "create",
    "-g", $ResourceGroupName,
    "--nsg-name", $NsgName,
    "-n", "allow-ssh",
    "--priority", "100",
    "--access", "Allow",
    "--direction", "Inbound",
    "--protocol", "Tcp",
    "--source-address-prefixes", $AllowedSshCidr,
    "--source-port-ranges", "*",
    "--destination-port-ranges", "22"
  ) | Out-Null
  Invoke-AzRaw -Args @(
    "network", "nsg", "rule", "create",
    "-g", $ResourceGroupName,
    "--nsg-name", $NsgName,
    "-n", "allow-http",
    "--priority", "110",
    "--access", "Allow",
    "--direction", "Inbound",
    "--protocol", "Tcp",
    "--source-address-prefixes", "Internet",
    "--source-port-ranges", "*",
    "--destination-port-ranges", "80"
  ) | Out-Null
  Invoke-AzRaw -Args @(
    "network", "nsg", "rule", "create",
    "-g", $ResourceGroupName,
    "--nsg-name", $NsgName,
    "-n", "allow-https",
    "--priority", "120",
    "--access", "Allow",
    "--direction", "Inbound",
    "--protocol", "Tcp",
    "--source-address-prefixes", "Internet",
    "--source-port-ranges", "*",
    "--destination-port-ranges", "443"
  ) | Out-Null

  Write-Host "[azure-bootstrap] Ensuring public IP and NIC"
  if (-not (Test-AzExists -Args @("network", "public-ip", "show", "-g", $ResourceGroupName, "-n", $PublicIpName))) {
    Invoke-AzRaw -Args @("network", "public-ip", "create", "-g", $ResourceGroupName, "-n", $PublicIpName, "--sku", "Standard", "--allocation-method", "Static") | Out-Null
  }

  if (-not (Test-AzExists -Args @("network", "nic", "show", "-g", $ResourceGroupName, "-n", $NicName))) {
    Invoke-AzRaw -Args @(
      "network", "nic", "create",
      "-g", $ResourceGroupName,
      "-n", $NicName,
      "--vnet-name", $VnetName,
      "--subnet", $SubnetName,
      "--network-security-group", $NsgName,
      "--public-ip-address", $PublicIpName
    ) | Out-Null
  }

  Write-Host "[azure-bootstrap] Ensuring GPU VM $VmName"
  if (-not (Test-AzExists -Args @("vm", "show", "-g", $ResourceGroupName, "-n", $VmName))) {
    Invoke-AzRaw -Args @(
      "vm", "create",
      "-g", $ResourceGroupName,
      "-n", $VmName,
      "--nics", $NicName,
      "--image", "Ubuntu2204",
      "--size", $VmSize,
      "--admin-username", $AdminUsername,
      "--ssh-key-values", $SshPublicKeyPath,
      "--custom-data", $cloudInitTempPath
    ) | Out-Null
  }

  Write-Host "[azure-bootstrap] Installing NVIDIA GPU driver extension"
  Invoke-AzRaw -Args @(
    "vm", "extension", "set",
    "--resource-group", $ResourceGroupName,
    "--vm-name", $VmName,
    "--publisher", "Microsoft.HpcCompute",
    "--name", "NvidiaGpuDriverLinux"
  ) | Out-Null

  $publicIp = Invoke-AzTsv -Args @("network", "public-ip", "show", "-g", $ResourceGroupName, "-n", $PublicIpName, "--query", "ipAddress")

  $nameServers = @()
  if ($ExternalDns.IsPresent) {
    Write-Host "[azure-bootstrap] Skipping Azure DNS zone and record management"
  } else {
    Write-Host "[azure-bootstrap] Ensuring DNS records"
    Ensure-DnsARecord -ZoneName $DomainName -RecordName $ComfySfwSubdomain -IpAddress $publicIp
    Ensure-DnsARecord -ZoneName $DomainName -RecordName $ComfyNsfwSubdomain -IpAddress $publicIp
    if (-not [string]::IsNullOrWhiteSpace($WebARecordIp)) {
      Ensure-DnsARecord -ZoneName $DomainName -RecordName $webRecordName -IpAddress $WebARecordIp
    } elseif (-not [string]::IsNullOrWhiteSpace($WebCNameTarget)) {
      if ($webRecordName -eq "@") {
        throw "Apex domains cannot use CNAME here. Re-run with -WebARecordIp for the root domain, or set -WebSubdomain to use a host like www."
      }

      Ensure-DnsCNameRecord -ZoneName $DomainName -RecordName $WebSubdomain -Target $WebCNameTarget
    }

    $nameServers = @(
      (Invoke-AzTsv -Args @("network", "dns", "zone", "show", "-g", $ResourceGroupName, "-n", $DomainName, "--query", "nameServers[]")) -split "`r?`n" |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
  }

  $envValues = [ordered]@{
    NEXTAUTH_URL        = "https://$webHost"
    NEXT_PUBLIC_SITE_URL = "https://$webHost"
    COMFYUI_BASE_URL    = "https://$comfySfwHost"
    COMFY_SFW_URL       = "https://$comfySfwHost"
    COMFY_NSFW_URL      = "https://$comfyNsfwHost"
    COMFY_VIEW_PATH     = "/view"
  }

  if ($UpdateEnvFile.IsPresent) {
    if ([string]::IsNullOrWhiteSpace($EnvFile)) {
      throw "When -UpdateEnvFile is used, provide -EnvFile"
    }

    foreach ($entry in $envValues.GetEnumerator()) {
      Set-EnvValue -Path $EnvFile -Key $entry.Key -Value $entry.Value
    }
  }

  Write-Host ""
  Write-Host "Azure bootstrap complete."
  Write-Host ""
  if ($ExternalDns.IsPresent) {
    Write-Host "External DNS records to add:"
    Write-Host "  A $comfySfwHost -> $publicIp"
    Write-Host "  A $comfyNsfwHost -> $publicIp"
    if (-not [string]::IsNullOrWhiteSpace($WebARecordIp)) {
      Write-Host "  A $webHost -> $WebARecordIp"
    } elseif (-not [string]::IsNullOrWhiteSpace($WebCNameTarget)) {
      Write-Host "  CNAME $webHost -> $WebCNameTarget"
    }
  } else {
    Write-Host "Registrar nameservers:"
    foreach ($server in $nameServers) {
      Write-Host "  $server"
    }
  }
  Write-Host ""
  Write-Host "Public GPU IP: $publicIp"
  Write-Host "Web host: https://$webHost"
  Write-Host "Comfy SFW: https://$comfySfwHost"
  Write-Host "Comfy NSFW: https://$comfyNsfwHost"
  Write-Host ""
  Write-Host "App env:"
  foreach ($entry in $envValues.GetEnumerator()) {
  Write-Host "  $($entry.Key)=$($entry.Value)"
  }
  Write-Host ""
  Write-Host "Next manual steps:"
  if ($ExternalDns.IsPresent) {
    Write-Host "  1. Add the external DNS records listed above in your current DNS provider."
    Write-Host "  2. Keep your existing web host record for https://$webHost unless you are intentionally changing it."
    Write-Host "  3. Add https://$webHost and https://$webHost/auth/callback to Supabase/Auth provider allowlists."
    Write-Host "  4. SSH to $publicIp and run your ComfyUI container or service on localhost:8188."
  } else {
    Write-Host "  1. Point your registrar to the Azure DNS nameservers listed above."
    Write-Host "  2. Configure your web host to answer for https://$webHost."
    Write-Host "  3. Add https://$webHost and https://$webHost/auth/callback to Supabase/Auth provider allowlists."
    Write-Host "  4. SSH to $publicIp and run your ComfyUI container or service on localhost:8188."
  }
} finally {
  if (Test-Path $cloudInitTempPath) {
    Remove-Item $cloudInitTempPath -Force -ErrorAction SilentlyContinue
  }
}
