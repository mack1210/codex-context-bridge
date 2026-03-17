"use strict";

const path = require("path");

function sanitizeSegment(value) {
  const normalized = String(value || "untitled")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized || "untitled";
}

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

function buildSnapshotFileName(context) {
  const sourceStem = sanitizeSegment(
    context.displayName || path.basename(context.sourcePath || "") || context.scheme
  );
  const suffix = context.mode === "selection" ? "selection" : "document";

  return `${sourceStem}-${suffix}.md`;
}

function buildSnapshotMarkdown(context) {
  const lines = [
    `Source: ${context.displayName || "Untitled"}`,
    `Source URI: ${context.sourceUri}`,
    `Scheme: ${context.scheme}`,
    `Language: ${context.languageId || "plaintext"}`
  ];

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

  if (context.lineRange) {
    lines.push(`Selected Lines: ${context.lineRange.startLine}-${context.lineRange.endLine}`);
  }

  lines.push("");
  lines.push("```" + normalizeFenceLanguage(context.languageId));
  lines.push(context.content.endsWith("\n") ? context.content.slice(0, -1) : context.content);
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

module.exports = {
  buildSnapshotFileName,
  buildSnapshotMarkdown
};
