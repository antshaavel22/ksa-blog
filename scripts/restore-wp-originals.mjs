// Restore the pre-AI WordPress text on the ET customer/patient stories.
//
// Silvia asked for these back as they were. What the AI facelift actually did
// (verified by word-level diff against the import commit) is narrow:
//   • 0 words deleted — no original prose was lost or rewritten
//   • it INSERTED "## ..." section headings and **bold**, in its own editorial
//     voice, into stories told by real named patients
//
// So restoring is safe: the body returns to the WordPress text exactly, and only
// the invented headings and emphasis go away.
//
// Titles are restored only where the WordPress title was Estonian. Three of
// these posts had RUSSIAN titles on Estonian articles in WordPress — a bug fixed
// later in b98745e0 — and those are deliberately left as they are now.
//
// Everything else in frontmatter (image, categories, CTA, excerpt, reviewer) is
// untouched.
//
//   node scripts/restore-wp-originals.mjs --dry-run
//   node scripts/restore-wp-originals.mjs
import fs from "fs";
import { execSync } from "child_process";
import matter from "gray-matter";

const DRY = process.argv.includes("--dry-run");
const files = fs.readFileSync("/tmp/story-posts.txt", "utf8").trim().split("\n");
const hasCyrillic = (s) => /[А-Яа-яЁё]/.test(s);

// Replace one scalar frontmatter field in the raw text, preserving all others.
function setField(raw, key, value) {
  const yaml = value.includes('"') ? `'${value.replace(/'/g, "''")}'` : `"${value}"`;
  const block = new RegExp(`^${key}:.*$(?:\\n[ \\t]+\\S.*$)*`, "m");
  return block.test(raw) ? raw.replace(block, `${key}: ${yaml}`) : raw;
}

let bodies = 0, titles = 0, skipped = 0;
for (const f of files) {
  const p = `content/posts/${f}`;
  const first = execSync(`git log --format=%H --reverse -- ${JSON.stringify(p)}`)
    .toString().trim().split("\n")[0];
  const orig = matter(execSync(`git show ${first}:${JSON.stringify(p)}`, { maxBuffer: 1e8 }).toString());
  const cur = fs.readFileSync(p, "utf8");
  const curParsed = matter(cur);

  // Body: swap in the WordPress text, keep the current frontmatter block intact.
  const fmBlock = cur.slice(0, cur.length - curParsed.content.length);
  let out = fmBlock + orig.content.trimStart();
  if (orig.content.trim() !== curParsed.content.trim()) bodies++;

  const wpTitle = String(orig.data.title ?? "").trim();
  const curTitle = String(curParsed.data.title ?? "").trim();
  if (wpTitle && wpTitle !== curTitle) {
    if (hasCyrillic(wpTitle)) {
      skipped++;
      console.log(`  skip title (WP title was Russian): ${f}`);
    } else {
      out = setField(out, "title", wpTitle);
      titles++;
    }
  }

  if (!DRY) fs.writeFileSync(p, out);
}
console.log(`\n${DRY ? "Would restore" : "Restored"}: ${bodies} bodies, ${titles} titles (${skipped} titles left alone).`);
if (DRY) console.log("(dry run — nothing written)");
