"use strict";

const assert = require("assert");
const { buildSnapshotFileName, buildSnapshotMarkdown } = require("../lib/snapshot");

const selectionContext = {
  mode: "selection",
  displayName: "keybindings.json",
  sourceUri: "vscode-userdata:/User/profiles/6da8aac0/keybindings.json",
  scheme: "vscode-userdata",
  languageId: "json",
  sourcePath: null,
  lineRange: {
    startLine: 1,
    endLine: 4
  },
  content: '[{"key":"ctrl+l"}]'
};

assert.strictEqual(
  buildSnapshotFileName(selectionContext),
  "keybindings.json [Lines 1-4].md"
);

const selectionMarkdown = buildSnapshotMarkdown(selectionContext);
assert.match(selectionMarkdown, /Source: keybindings\.json/);
assert.match(selectionMarkdown, /Scheme: vscode-userdata/);
assert.match(selectionMarkdown, /Selection: Lines 1-4/);
assert.match(selectionMarkdown, /```json/);
assert.match(selectionMarkdown, /\[\{"key":"ctrl\+l"\}\]/);

const notebookContext = {
  mode: "document",
  displayName: "svd_practice.ipynb",
  sourceUri: "vscode-notebook-cell:/c%3A/Users/flowe/Documents/Playground/svd_practice.ipynb#cell1",
  scheme: "vscode-notebook-cell",
  languageId: "python",
  sourcePath: "C:\\Users\\flowe\\Documents\\Playground\\svd_practice.ipynb",
  notebookLabel: "svd_practice.ipynb",
  notebookUri: "file:///c%3A/Users/flowe/Documents/Playground/svd_practice.ipynb",
  cellIndex: 2,
  lineRange: null,
  content: "print('hello world')\n"
};

const notebookMarkdown = buildSnapshotMarkdown(notebookContext);
assert.strictEqual(
  buildSnapshotFileName(notebookContext),
  "svd_practice.ipynb [Cell 2, Document].md"
);
assert.match(notebookMarkdown, /Notebook: svd_practice\.ipynb/);
assert.match(notebookMarkdown, /Notebook Cell: 2/);
assert.match(notebookMarkdown, /Selection: Cell 2, Document/);
assert.match(notebookMarkdown, /Source Path: C:\\Users\\flowe\\Documents\\Playground\\svd_practice\.ipynb/);
assert.match(notebookMarkdown, /```python/);

console.log("snapshot tests passed");
