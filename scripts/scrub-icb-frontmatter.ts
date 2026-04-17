/**
 * Scrub ICB mentions from draft frontmatter (tags, excerpts, seoTitle, seoExcerpt).
 * The body was cleaned by the RU editor batch; frontmatter was preserved as-is.
 * Also normalises "Таллин" → "Таллинн" (two н) in RU frontmatter fields.
 *
 * Usage: npx tsx scripts/scrub-icb-frontmatter.ts [--lang ru] [--dry]
 */
import fs from "fs";
import path from "path";

const DRY = process.argv.includes("--dry");
const langArg = process.argv.find((a) => a.startsWith("--lang="))?.split("=")[1];
const LANGS = langArg ? [langArg] : ["ru", "en", "et"];

function scrub(content: string, lang: string): { next: string; changed: boolean } {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { next: content, changed: false };
  let fm = m[1];
  const before = fm;

  // Remove ICB tags (handle both array and YAML-list styles)
  fm = fm.replace(/"ICB[^"]*"[,\s]*/g, "");
  fm = fm.replace(/\n\s*-\s*"?ICB[^\n]*\n/g, "\n");

  // Strip ICB mentions from scalar fields (excerpt, seoExcerpt, seoTitle)
  fm = fm.replace(/(\s*)и\s*ICB[^.",\n]*/g, "$1");
  fm = fm.replace(/(,\s*)ICB[^.",\n]*/g, "");
  fm = fm.replace(/\s*·\s*ICB[^.",\n]*/g, "");
  fm = fm.replace(/\bICB[™®]*[^\s,."]*\s*/g, "");

  // Clean up duplicate commas/spaces left behind
  fm = fm.replace(/,\s*,/g, ",");
  fm = fm.replace(/,\s*"/g, ', "');
  fm = fm.replace(/\[\s*,/g, "[");
  fm = fm.replace(/,\s*\]/g, "]");
  fm = fm.replace(/ +/g, " ");

  // Russian spelling fix — Таллин → Таллинн (one н → two н), but not if already Таллинн
  if (lang === "ru") {
    fm = fm.replace(/Таллин(?!н)/g, "Таллинн");
  }

  const changed = fm !== before;
  return { next: content.replace(m[1], fm), changed };
}

for (const lang of LANGS) {
  const dir = path.join(process.cwd(), "content", "drafts", lang);
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"));
  let changed = 0;
  for (const f of files) {
    const p = path.join(dir, f);
    const content = fs.readFileSync(p, "utf-8");
    const { next, changed: did } = scrub(content, lang);
    if (did) {
      changed++;
      if (!DRY) fs.writeFileSync(p, next);
    }
  }
  console.log(`${lang.toUpperCase()}: ${changed}/${files.length} files ${DRY ? "would change" : "cleaned"}`);
}
