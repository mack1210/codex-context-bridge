"use strict";

const path = require("path");

function normalizeFenceLanguage(languageId) {
  const known = new Set([
    "bash",
    "c",
    "cpp",
    "csharp",
    "go",
    "java",
    "javascript",
    "json",
    "markdown",
    "powershell",
    "python",
    "ruby",
    "rust",
    "shellscript",
    "sql",
    "text",
    "typescript",
    "yaml"
  ]);

  if (!languageId) {
    return "";
  }

  if (languageId === "plaintext") {
    return "text";
  }

  if (languageId === "shellscript") {
    return "bash";
  }

  return known.has(languageId) ? languageId : "";
}

function sanitizeFileName(value) {
  const sanitized = String(value || "untitled")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized || "untitled";
}

function formatSelectionLabel(context) {
  const parts = [];

  if (typeof context.cellIndex === "number") {
    parts.push(`Cell ${context.cellIndex}`);
  }

  if (context.lineRange) {
    if (context.lineRange.startLine === context.lineRange.endLine) {
      parts.push(`Line ${context.lineRange.startLine}`);
    } else {
      parts.push(`Lines ${context.lineRange.startLine}-${context.lineRange.endLine}`);
    }
  } else if (context.mode === "document") {
    parts.push("Document");
  }

  return parts.join(", ");
}

function buildSnapshotFileName(context) {
  const sourceStem = sanitizeFileName(
    context.displayName || path.basename(context.sourcePath || "") || context.scheme
  );

  if (context.mode === "document") {
    return sourceStem;
  }

  const selectionLabel = formatSelectionLabel(context);

  if (!selectionLabel) {
    return `${sourceStem}.md`;
  }

  return sanitizeFileName(`${sourceStem} [${selectionLabel}]`) + ".md";
}

function buildSelectionSnapshotMarkdown(context) {
  const selectionLabel = formatSelectionLabel(context);
  const lines = [
    `Source: ${context.displayName || "Untitled"}`,
    `Scheme: ${context.scheme}`,
    `Language: ${context.languageId || "plaintext"}`
  ];

  if (selectionLabel) {
    lines.push(`Selection: ${selectionLabel}`);
  }

  if (context.sourcePath) {
    lines.push(`Source Path: ${context.sourcePath}`);
  }

  if (context.notebookLabel) {
    lines.push(`Notebook: ${context.notebookLabel}`);
  }

  if (context.notebookUri) {
    lines.push(`Notebook URI: ${context.notebookUri}`);
  }

  if (typeof context.cellIndex === "number") {
    lines.push(`Notebook Cell: ${context.cellIndex}`);
  }

  lines.push(`Source URI: ${context.sourceUri}`);

  lines.push("");
  lines.push("```" + normalizeFenceLanguage(context.languageId));
  lines.push(context.content.endsWith("\n") ? context.content.slice(0, -1) : context.content);
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

function buildSnapshotContent(context) {
  if (context.mode === "document") {
    return context.content.endsWith("\n") ? context.content : `${context.content}\n`;
  }

  return buildSelectionSnapshotMarkdown(context);
}

module.exports = {
  buildSnapshotFileName,
  buildSnapshotContent,
  sanitizeFileName
};
