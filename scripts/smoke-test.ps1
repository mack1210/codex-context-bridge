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

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$manifest = Get-Content -Raw (Join-Path $projectRoot "package.json") | ConvertFrom-Json
$targetDir = Join-Path $TargetExtensionsRoot "$($manifest.name)-$($manifest.version)"

if (-not (Test-Path $targetDir)) {
  throw "Installed extension directory not found: $targetDir"
}

$installedManifestPath = Join-Path $targetDir "package.json"
$installedManifest = Get-Content -Raw $installedManifestPath | ConvertFrom-Json

if ($installedManifest.name -ne $manifest.name) {
  throw "Installed extension name mismatch."
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
Write-Host "ctrl+l => $($ctrlL.command)"
Write-Host "ctrl+shift+l => $($ctrlShiftL.command)"
