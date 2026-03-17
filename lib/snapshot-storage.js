"use strict";

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { buildSnapshotContent, buildSnapshotFileName } = require("./snapshot");

function buildSnapshotSourceIdentity(context) {
  return String(
    context.sourceUri ||
      context.sourcePath ||
      context.notebookUri ||
      context.displayName ||
      context.scheme ||
      "untitled"
  );
}

function buildSnapshotOwnerDirectory(context) {
  const sourceHash = crypto
    .createHash("sha1")
    .update(buildSnapshotSourceIdentity(context))
    .digest("hex")
    .slice(0, 12);

  return `source-${sourceHash}`;
}

function resolveSnapshotPath(snapshotRoot, context) {
  return path.join(
    snapshotRoot,
    buildSnapshotOwnerDirectory(context),
    buildSnapshotFileName(context)
  );
}

async function writeSnapshotFile(snapshotRoot, context) {
  const snapshotPath = resolveSnapshotPath(snapshotRoot, context);
  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
  await fs.writeFile(snapshotPath, buildSnapshotContent(context), "utf8");
  return snapshotPath;
}

module.exports = {
  buildSnapshotOwnerDirectory,
  resolveSnapshotPath,
  writeSnapshotFile
};
