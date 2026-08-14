// Audit excerpt quality against the house rule (see lib/excerpt-rules.mjs):
// an excerpt is ORIGINAL copy — exactly two sentences that catchily summarise the
// whole article — never sentences lifted from the body, never cut mid-sentence.
//
//   node scripts/audit-excerpts.mjs            # summary
//   node scripts/audit-excerpts.mjs --list     # + every failing file
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { LANG_NAMES, plainBody, validateExcerpt } from "../lib/excerpt-rules.mjs";

const LIST = process.argv.includes("--list");
const dir = "content/posts";

let total = 0, clean = 0;
const failing = [];
const byReason = {};
const byLang = {};

for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".mdx")) continue;
  total++;
  let g;
  try { g = matter(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }

  const lang = String(g.data.lang || "").trim();
  const excerpt = String(g.data.excerpt ?? "").trim();
  const reason = validateExcerpt(excerpt, LANG_NAMES[lang] ? lang : null, plainBody(g.content), { title: String(g.data.title ?? "") });

  if (!reason) { clean++; continue; }
  // Bucket by the rule that tripped, not the exact numbers in the message.
  const bucket = reason.replace(/\d+/g, "N");
  byReason[bucket] = (byReason[bucket] ?? 0) + 1;
  byLang[lang || "?"] = (byLang[lang || "?"] ?? 0) + 1;
  failing.push({ f, lang, reason, excerpt });
}

console.log(`Scanned ${total} posts.\n`);
console.log(`  clean (2 sentences, original, complete): ${clean}`);
console.log(`  NEEDS REGENERATION:                      ${failing.length}\n`);
console.log("  why they fail:");
for (const [r, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(4)}  ${r}`);
}
console.log(`\n  failing by language: ${JSON.stringify(byLang)}`);

if (LIST) {
  console.log("\n--- failing files ---");
  for (const x of failing) console.log(`  [${x.lang}] ${x.reason}\n        ${x.f}`);
}

process.exit(0);
