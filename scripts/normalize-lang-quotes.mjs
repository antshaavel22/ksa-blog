// Diagnostic finding: 87 posts have an unquoted `lang: et` frontmatter
// scalar instead of `lang: "et"`. Both parse identically in YAML, but every
// scanner/tool that greps frontmatter as text has to handle both forms —
// this exact wrinkle has complicated several past audits. One normalization
// pass makes all future tooling simpler.
//
//   node scripts/normalize-lang-quotes.mjs --dry-run
//   node scripts/normalize-lang-quotes.mjs
import fs from "fs";
import path from "path";

const DRY = process.argv.includes("--dry-run");
const dir = "content/posts";
const RE = /^lang:\s*(et|ru|en)\s*$/m;

let changed = 0, scanned = 0;
const touched = [];

for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".mdx")) continue;
  scanned++;
  const p = path.join(dir, f);
  const raw = fs.readFileSync(p, "utf8");
  if (!RE.test(raw)) continue;
  const updated = raw.replace(RE, (_, val) => `lang: "${val}"`);
  changed++;
  touched.push(f);
  if (!DRY) fs.writeFileSync(p, updated);
}

console.log(`Scanned ${scanned} posts.`);
console.log(`${DRY ? "Would normalize" : "Normalized"} lang quoting in ${changed} posts.`);
if (DRY) console.log("\n(dry run — nothing written)");
