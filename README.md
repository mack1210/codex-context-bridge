# Codex Context Bridge

This local VS Code extension works around a limitation in the OpenAI Codex extension:

- `chatgpt.addToThread` only works when the active editor has the `file` URI scheme.
- VS Code opens some editors with non-file schemes such as `vscode-userdata` and `vscode-notebook-cell`.
- Because of that, `Ctrl+L` fails for files like profile `keybindings.json` and notebook cells even when text is selected.

## What This Extension Does

- Keeps the original behavior for normal files by delegating to `chatgpt.addToThread`.
- For non-file editors, it writes the selected content or active document to a local markdown snapshot.
- It then forwards that snapshot to `chatgpt.addFileToThread`, so the Codex thread still receives the context.
- Snapshot filenames are formatted as `filename [Cell n, Line m].md` or `filename [Lines a-b].md` so the chat chip stays readable.

Snapshots are stored under `%USERPROFILE%\.codex-context-bridge\snapshots`.

## Repository Layout

- `package.json`: local extension manifest
- `extension.js`: command bridge and snapshot writer
- `lib/snapshot.js`: pure helper logic for snapshot naming and content
- `scripts/install.ps1`: deploys the extension into the local VS Code extensions folder and rewrites keybindings
- `scripts/smoke-test.ps1`: validates deployment and keybinding wiring
- `tests/snapshot.test.js`: Node-based unit tests for snapshot generation

## Install Or Reapply

Run this after Codex extension updates or when reinstalling the bridge:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

Then reload VS Code.

## Current Keybindings

The installer sets:

- `Ctrl+L` -> `codexContextBridge.addSelectionToThread`
- `Ctrl+Shift+L` -> `codexContextBridge.addActiveDocumentToThread`

## Native Behavior

Normal `file:` documents such as `README.md` still go through the original OpenAI Codex extension. That is why markdown files can show the native, cleaner file chip without the bridge.

## Test Commands

```powershell
node .\tests\snapshot.test.js
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
```
