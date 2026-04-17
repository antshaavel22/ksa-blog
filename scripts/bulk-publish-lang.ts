/**
 * Bulk-publish all drafts in a language folder.
 * Moves content/drafts/{lang}/*.mdx → content/posts/*.mdx via filesystem rename.
 * Single commit, single Vercel deploy.
 *
 * Usage:
 *   npx tsx scripts/bulk-publish-lang.ts --lang ru [--dry]
 *
 * Does NOT run ICB/frontmatter cleanup — run that separately first if needed.
 */
import fs from "fs";
import path from "path";

const DRY = process.argv.includes("--dry");
const langArg = process.argv.find((a) => a.startsWith("--lang="))?.split("=")[1];
const lang = langArg || process.argv[process.argv.indexOf("--lang") + 1];
if (!lang || !["et", "ru", "en"].includes(lang)) {
  console.error("Usage: --lang et|ru|en");
  process.exit(1);
}

const src = path.join(process.cwd(), "content", "drafts", lang);
const dst = path.join(process.cwd(), "content", "posts");

if (!fs.existsSync(src)) {
  console.error(`No drafts folder: ${src}`);
  process.exit(1);
}

const files = fs.readdirSync(src).filter((f) => f.endsWith(".mdx"));
console.log(`\n${lang.toUpperCase()} drafts to publish: ${files.length}`);

let conflicts = 0;
for (const f of files) {
  const dstPath = path.join(dst, f);
  if (fs.existsSync(dstPath)) {
    console.warn(`  ⚠ conflict (already in posts/): ${f}`);
    conflicts++;
  }
}
if (conflicts > 0 && !process.argv.includes("--force")) {
  console.error(`\n${conflicts} conflict(s). Run with --force to overwrite, or resolve manually.`);
  process.exit(1);
}

if (DRY) {
  console.log("[DRY RUN — no files moved]");
  files.slice(0, 5).forEach((f) => console.log(`  would move: ${f}`));
  if (files.length > 5) console.log(`  ...and ${files.length - 5} more`);
  process.exit(0);
}

let moved = 0;
for (const f of files) {
  const srcPath = path.join(src, f);
  const dstPath = path.join(dst, f);
  fs.renameSync(srcPath, dstPath);
  moved++;
}
console.log(`\n✓ Moved ${moved} files from drafts/${lang}/ → posts/`);
console.log(`\nNext steps:`);
console.log(`  git add content/`);
console.log(`  git commit -m "Publish ${moved} ${lang.toUpperCase()} articles"`);
console.log(`  git push origin main   # triggers Vercel deploy`);
