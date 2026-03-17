"use strict";

const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const vscode = require("vscode");
const { buildSnapshotContent, buildSnapshotFileName } = require("./lib/snapshot");

const CHATGPT_ADD_TO_THREAD = "chatgpt.addToThread";
const CHATGPT_ADD_FILE_TO_THREAD = "chatgpt.addFileToThread";
const SNAPSHOT_BASE_ROOT = path.join(os.homedir(), ".codex-context-bridge", "snapshots");
const SESSION_ID = `session-${Date.now()}-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
const SNAPSHOT_ROOT = path.join(SNAPSHOT_BASE_ROOT, SESSION_ID);
const STALE_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function activate(context) {
  void prepareSnapshotStorage();

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

  context.subscriptions.push({
    dispose() {
      void cleanupCurrentSessionSnapshots();
    }
  });
}

function deactivate() {
  void cleanupCurrentSessionSnapshots();
}

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
  await fs.mkdir(SNAPSHOT_ROOT, { recursive: true });
  const snapshotPath = await reserveSnapshotPath(buildSnapshotFileName(context));
  const snapshotContent = buildSnapshotContent(context);
  await fs.writeFile(snapshotPath, snapshotContent, "utf8");

  return snapshotPath;
}

async function reserveSnapshotPath(baseName) {
  const parsed = path.parse(baseName);
  let attempt = 0;

  while (true) {
    const fileName =
      attempt === 0
        ? `${parsed.name}${parsed.ext}`
        : `${parsed.name} (${attempt + 1})${parsed.ext}`;
    const candidate = path.join(SNAPSHOT_ROOT, fileName);

    try {
      await fs.access(candidate);
      attempt += 1;
    } catch {
      return candidate;
    }
  }
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

async function prepareSnapshotStorage() {
  await fs.mkdir(SNAPSHOT_ROOT, { recursive: true });
  await cleanupStaleSnapshotSessions();
}

async function cleanupStaleSnapshotSessions() {
  let entries;

  try {
    entries = await fs.readdir(SNAPSHOT_BASE_ROOT, { withFileTypes: true });
  } catch {
    return;
  }

  const now = Date.now();

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sessionPath = path.join(SNAPSHOT_BASE_ROOT, entry.name);
    const stats = await fs.stat(sessionPath);

    if (now - stats.mtimeMs > STALE_SESSION_TTL_MS) {
      await fs.rm(sessionPath, { recursive: true, force: true });
    }
  }
}

async function cleanupCurrentSessionSnapshots() {
  await fs.rm(SNAPSHOT_ROOT, { recursive: true, force: true });
}

module.exports = {
  activate,
  deactivate
};
