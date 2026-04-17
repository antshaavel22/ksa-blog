/**
 * Redistribute draft publication dates evenly across 2025-01-01 → 2026-04-15.
 * Updates both filename date prefix AND `date:` frontmatter field.
 * Preserves current sort order (by existing date prefix in filename).
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "content", "drafts");
const LANGS = ["ru", "en", "et"];
const START = new Date("2025-01-01T00:00:00Z");
const END = new Date("2026-04-15T00:00:00Z");
const DAY = 86400000;

function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
}

for (const lang of LANGS) {
  const dir = path.join(ROOT, lang);
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx")).sort();
  if (files.length === 0) continue;

  const totalDays = (END.getTime() - START.getTime()) / DAY;
  const step = files.length > 1 ? totalDays / (files.length - 1) : 0;

  console.log(`\n${lang.toUpperCase()}: ${files.length} drafts → 1 per ~${step.toFixed(1)} days`);

  files.forEach((f, i) => {
    const newDate = ymd(new Date(START.getTime() + Math.round(i * step) * DAY));
    const base = f.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    const newName = `${newDate}-${base}`;
    const oldPath = path.join(dir, f);
    const newPath = path.join(dir, newName);

    let content = fs.readFileSync(oldPath, "utf-8");
    content = content.replace(/^date:\s*.*$/m, `date: "${newDate}"`);
    fs.writeFileSync(oldPath, content);
    if (newName !== f) fs.renameSync(oldPath, newPath);
  });

  console.log(`  ✓ first: ${ymd(START)}  last: ${ymd(END)}`);
}

console.log("\nDone.");
