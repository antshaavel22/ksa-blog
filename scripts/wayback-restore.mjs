// Restore ET patient stories from the Wayback Machine snapshot of the original
// WordPress page.
//
// Why the archive and not git: the WP->MDX import (commit 3666d9f0) was itself
// lossy. In WordPress each section label was its own bold paragraph —
// <p><strong>Rõõm reisimisest on palju suurem</strong></p> — and the import
// concatenated it onto the paragraph that followed, producing run-on text
// ("Rõõm reisimisest on palju suurem Reisihimulise naisterahvana..."). The April
// AI facelift then "fixed" that by inventing its own "## " headings in its own
// voice. Neither matches what was published.
//
// The archived HTML has the real structure, so it is the only faithful source.
//
//   node scripts/wayback-restore.mjs --dry-run
//   node scripts/wayback-restore.mjs
import fs from "fs";
import matter from "gray-matter";

const DRY = process.argv.includes("--dry-run");

// Page furniture that follows the article in the WP template.
const STOP = /^(KAS SOBID LASEROPERATSIOONIKS|Teemad|Klientide kogemused|TOO ELLU SELGUST|Seotud postitused|Loe ka|©\s*20|Kiirviited|Hea teada|KSA Tallinn|KSA Tartu|\+372|Ava Google|Broneeri|Telli uudiskiri|Jälgi meid)/i;

// Template boilerplate that sits under the <h1> on the newer Elementor layout —
// the same sentence appears on every post, so it is chrome, not article text.
const BOILERPLATE = [
  /^Iga silmapaar on unikaalne/i,
  /^Prillivaba elu esimeseks sammuks/i,
];

const KEEP_LINK = /(^|\.)ksa\.ee$|(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)vimeo\.com$/;

function decode(s) {
  return s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&ldquo;/g, "“").replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–").replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#0?39;|&apos;/g, "'").replace(/&hellip;/g, "…");
}

// Un-rewrite Wayback's URL prefix, then apply the blog's internal-links-only rule.
function cleanHref(href) {
  let u = href.replace(/^https?:\/\/web\.archive\.org\/web\/\d+\w*\//, "");
  return u;
}
function isInternal(u) {
  try { return KEEP_LINK.test(new URL(u).hostname.toLowerCase()); } catch { return false; }
}

function inlineToMd(html) {
  let s = html;
  s = s.replace(/<br\s*\/?>/gi, " ");
  s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, txt) => {
    const t = inlineToMd(txt).trim();
    const u = cleanHref(href);
    return isInternal(u) ? `[${t}](${u})` : t;   // external links dropped, text kept
  });
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (m, _t, t) => `**${inlineToMd(t).trim()}**`);
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (m, _t, t) => `*${inlineToMd(t).trim()}*`);
  s = s.replace(/<[^>]+>/g, "");
  return decode(s).replace(/[ \t]+/g, " ");
}

export function extractArticle(html) {
  // Two templates are in play across the archive years. The older one wraps the
  // article in .post-content; the newer Elementor layout has no such wrapper, so
  // fall back to walking forward from the <h1> until the footer starts.
  let block;
  const idx = html.indexOf('class="post-content"');
  if (idx >= 0) {
    const start = html.lastIndexOf("<div", idx);
    const re = /<\/?div\b[^>]*>/gi; re.lastIndex = start;
    let depth = 0, end = html.length, m;
    while ((m = re.exec(html))) {
      if (m[0].startsWith("</")) { depth--; if (depth === 0) { end = m.index + m[0].length; break; } }
      else depth++;
    }
    block = html.slice(start, end);
  } else {
    const h1 = html.search(/<h1\b/i);
    if (h1 < 0) return null;
    block = html.slice(h1);
  }

  const out = [];
  let seenH1 = false;
  const nodeRe = /<(h1|h2|h3|h4|p|ul|ol|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let n;
  while ((n = nodeRe.exec(block))) {
    const tag = n[1].toLowerCase();
    const raw = n[2];
    const plain = decode(raw.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (!plain) continue;
    if (tag === "h1") { seenH1 = true; continue; }        // title lives in frontmatter
    if (STOP.test(plain)) break;                           // furniture begins
    if (!seenH1) continue;                                 // skip anything above the title
    if (BOILERPLATE.some((b) => b.test(plain))) continue;  // per-template chrome

    if (tag === "ul" || tag === "ol") {
      const items = [...raw.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((li) => inlineToMd(li[1]).trim()).filter(Boolean);
      if (items.length) out.push(items.map((i) => `- ${i}`).join("\n"));
      continue;
    }
    if (tag === "blockquote") { out.push(`> ${inlineToMd(raw).trim()}`); continue; }
    if (tag.startsWith("h")) { out.push(`## ${inlineToMd(raw).trim()}`); continue; }

    // Paragraph. A paragraph that is ENTIRELY bold is a section label in this
    // template — keep it as its own bold line, which is how it was published.
    const md = inlineToMd(raw).trim();
    if (md) out.push(md);
  }
  // Photographer credit ("Foto: Silver Kaljula") sits in the hero block ABOVE
  // the <h1>, so the forward walk never reaches it. It is attribution and must
  // survive — pull it from anywhere on the page and restore it as the first line,
  // which is where the original import had it.
  const credit = [...html.matchAll(/<p[^>]*>\s*(Foto[:\s][^<]{2,80}?)\s*<\/p>/gi)]
    .map((c) => decode(c[1]).replace(/\s+/g, " ").trim())
    .find(Boolean);
  if (credit && !out.some((b) => b.startsWith("Foto"))) out.unshift(credit);

  return out.length ? out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() : null;
}

// ── run ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith("wayback-restore.mjs")) {
  const rows = fs.readFileSync("/tmp/snapshots.tsv", "utf8").trim().split("\n")
    .map((l) => l.split("\t")).filter((r) => r[2] && r[2] !== "NONE");
  let ok = 0, failed = 0, unchanged = 0;
  for (const [file, slug, ts] of rows) {
    const url = `https://web.archive.org/web/${ts}id_/https://ksa.ee/${slug}/`;
    let html;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      html = await res.text();
    } catch (e) { failed++; console.log(`FETCH FAIL  ${file}  ${e.message}`); continue; }

    const body = extractArticle(html);
    if (!body || body.split(/\s+/).length < 60) {
      failed++; console.log(`EXTRACT FAIL ${file} (${body ? body.split(/\s+/).length + "w" : "none"})`); continue;
    }
    const p = `content/posts/${file}`;
    const cur = fs.readFileSync(p, "utf8");
    const parsed = matter(cur);
    const fm = cur.slice(0, cur.length - parsed.content.length);
    if (parsed.content.trim() === body) { unchanged++; console.log(`SAME        ${file}`); continue; }
    if (!DRY) fs.writeFileSync(p, fm + body + "\n");
    ok++;
    const w = (s) => (s.match(/\p{L}[\p{L}\p{M}\d]*/gu) || []).length;
    console.log(`RESTORED    ${file.slice(0, 46)}  wayback=${w(body)}w  was=${w(parsed.content)}w  (${ts.slice(0,8)})`);
  }
  console.log(`\n${DRY ? "Would restore" : "Restored"} ${ok}, unchanged ${unchanged}, failed ${failed}.`);
  if (DRY) console.log("(dry run — nothing written)");
}
