#!/usr/bin/env node
/**
 * Convert standard markdown (PROJECT_VISION.md) to Notion-flavored markdown.
 *
 * Transformations:
 *  - GitHub-style pipe tables → Notion HTML <table> blocks
 *  - <a id="..."></a> anchor tags → stripped (Notion has no inline anchors)
 *  - In-page anchor links [text](#anchor) → plain bold text (link target gone)
 *  - Everything else passes through
 */

const fs = require("node:fs");
const path = require("node:path");

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath) {
  console.error("Usage: node md-to-notion.js <input.md> <output.md>");
  process.exit(1);
}

const src = fs.readFileSync(inputPath, "utf8");
const lines = src.split(/\r?\n/);

const out = [];
let i = 0;

const isTableSeparator = (s) =>
  /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(s);
const isTableRow = (s) => /^\s*\|.*\|\s*$/.test(s);

const splitRow = (line) => {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
};

// Strip <a id="..."></a> and similar anchor tags (preserve any inner text).
const stripAnchorTags = (s) =>
  s
    .replace(/<a\s+id=["'][^"']*["']\s*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<a\s+id=["'][^"']*["']\s*\/>/gi, "")
    .replace(/<a\s+name=["'][^"']*["']\s*>([\s\S]*?)<\/a>/gi, "$1");

// Convert in-page anchor links [text](#anchor) → **text** (bold, no link).
// External links and mailto are kept untouched.
const stripInPageAnchors = (s) =>
  s.replace(
    /\[([^\]]+)\]\(#[^)]+\)/g,
    (_m, text) => `**${text.replace(/\*\*/g, "")}**`,
  );

const cleanInline = (s) => stripInPageAnchors(stripAnchorTags(s));

const renderCell = (s) => cleanInline(s);

const flushTable = (header, separator, rows) => {
  // Header row included if separator present (always true here).
  const colCount = header.length;
  out.push(`<table fit-page-width="true" header-row="true">`);
  out.push(`\t<tr>`);
  for (const cell of header) {
    out.push(`\t\t<td>${renderCell(cell)}</td>`);
  }
  out.push(`\t</tr>`);
  for (const row of rows) {
    // Pad/truncate to header column count
    const cells = row.slice(0, colCount);
    while (cells.length < colCount) cells.push("");
    out.push(`\t<tr>`);
    for (const cell of cells) {
      out.push(`\t\t<td>${renderCell(cell)}</td>`);
    }
    out.push(`\t</tr>`);
  }
  out.push(`</table>`);
};

let inFence = false;
let fenceMarker = "";

while (i < lines.length) {
  const line = lines[i];

  // Track fenced code blocks — pass through unchanged
  const fenceMatch = line.match(/^(\s*)(```+|~~~+)(.*)$/);
  if (fenceMatch) {
    const marker = fenceMatch[2];
    if (!inFence) {
      inFence = true;
      fenceMarker = marker;
    } else if (line.trim().startsWith(fenceMarker)) {
      inFence = false;
      fenceMarker = "";
    }
    out.push(line);
    i++;
    continue;
  }
  if (inFence) {
    out.push(line);
    i++;
    continue;
  }

  // Detect pipe table: header row + separator row
  if (
    isTableRow(line) &&
    i + 1 < lines.length &&
    isTableSeparator(lines[i + 1])
  ) {
    const header = splitRow(line);
    const separator = lines[i + 1];
    const rows = [];
    let j = i + 2;
    while (j < lines.length && isTableRow(lines[j])) {
      rows.push(splitRow(lines[j]));
      j++;
    }
    flushTable(header, separator, rows);
    i = j;
    continue;
  }

  // Otherwise, clean inline syntax and emit
  out.push(cleanInline(line));
  i++;
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, out.join("\n"), "utf8");

const inSize = src.length;
const outSize = out.join("\n").length;
console.log(
  `Converted: ${inputPath} (${inSize} chars) → ${outputPath} (${outSize} chars)`,
);
