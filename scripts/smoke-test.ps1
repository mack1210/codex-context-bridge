param(
  [string]$TargetExtensionsRoot = "$env:USERPROFILE\.vscode\extensions",
  [string]$KeybindingsPath = "C:\Users\flowe\AppData\Roaming\Code\User\profiles\6da8aac0\keybindings.json"
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

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$manifest = Get-Content -Raw (Join-Path $projectRoot "package.json") | ConvertFrom-Json
$publisherName = "$($manifest.publisher).$($manifest.name)"
$targetFolderName = "$publisherName-$($manifest.version)"
$targetDir = Join-Path $TargetExtensionsRoot $targetFolderName
$profileRoot = Split-Path -Parent $KeybindingsPath
$profileExtensionsPath = Join-Path $profileRoot "extensions.json"

if (-not (Test-Path $targetDir)) {
  throw "Installed extension directory not found: $targetDir"
}

$installedManifestPath = Join-Path $targetDir "package.json"
$installedManifest = Get-Content -Raw $installedManifestPath | ConvertFrom-Json

if ($installedManifest.name -ne $manifest.name) {
  throw "Installed extension name mismatch."
}

$profileExtensions = @(Normalize-ObjectArray (Read-JsoncArray -Path $profileExtensionsPath))
$profileEntry = $profileExtensions | Where-Object { $_.identifier.id -eq $publisherName } | Select-Object -First 1

if (-not $profileEntry) {
  throw "Profile extensions.json does not contain $publisherName"
}

$bindings = Read-JsoncArray -Path $KeybindingsPath
$ctrlL = $bindings | Where-Object { $_.key -eq "ctrl+l" } | Select-Object -First 1
$ctrlShiftL = $bindings | Where-Object { $_.key -eq "ctrl+shift+l" } | Select-Object -First 1

if (-not $ctrlL -or $ctrlL.command -ne "codexContextBridge.addSelectionToThread") {
  throw "ctrl+l is not bound to codexContextBridge.addSelectionToThread"
}

if (-not $ctrlShiftL -or $ctrlShiftL.command -ne "codexContextBridge.addActiveDocumentToThread") {
  throw "ctrl+shift+l is not bound to codexContextBridge.addActiveDocumentToThread"
}

Write-Host "Smoke test passed."
Write-Host "Installed extension: $targetDir"
Write-Host "Profile entry: $($profileEntry.identifier.id)"
Write-Host "ctrl+l => $($ctrlL.command)"
Write-Host "ctrl+shift+l => $($ctrlShiftL.command)"
