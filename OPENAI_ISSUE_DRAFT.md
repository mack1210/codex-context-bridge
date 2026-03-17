# Feature request: support `Add to Codex Thread` from non-file VS Code editors

## Suggested title

`chatgpt.addToThread` should support notebook cells and other non-file VS Code editors

## Summary

In the VS Code Codex extension, `chatgpt.addToThread` and `chatgpt.addFileToThread` work well for normal `file:` editors, but they do not work for editors backed by non-file URI schemes such as:

- `vscode-notebook-cell`
- `vscode-userdata`

This means `Ctrl+L` fails for common workflows such as:

- selected code inside `.ipynb` notebook cells
- selected content inside VS Code profile JSON files like `keybindings.json`

## Reproduction

1. Open a notebook `.ipynb` file in VS Code.
2. Select text inside a notebook cell.
3. Trigger a keybinding that runs `chatgpt.addToThread` such as `Ctrl+L`.

Or:

1. Open a VS Code profile file such as `keybindings.json`.
2. Select some lines.
3. Trigger `chatgpt.addToThread`.

## Actual behavior

- Nothing is attached to Codex chat.
- The command effectively no-ops for non-file editors.

## Expected behavior

The extension should support these editors natively.

Suggested UX:

- For partial selection:
  - attach the selected content with source metadata
  - for notebooks, show file name plus cell and line information when possible
  - for virtual JSON/profile editors, show file name plus selected line range when possible

- For full-document attach:
  - keep the chip minimal and show only the source file name where possible

Examples:

- `svd_practice.ipynb • Cell 8:1`
- `keybindings.json • Lines 12-18`
- full document: `svd_practice.ipynb`

## Observed cause

From local inspection of the installed extension bundle, the add-to-thread path appears to return early unless the active editor URI scheme is exactly `file`.

That matches the observed behavior:

- normal `.py` and `.md` files work
- notebook cells and VS Code profile editors do not

## Why this matters

Notebook cells and VS Code virtual editors are common editing surfaces.

Current behavior makes Codex less useful exactly where quick contextual handoff is valuable:

- exploratory notebook work
- editor and profile configuration
- virtual documents surfaced by VS Code and extensions

## Suggested implementation direction

Any native fix would be helpful, but two approaches seem reasonable:

1. Extend `chatgpt.addToThread` and `chatgpt.addFileToThread` to accept non-file text editors and serialize their content internally.
2. Preserve native file behavior, but add a fallback path for non-file editors that:
   - materializes a temporary internal snapshot
   - attaches that snapshot to the thread
   - preserves source metadata for cell or line context

## Environment

- VS Code: recent stable builds
- Codex VS Code extension display name: `Codex – OpenAI’s coding agent`
- Reproduced with notebook cells and profile `keybindings.json`

## Notes

- The IDE extension is not open source, so I am filing this as a feature request rather than preparing a direct PR.
- According to the Codex open source docs, IDE extension issues and feature requests should still go through `openai/codex/issues`.
