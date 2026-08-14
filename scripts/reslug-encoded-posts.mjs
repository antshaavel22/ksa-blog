// Re-slug the legacy WP-import posts whose filenames are still percent-encoded
// Cyrillic (e.g. "%d0%b0%d0%b3..."). These 404 on the live site (Next.js file
// routing doesn't decode them) and pollute the sitemap with dead URLs.
//
// For each: decode → transliterate to a clean Latin slug (matching the
// convention used by every other RU post in the repo) → git mv → update the
// `slug:` frontmatter field to match → collision-check first.
//
//   node scripts/reslug-encoded-posts.mjs --dry-run
//   node scripts/reslug-encoded-posts.mjs
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import matter from "gray-matter";

const DRY = process.argv.includes("--dry-run");
const dir = "content/posts";

// RU/ET Cyrillic → Latin transliteration (standard scheme, matches existing
// repo slugs like "otlichnye-novosti-o-presbiopii", "kakoe-lekarstvo-...").
const MAP = {
  а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", ё:"yo", ж:"zh", з:"z", и:"i",
  й:"y", к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t",
  у:"u", ф:"f", х:"kh", ц:"ts", ч:"ch", ш:"sh", щ:"shch", ъ:"", ы:"y",
  ь:"", э:"e", ю:"yu", я:"ya",
  // Estonian diacritics, just in case
  õ:"o", ä:"a", ö:"o", ü:"u", š:"sh", ž:"zh",
};
function transliterate(s) {
  return s
    .toLowerCase()
    .split("")
    .map((c) => (c in MAP ? MAP[c] : c))
    .join("");
}
function slugify(decoded) {
  return transliterate(decoded)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

const files = fs.readdirSync(dir).filter((f) => f.includes("%") && f.endsWith(".mdx"));
console.log(`Found ${files.length} percent-encoded filenames.\n`);

const existing = new Set(fs.readdirSync(dir));
const plan = [];
for (const f of files) {
  // Decode the WHOLE filename (handles a leading "123-" numeric prefix too).
  let decoded;
  try { decoded = decodeURIComponent(f.replace(/\.mdx$/, "")); }
  catch { console.log(`⚠ could not decode: ${f}`); continue; }

  let g;
  try { g = matter(fs.readFileSync(path.join(dir, f), "utf8")); }
  catch (e) { console.log(`⚠ parse fail: ${f} — ${e.message}`); continue; }

  const lang = String(g.data.lang || "").trim() || "ru";
  const date = String(g.data.date || "").trim();
  // The encoded filename doesn't always match the post's real language (one
  // ET post carries a Russian-text-encoded legacy slug even though its title
  // and body are genuinely Estonian). Trust `lang`, not the stale filename:
  // for non-RU posts, derive the slug from the post's own (correct-language)
  // title instead of transliterating Cyrillic that was never accurate.
  const source = lang === "ru" ? decoded : String(g.data.title || decoded);
  let base = slugify(source);
  if (!base) { console.log(`⚠ empty slug after transliteration: ${f}`); continue; }

  let newName = `${base}.mdx`;
  let n = 2;
  while (existing.has(newName) || plan.some((p) => p.newName === newName)) {
    newName = `${base}-${n}.mdx`;
    n++;
  }
  plan.push({ oldFile: f, newName, newSlug: base, lang, date, title: String(g.data.title || "").slice(0, 60) });
}

console.log(`Plan (${plan.length} renames):\n`);
for (const p of plan) {
  console.log(`  [${p.lang}] ${p.oldFile.slice(0, 30)}…  →  ${p.newName}`);
  console.log(`        ${p.title}`);
}

if (DRY) { console.log("\n(dry run — nothing written)"); process.exit(0); }

let ok = 0;
for (const p of plan) {
  const oldPath = path.join(dir, p.oldFile);
  const newPath = path.join(dir, p.newName);
  // Update slug: field before moving. Some legacy files have an unquoted,
  // line-wrapped slug value (a raw percent-encoded string broken across
  // lines) — consume any indented continuation lines too, else replacing
  // just the first line orphans the rest and breaks the YAML.
  let raw = fs.readFileSync(oldPath, "utf8");
  const slugBlockRe = /^slug:.*$(?:\n[ \t]+\S.*$)*/m;
  if (slugBlockRe.test(raw)) raw = raw.replace(slugBlockRe, () => `slug: "${p.newSlug}"`);
  else raw = raw.replace(/^(title:.*)$/m, `$1\nslug: "${p.newSlug}"`);
  fs.writeFileSync(oldPath, raw);
  try {
    execSync(`git mv ${JSON.stringify(oldPath)} ${JSON.stringify(newPath)}`, { stdio: "pipe" });
    ok++;
  } catch (e) {
    console.log(`✗ git mv failed for ${p.oldFile}: ${e.message}`);
  }
}
console.log(`\nDone. Renamed ${ok}/${plan.length}.`);
