// Repair blog URLs that were cut mid-word or left a dangling hyphen.
//
// Cause: the old toSlug() applied .slice(0, 60) as its LAST step, after trimming
// hyphens, so the cut landed wherever it landed —
//   /breakthroughs-in-dry-eye-management-from-punctum-plugs-to-qu
//   /an-optometrist-with-a-figure-skater-s-precision-anita-bauer-
// Generation itself is fixed in lib/slug.mjs; this repairs what already shipped.
//
// Scope is deliberately narrow (Ants + marketing, 2026-08-15): only URLs that
// are actually broken. The ~397 posts whose slug no longer matches a rewritten
// title are NOT touched — they work, they rank, and churning a third of the
// indexed site is risk without much reward.
//
// Each rename ships with a 301 from the old URL. Files are renamed as well as
// the frontmatter, because getPostBySlug() matches filename OR slug — leaving
// the filename would keep the old URL serving 200 and create duplicate content.
//
//   node scripts/fix-truncated-slugs.mjs --dry-run
//   node scripts/fix-truncated-slugs.mjs
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const DRY = process.argv.includes("--dry-run");
const plan = JSON.parse(fs.readFileSync("/tmp/slug-plan.json", "utf8"));
const dir = "content/posts";

// Replace the slug scalar, consuming any indented continuation lines.
function setSlug(raw, value) {
  const block = /^slug:.*$(?:\n[ \t]+\S.*$)*/m;
  return block.test(raw)
    ? raw.replace(block, `slug: "${value}"`)
    : raw.replace(/^(title:.*)$/m, `$1\nslug: "${value}"`);
}

let renamed = 0;
const redirects = [];
for (const p of plan) {
  const oldPath = path.join(dir, p.f);
  if (!fs.existsSync(oldPath)) { console.log("missing:", p.f); continue; }
  const raw = setSlug(fs.readFileSync(oldPath, "utf8"), p.newSlug);
  const newFile = `${p.newSlug}.mdx`;
  const newPath = path.join(dir, newFile);

  if (!DRY) {
    fs.writeFileSync(oldPath, raw);
    if (p.f !== newFile) {
      try { execSync(`git mv ${JSON.stringify(oldPath)} ${JSON.stringify(newPath)}`, { stdio: "pipe" }); }
      catch { fs.renameSync(oldPath, newPath); }
    }
  }
  redirects.push({ source: `/${p.slug}`, destination: `/${p.newSlug}`, permanent: true });
  renamed++;
}

// Internal links in post bodies point at a couple of the old slugs — rewrite
// them so they don't depend on the redirect hop.
let linkFixes = 0;
if (!DRY) {
  const map = new Map(plan.map((p) => [p.slug, p.newSlug]));
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".mdx")) continue;
    const fp = path.join(dir, f);
    let t = fs.readFileSync(fp, "utf8");
    let changed = false;
    for (const [oldS, newS] of map) {
      if (t.includes(`/${oldS}`)) { t = t.split(`/${oldS}`).join(`/${newS}`); changed = true; linkFixes++; }
    }
    if (changed) fs.writeFileSync(fp, t);
  }
}

if (!DRY) fs.writeFileSync("data/slug-redirects.json", JSON.stringify(redirects, null, 2) + "\n");
console.log(`${DRY ? "Would fix" : "Fixed"} ${renamed} slugs, ${redirects.length} redirects, ${linkFixes} internal link(s) rewritten.`);
if (DRY) console.log("(dry run — nothing written)");
