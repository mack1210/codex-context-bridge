"use strict";

const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const vscode = require("vscode");
const { buildSnapshotFileName, buildSnapshotMarkdown } = require("./lib/snapshot");

const CHATGPT_ADD_TO_THREAD = "chatgpt.addToThread";
const CHATGPT_ADD_FILE_TO_THREAD = "chatgpt.addFileToThread";
const SNAPSHOT_ROOT = path.join(os.homedir(), ".codex-context-bridge", "snapshots");

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codexContextBridge.addSelectionToThread",
      () => addSelectionToThread()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codexContextBridge.addActiveDocumentToThread",
      () => addActiveDocumentToThread()
    )
  );
}

function deactivate() {}

async function addSelectionToThread() {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    return;
  }

  if (!editor.selection || editor.selection.isEmpty) {
    void vscode.window.showWarningMessage("No selection found for Codex context.");
    return;
  }

  if (editor.document.uri.scheme === "file") {
    await executeChatGptCommand(CHATGPT_ADD_TO_THREAD);
    return;
  }

  const snapshotPath = await materializeSnapshot(editor, "selection");
  await executeChatGptCommand(CHATGPT_ADD_FILE_TO_THREAD, vscode.Uri.file(snapshotPath));
}

async function addActiveDocumentToThread() {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    return;
  }

  if (editor.document.uri.scheme === "file") {
    await executeChatGptCommand(CHATGPT_ADD_FILE_TO_THREAD, editor.document.uri);
    return;
  }

  const snapshotPath = await materializeSnapshot(editor, "document");
  await executeChatGptCommand(CHATGPT_ADD_FILE_TO_THREAD, vscode.Uri.file(snapshotPath));
}

async function executeChatGptCommand(commandId, argument) {
  try {
    if (typeof argument === "undefined") {
      await vscode.commands.executeCommand(commandId);
      return;
    }

    await vscode.commands.executeCommand(commandId, argument);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OpenAI Codex extension command failed.";
    void vscode.window.showErrorMessage(message);
  }
}

async function materializeSnapshot(editor, mode) {
  const context = getSnapshotContext(editor, mode);
  const snapshotName = `${Date.now()}-${buildSnapshotFileName(context)}`;
  const snapshotContent = buildSnapshotMarkdown(context);

  await fs.mkdir(SNAPSHOT_ROOT, { recursive: true });
  await pruneOldSnapshots();

  const snapshotPath = path.join(SNAPSHOT_ROOT, snapshotName);
  await fs.writeFile(snapshotPath, snapshotContent, "utf8");

  return snapshotPath;
}

function getSnapshotContext(editor, mode) {
  const document = editor.document;
  const notebookInfo = findNotebookInfo(document.uri);
  const lineRange =
    mode === "selection" ? selectionToLineRange(editor.selection) : null;
  const content =
    mode === "selection" ? document.getText(editor.selection) : document.getText();
  const displayName = deriveDisplayName(document.uri, notebookInfo);
  const sourcePath =
    document.uri.scheme === "file" && document.uri.fsPath
      ? document.uri.fsPath
      : notebookInfo?.notebookPath || null;

  return {
    mode,
    displayName,
    sourceUri: document.uri.toString(),
    scheme: document.uri.scheme,
    languageId: document.languageId,
    sourcePath,
    notebookLabel: notebookInfo?.notebookLabel,
    notebookUri: notebookInfo?.notebookUri,
    cellIndex: notebookInfo?.cellIndex,
    lineRange,
    content
  };
}

function deriveDisplayName(uri, notebookInfo) {
  if (notebookInfo?.notebookLabel) {
    return notebookInfo.notebookLabel;
  }

  const uriPath = uri.fsPath || uri.path;
  const baseName = uriPath ? path.basename(uriPath) : "";

  return baseName || uri.authority || uri.scheme || "untitled";
}

function findNotebookInfo(targetUri) {
  for (const notebook of vscode.workspace.notebookDocuments) {
    const cells = notebook.getCells();
    const cellIndex = cells.findIndex(
      (cell) => cell.document.uri.toString() === targetUri.toString()
    );

    if (cellIndex === -1) {
      continue;
    }

    return {
      cellIndex: cellIndex + 1,
      notebookLabel:
        path.basename(notebook.uri.fsPath || notebook.uri.path) || notebook.uri.toString(),
      notebookPath: notebook.uri.fsPath || null,
      notebookUri: notebook.uri.toString()
    };
  }

  return null;
}

function selectionToLineRange(selection) {
  let endLine = selection.end.line;

  if (selection.end.character === 0 && endLine > selection.start.line) {
    endLine -= 1;
  }

  return {
    startLine: selection.start.line + 1,
    endLine: endLine + 1
  };
}

async function pruneOldSnapshots() {
  let entries;

  try {
    entries = await fs.readdir(SNAPSHOT_ROOT, { withFileTypes: true });
  } catch {
    return;
  }

  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const filePath = path.join(SNAPSHOT_ROOT, entry.name);
    const stats = await fs.stat(filePath);
    files.push({ filePath, modifiedMs: stats.mtimeMs });
  }

  files.sort((left, right) => right.modifiedMs - left.modifiedMs);

  for (const stale of files.slice(100)) {
    await fs.rm(stale.filePath, { force: true });
  }
}

module.exports = {
  activate,
  deactivate
};
