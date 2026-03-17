param(
  [string]$TargetExtensionsRoot = "$env:USERPROFILE\.vscode\extensions",
  [string]$KeybindingsPath = "C:\Users\flowe\AppData\Roaming\Code\User\profiles\6da8aac0\keybindings.json",
  [switch]$SkipKeybindings
)

$ErrorActionPreference = "Stop"

function Read-JsoncArray {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $raw = Get-Content -Raw $Path
  $withoutBom = $raw -replace "^\uFEFF", ""
  $withoutBlockComments = [regex]::Replace($withoutBom, "/\*.*?\*/", "", [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $withoutLineComments = [regex]::Replace($withoutBlockComments, "(?m)^\s*//.*$", "")

  return $withoutLineComments | ConvertFrom-Json
}

function Normalize-ObjectArray {
  param(
    [Parameter(ValueFromPipeline = $true)]
    $InputObject
  )

  process {
    if ($null -eq $InputObject) {
      return
    }

    if ($InputObject -is [System.Array]) {
      foreach ($item in $InputObject) {
        Normalize-ObjectArray -InputObject $item
      }

      return
    }

    if ($InputObject.PSObject.Properties.Name -contains "value" -and $InputObject.value -is [System.Array]) {
      foreach ($item in $InputObject.value) {
        Normalize-ObjectArray -InputObject $item
      }

      return
    }

    $InputObject
  }
}

function Convert-ToVsCodeFileUriPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WindowsPath
  )

  $normalized = $WindowsPath -replace "\\", "/"

  if ($normalized -match "^[A-Za-z]:") {
    $drive = $normalized.Substring(0, 1).ToLower()
    $rest = $normalized.Substring(2)
    return "/$drive`:$rest"
  }

  return $normalized
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptRoot
$manifestPath = Join-Path $projectRoot "package.json"
$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
$publisherName = "$($manifest.publisher).$($manifest.name)"
$targetFolderName = "$publisherName-$($manifest.version)"
$targetDir = Join-Path $TargetExtensionsRoot $targetFolderName
$legacyTargetDir = Join-Path $TargetExtensionsRoot "$($manifest.name)-$($manifest.version)"
$profileRoot = Split-Path -Parent $KeybindingsPath
$profileExtensionsPath = Join-Path $profileRoot "extensions.json"

if (-not (Test-Path $TargetExtensionsRoot)) {
  New-Item -ItemType Directory -Path $TargetExtensionsRoot -Force | Out-Null
}

if (Test-Path $legacyTargetDir) {
  Remove-Item $legacyTargetDir -Recurse -Force
}

if (Test-Path $targetDir) {
  Remove-Item $targetDir -Recurse -Force
}

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

Copy-Item (Join-Path $projectRoot "package.json") $targetDir -Force
Copy-Item (Join-Path $projectRoot "extension.js") $targetDir -Force
Copy-Item (Join-Path $projectRoot "lib") $targetDir -Recurse -Force

$profileExtensions = @()

if (Test-Path $profileExtensionsPath) {
  $profileExtensions = @(Normalize-ObjectArray (Read-JsoncArray -Path $profileExtensionsPath))
}

$profileExtensions = @($profileExtensions | Where-Object { $_.identifier.id -ne $publisherName })

$profileExtensions = @(
  [pscustomobject]@{
    identifier = [pscustomobject]@{
      id = $publisherName
    }
    version = $manifest.version
    location = [pscustomobject]@{
      '$mid' = 1
      path = (Convert-ToVsCodeFileUriPath -WindowsPath $targetDir)
      scheme = "file"
    }
    relativeLocation = $targetFolderName
    metadata = [pscustomobject]@{
      installedTimestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      pinned = $false
      source = "custom"
    }
  }
) + $profileExtensions

$profileExtensions | ConvertTo-Json -Depth 10 | Set-Content -Path $profileExtensionsPath -Encoding utf8

if (-not $SkipKeybindings) {
  $backupPath = "$KeybindingsPath.bak-$(Get-Date -Format 'yyyyMMddHHmmss')"
  Copy-Item $KeybindingsPath $backupPath -Force

  $bindings = Read-JsoncArray -Path $KeybindingsPath
  $filtered = @()

  foreach ($binding in $bindings) {
    if ($binding.command -eq "codexContextBridge.addSelectionToThread") {
      continue
    }

    if ($binding.command -eq "codexContextBridge.addActiveDocumentToThread") {
      continue
    }

    if ($binding.key -eq "ctrl+l") {
      continue
    }

    if ($binding.key -eq "ctrl+shift+l") {
      continue
    }

    $filtered += $binding
  }

  $filtered = @(
    [pscustomobject]@{
      key = "ctrl+l"
      command = "codexContextBridge.addSelectionToThread"
      when = "editorTextFocus && editorHasSelection"
    },
    [pscustomobject]@{
      key = "ctrl+shift+l"
      command = "codexContextBridge.addActiveDocumentToThread"
      when = "editorTextFocus"
    }
  ) + $filtered

  $json = $filtered | ConvertTo-Json -Depth 10
  Set-Content -Path $KeybindingsPath -Value $json -Encoding utf8
}

Write-Host "Installed local extension to $targetDir"
Write-Host "Registered local extension in $profileExtensionsPath"
if (-not $SkipKeybindings) {
  Write-Host "Updated keybindings at $KeybindingsPath"
}
Write-Host "Reload VS Code to activate the local extension."
