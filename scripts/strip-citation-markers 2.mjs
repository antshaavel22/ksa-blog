// Remove orphaned numeric citation markers — [2], [2, 15], [11, 12, 13] — from
// post and draft text.
//
// These come in when an article is drafted from research notes: the numbers
// point at a bibliography that never ships, so the reader just sees noise
// mid-sentence ("...drifting across your field of vision [2, 15].").
//
// Markdown links are untouched: [text](url) has non-digit anchor text, and this
// only matches bracket groups that are purely digits, commas and spaces. Fenced
// code blocks are skipped so numeric arrays in code survive.
//
//   node scripts/strip-citation-markers.mjs --dry-run
//   node scripts/strip-citation-markers.mjs                    # posts only
//   node scripts/strip-citation-markers.mjs --include-drafts
//   node scripts/strip-citation-markers.mjs --file <path>
import fs from "fs";
import path from "path";

const DRY = process.argv.includes("--dry-run");
const WITH_DRAFTS = process.argv.includes("--include-drafts");
const fileArg = process.argv.indexOf("--file");
const ONLY = fileArg > -1 ? process.argv[fileArg + 1] : null;

// A marker is a bracket group of digits separated by commas: [2] [2, 15] [1,2,3]
const MARKER = /\[\s*\d+(?:\s*,\s*\d+)*\s*\]/g;

function stripLine(line) {
  // Drop the marker plus any space in front of it, so "vision [2, 15]." becomes
  // "vision." rather than "vision ." — then tidy any double space left behind.
  return line
    .replace(new RegExp(`[ \\t]*${MARKER.source}`, "g"), "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/g, "");
}

function stripFile(raw) {
  const lines = raw.split("\n");
  let inFence = false;
  let removed = 0;
  const out = lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return line; }
    if (inFence) return line;
    const hits = (line.match(MARKER) || []).length;
    if (!hits) return line;
    removed += hits;
    return stripLine(line);
  });
  return { text: out.join("\n"), removed };
}

const targets = [];
if (ONLY) {
  targets.push(ONLY);
} else {
  const dirs = ["content/posts"];
  if (WITH_DRAFTS) dirs.push("content/drafts/et", "content/drafts/ru", "content/drafts/en");
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (f.endsWith(".mdx")) targets.push(path.join(d, f));
    }
  }
}

let filesChanged = 0, totalRemoved = 0;
const report = [];
for (const p of targets) {
  const raw = fs.readFileSync(p, "utf8");
  const { text, removed } = stripFile(raw);
  if (!removed) continue;
  filesChanged++;
  totalRemoved += removed;
  report.push({ p, removed });
  if (!DRY) fs.writeFileSync(p, text);
}

report.sort((a, b) => b.removed - a.removed);
console.log(`Scanned ${targets.length} files.`);
console.log(`${DRY ? "Would remove" : "Removed"} ${totalRemoved} citation markers across ${filesChanged} files.\n`);
for (const r of report) console.log(`  ${String(r.removed).padStart(4)}  ${r.p}`);
if (DRY) console.log("\n(dry run — nothing written)");
