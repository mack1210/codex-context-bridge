"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { buildSnapshotContent, buildSnapshotFileName } = require("../lib/snapshot");
const { resolveSnapshotPath, writeSnapshotFile } = require("../lib/snapshot-storage");

async function main() {
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

  const selectionMarkdown = buildSnapshotContent(selectionContext);
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

  const notebookMarkdown = buildSnapshotContent(notebookContext);
  assert.strictEqual(buildSnapshotFileName(notebookContext), "svd_practice.ipynb");
  assert.strictEqual(notebookMarkdown, "print('hello world')\n");

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codex-context-bridge-"));

  try {
    const repeatedSelectionContext = {
      mode: "selection",
      displayName: "svd_practice.ipynb",
      sourceUri:
        "vscode-notebook-cell:/c%3A/Users/flowe/Documents/Playground/svd_practice.ipynb#X14sZmlsZQ%3D%3D",
      scheme: "vscode-notebook-cell",
      languageId: "python",
      sourcePath: "C:\\Users\\flowe\\Documents\\Playground\\svd_practice.ipynb",
      notebookLabel: "svd_practice.ipynb",
      notebookUri: "file:///c%3A/Users/flowe/Documents/Playground/svd_practice.ipynb",
      cellIndex: 11,
      lineRange: {
        startLine: 1,
        endLine: 1
      },
      content: "singular_values = previous_value\n"
    };

    const firstPath = await writeSnapshotFile(tempRoot, repeatedSelectionContext);
    const updatedSelectionContext = {
      ...repeatedSelectionContext,
      content: "singular_values = np.sqrt(np.maximum(eigenvalues, 0))\n"
    };
    const secondPath = await writeSnapshotFile(tempRoot, updatedSelectionContext);

    assert.strictEqual(firstPath, secondPath);
    assert.ok(!firstPath.includes(" (2).md"));
    assert.strictEqual(
      secondPath,
      resolveSnapshotPath(tempRoot, repeatedSelectionContext)
    );

    const refreshedContent = await fs.readFile(secondPath, "utf8");
    assert.strictEqual(refreshedContent, buildSnapshotContent(updatedSelectionContext));
    assert.ok(
      refreshedContent.includes("singular_values = np.sqrt(np.maximum(eigenvalues, 0))")
    );
    assert.ok(!refreshedContent.includes("singular_values = previous_value"));

    const otherSourceSameLabel = {
      ...repeatedSelectionContext,
      sourceUri:
        "vscode-notebook-cell:/c%3A/Users/flowe/Documents/Playground/other_notebook.ipynb#X14sZmlsZQ%3D%3D"
    };

    assert.notStrictEqual(
      resolveSnapshotPath(tempRoot, repeatedSelectionContext),
      resolveSnapshotPath(tempRoot, otherSourceSameLabel)
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  console.log("snapshot tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
