/**
 * Align RU & EN draft dates to their ET sister article's date
 * (sister = ET article whose title matches `translatedFrom` frontmatter).
 *
 * Sources searched for ET sisters:
 *   - content/posts/      (published ET articles, most common)
 *   - content/drafts/et/  (unpublished ET drafts)
 *
 * Behaviour:
 *   - If ET sister found → set draft's date = ET sister's date, rename filename
 *   - If not found → leave current (redistributed) date as-is
 *   - Handles duplicate dates: appends +1 day if a sister-aligned date already used by another draft in same lang
 *
 * Dry run: `npx tsx scripts/align-sister-dates.ts --dry` (no writes)
 * Default runs for both RU and EN. Use --lang ru|en to limit.
 */
import fs from "fs";
import path from "path";

const DRY = process.argv.includes("--dry");
const langArg = process.argv.find((a) => a.startsWith("--lang="))?.split("=")[1];
const LANGS = langArg ? [langArg] : ["ru", "en"];
const ROOT = path.join(process.cwd(), "content");

function readFm(file: string): Record<string, string> {
  const content = fs.readFileSync(file, "utf-8");
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-zA-Z]+):\s*['"]?([^'"]*)['"]?\s*$/);
    if (kv) fm[kv[1]] = kv[2];
  }
  return fm;
}

// Build ET title → date lookup from posts + et drafts
const etIndex = new Map<string, string>();
const etSources = [path.join(ROOT, "posts"), path.join(ROOT, "drafts", "et")];
for (const dir of etSources) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"))) {
    const fm = readFm(path.join(dir, f));
    if (fm.lang && fm.lang !== "et") continue;
    if (fm.title && fm.date) {
      // strip any leading/trailing whitespace for match
      etIndex.set(fm.title.trim(), fm.date);
    }
  }
}
console.log(`ET index: ${etIndex.size} titles indexed`);

for (const lang of LANGS) {
  const dir = path.join(ROOT, "drafts", lang);
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"));
  const usedDates = new Set<string>();
  let aligned = 0;
  let orphans = 0;

  console.log(`\n${lang.toUpperCase()}: ${files.length} drafts`);

  // Pass 1: collect sister-aligned dates with conflict resolution
  const plan: Array<{ file: string; newDate: string; aligned: boolean }> = [];
  for (const f of files) {
    const fPath = path.join(dir, f);
    const fm = readFm(fPath);
    const sisterTitle = (fm.translatedFrom || "").trim();
    let newDate: string | null = null;
    if (sisterTitle && etIndex.has(sisterTitle)) {
      newDate = etIndex.get(sisterTitle)!;
      // conflict resolution: bump +1 day if taken
      while (usedDates.has(`${lang}:${newDate}`)) {
        const d = new Date(newDate + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + 1);
        newDate = d.toISOString().split("T")[0];
      }
      usedDates.add(`${lang}:${newDate}`);
      aligned++;
      plan.push({ file: f, newDate, aligned: true });
    } else {
      orphans++;
      plan.push({ file: f, newDate: fm.date, aligned: false });
    }
  }

  console.log(`  ✓ sister-aligned: ${aligned}`);
  console.log(`  · orphan (no ET sister): ${orphans}`);

  if (DRY) {
    console.log("  [DRY RUN — no changes written]");
    continue;
  }

  // Pass 2: write + rename
  for (const { file, newDate, aligned } of plan) {
    if (!aligned) continue;
    const oldPath = path.join(dir, file);
    const base = file.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    const newName = `${newDate}-${base}`;
    const newPath = path.join(dir, newName);
    let content = fs.readFileSync(oldPath, "utf-8");
    content = content.replace(/^date:\s*.*$/m, `date: "${newDate}"`);
    fs.writeFileSync(oldPath, content);
    if (newName !== file) fs.renameSync(oldPath, newPath);
  }
  console.log(`  ✓ ${aligned} files updated`);
}

console.log("\nDone.");
