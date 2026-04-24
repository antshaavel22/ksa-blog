/**
 * One-time migration: ctaType → funnel
 *
 *   ctaType starts with "kiirtest"  → funnel: flow3
 *   anything else (incl. "none")    → funnel: general
 *
 * Idempotent: skips files that already have a `funnel:` field.
 * Run: `npx tsx scripts/migrate-ctatype-to-funnel.ts [--dry-run]`
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const ROOTS = [
  path.join(process.cwd(), "content/posts"),
  path.join(process.cwd(), "content/drafts/et"),
  path.join(process.cwd(), "content/drafts/ru"),
  path.join(process.cwd(), "content/drafts/en"),
];

const DRY = process.argv.includes("--dry-run");

let touched = 0;
let skipped = 0;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .map((f) => path.join(dir, f));
}

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const raw = fs.readFileSync(file, "utf-8");
    const { data } = matter(raw);

    if (data.funnel) {
      skipped++;
      continue;
    }

    const ctaType = String(data.ctaType ?? "");
    const funnel = ctaType.startsWith("kiirtest") ? "flow3" : "general";

    // Insert `funnel: <value>` into the frontmatter block text-wise,
    // directly after the opening `---` line, to keep ordering predictable.
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) {
      skipped++;
      continue;
    }
    const fmBody = fmMatch[1];
    const newFmBody = `funnel: ${funnel}\n${fmBody}`;
    const updated = raw.replace(fmMatch[0], `---\n${newFmBody}\n---`);

    if (!DRY) fs.writeFileSync(file, updated, "utf-8");
    touched++;
  }
}

console.log(
  `${DRY ? "[DRY] " : ""}Migration complete: ${touched} file(s) updated, ${skipped} skipped.`
);
