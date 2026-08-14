// Blog policy: no external links in post bodies (all inbound links must be
// internal — see feedback_ksa_blog_link_rules memory). Strips every
// [text](url) markdown link whose domain is NOT on the internal allowlist,
// replacing it with just the anchor text. Internal links (ksa.ee subdomains,
// YouTube/Vimeo/Rendia embeds) are left untouched.
//
//   node scripts/strip-external-links.mjs --dry-run
//   node scripts/strip-external-links.mjs
import fs from "fs";
import path from "path";

const DRY = process.argv.includes("--dry-run");
const dir = "content/posts";

const KEEP_RE = /(^|\.)ksa\.ee$|(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)vimeo\.com$|(^|\.)rendia\.com$/;

function isInternal(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return KEEP_RE.test(host);
  } catch {
    return false; // malformed URL → treat as external, strip it
  }
}

// Matches [anchor text](http... "optional title"). Anchor text may contain
// escaped brackets (old academic footnote style: [\[i\]](url) renders as
// "[i]") — `\\.` treats any backslash-escaped char as one atomic unit so an
// escaped `\]` doesn't prematurely close the capture. Bounded to a single
// line and a sane max length (real anchor text is never multi-hundred
// chars) — an earlier unbounded version could span across an entire file
// when no closing `]` existed, causing catastrophic backtracking on large
// posts. The trailing `(?:\s+"[^"]*")?` accounts for markdown's optional
// link-title attribute, e.g. `(url "Kite Challenge 2014")`.
const LINK_RE = /\[((?:\\.|[^\]\n]){1,300})\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;

let filesChanged = 0, linksStripped = 0, filesScanned = 0;
const perFile = [];

for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".mdx")) continue;
  filesScanned++;
  const p = path.join(dir, f);
  const raw = fs.readFileSync(p, "utf8");
  let stripped = 0;
  const updated = raw.replace(LINK_RE, (match, text, url) => {
    if (isInternal(url)) return match; // keep internal links as-is
    stripped++;
    return text; // drop the link, keep the visible text
  });
  if (stripped > 0) {
    filesChanged++;
    linksStripped += stripped;
    perFile.push({ f, stripped });
    if (!DRY) fs.writeFileSync(p, updated);
  }
}

perFile.sort((a, b) => b.stripped - a.stripped);
console.log(`Scanned ${filesScanned} posts.`);
console.log(`${DRY ? "Would strip" : "Stripped"} ${linksStripped} external links across ${filesChanged} posts.\n`);
console.log("Top files:");
for (const r of perFile.slice(0, 15)) console.log(`  ${r.stripped}  ${r.f}`);
if (DRY) console.log("\n(dry run — nothing written)");
