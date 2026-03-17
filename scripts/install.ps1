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

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptRoot
$manifestPath = Join-Path $projectRoot "package.json"
$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
$targetDir = Join-Path $TargetExtensionsRoot "$($manifest.name)-$($manifest.version)"

if (-not (Test-Path $TargetExtensionsRoot)) {
  New-Item -ItemType Directory -Path $TargetExtensionsRoot -Force | Out-Null
}

if (Test-Path $targetDir) {
  Remove-Item $targetDir -Recurse -Force
}

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

Copy-Item (Join-Path $projectRoot "package.json") $targetDir -Force
Copy-Item (Join-Path $projectRoot "extension.js") $targetDir -Force
Copy-Item (Join-Path $projectRoot "lib") $targetDir -Recurse -Force

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
if (-not $SkipKeybindings) {
  Write-Host "Updated keybindings at $KeybindingsPath"
}
Write-Host "Reload VS Code to activate the local extension."
