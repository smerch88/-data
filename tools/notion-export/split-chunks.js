#!/usr/bin/env node
/**
 * Split the converted markdown into smaller chunks readable through the
 * Read tool (which limits responses by token count).  We split on blank
 * lines so chunks are clean.
 */
const fs = require("node:fs");
const path = require("node:path");

const inputPath = process.argv[2];
const outputDir = process.argv[3];
const targetSize = Number(process.argv[4] || 14000); // chars per chunk

if (!inputPath || !outputDir) {
  console.error("Usage: split-chunks.js <input.md> <outDir> [targetChars]");
  process.exit(1);
}

const src = fs.readFileSync(inputPath, "utf8");
fs.mkdirSync(outputDir, { recursive: true });

// Split source into paragraphs by blank lines, preserving them
const paragraphs = src.split(/\n\n/);
const chunks = [];
let current = "";

for (const p of paragraphs) {
  const candidate = current ? `${current}\n\n${p}` : p;
  if (candidate.length > targetSize && current.length > 0) {
    chunks.push(current);
    current = p;
  } else {
    current = candidate;
  }
}
if (current.length > 0) chunks.push(current);

chunks.forEach((c, i) => {
  const idx = String(i + 1).padStart(2, "0");
  const file = path.join(outputDir, `chunk_${idx}.md`);
  fs.writeFileSync(file, c, "utf8");
  console.log(`chunk_${idx}: ${c.length} chars`);
});
console.log(`total: ${chunks.length} chunks`);
