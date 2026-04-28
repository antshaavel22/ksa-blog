#!/usr/bin/env node
/**
 * strip-external-links.mjs
 *
 * Removes off-topic external markdown links from content/posts/*.mdx, while
 * keeping a curated allowlist (medical citations, KSA-owned, embeds).
 *
 * Two transforms:
 *   1. Markdown link unwrap:   [text](https://offsite/...)  →  text
 *      (only when the host is NOT in the keep-list).
 *   2. Bare-domain language fix in EN posts:
 *      https://ksa.ee/   → https://ksa.ee/en/
 *      In RU posts: → https://ksa.ee/ru/
 *      Only applies to EXACT bare domain or trailing-slash root, never to
 *      already-prefixed paths like /en/laser-eye-surgery/.
 *
 * Usage:
 *   node scripts/strip-external-links.mjs --dry-run   # report only
 *   node scripts/strip-external-links.mjs             # apply + write files
 */

import fs from "fs";
import path from "path";

const DRY = process.argv.includes("--dry-run");

const KEEP_HOSTS = new Set([
  // KSA-owned / first-party
  "ksa.ee", "www.ksa.ee", "blog.ksa.ee", "silmatervis.ksa.ee",
  "ksa-kiirtest-lp.vercel.app", "ksa-kiirtest.vercel.app",
  "online.saloninfra.ee", "ksasilmakeskus.typeform.com",
  // Embeds (also rendered via components, but we keep raw markdown links too)
  "youtu.be", "www.youtube.com", "youtube.com",
  "vimeo.com", "player.vimeo.com",
  // Medical citations / authoritative
  "pmc.ncbi.nlm.nih.gov", "www.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
  "www.nature.com", "nature.com",
  "www.thelancet.com", "thelancet.com",
  "jamanetwork.com", "www.jamanetwork.com",
  "www.aao.org", "aao.org",
  "www.who.int", "who.int",
  "wspos.org", "www.wspos.org",
  "www.escrs.org", "escrs.org",
  "doi.org", "dx.doi.org",
]);

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ""; }
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, acc);
    else if (e.name.endsWith(".mdx")) acc.push(f);
  }
  return acc;
}

const files = walk("content/posts");
const stripped = [];
const langFixed = [];
let touched = 0;

for (const file of files) {
  let raw = fs.readFileSync(file, "utf-8");
  const orig = raw;

  // Detect post language from frontmatter (top of file, simple regex).
  const langMatch = raw.match(/^lang:\s*["']?(et|ru|en)["']?\s*$/m);
  const lang = langMatch ? langMatch[1] : "et";

  // 1. Unwrap off-topic markdown links: [text](url) → text
  raw = raw.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (m, text, url) => {
    const h = hostOf(url);
    if (!h) return m;
    if (KEEP_HOSTS.has(h)) return m;
    stripped.push({ file: path.relative(process.cwd(), file), url, text });
    return text;
  });

  // 2. Bare ksa.ee in EN/RU posts → /en/ or /ru/.
  // Only catch "https://ksa.ee" or "https://ksa.ee/" — not /en/foo or /ru/foo.
  if (lang === "en" || lang === "ru") {
    const tag = lang;
    raw = raw.replace(/https:\/\/(www\.)?ksa\.ee(\/?)(?=[)"\s])/g, (m, www, slash) => {
      const fixed = `https://ksa.ee/${tag}/`;
      if (m !== fixed) langFixed.push({ file: path.relative(process.cwd(), file), from: m, to: fixed });
      return fixed;
    });
  }

  if (raw !== orig) {
    touched++;
    if (!DRY) fs.writeFileSync(file, raw);
  }
}

console.log(`\nFiles touched: ${touched}${DRY ? " (dry-run, nothing written)" : ""}`);
console.log(`External links unwrapped: ${stripped.length}`);
console.log(`Bare ksa.ee → /en/ or /ru/ rewrites: ${langFixed.length}\n`);

const byHost = new Map();
for (const s of stripped) {
  const h = hostOf(s.url);
  byHost.set(h, (byHost.get(h) ?? 0) + 1);
}
const top = [...byHost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
console.log("Top stripped hosts:");
for (const [h, n] of top) console.log(`  ${String(n).padStart(4)}  ${h}`);

if (DRY && stripped.length) {
  console.log("\nFirst 10 stripped links (sample):");
  for (const s of stripped.slice(0, 10)) {
    console.log(`  - ${s.file}`);
    console.log(`      [${s.text.slice(0, 60)}](${s.url})`);
  }
}
if (DRY && langFixed.length) {
  console.log("\nFirst 10 lang-rewrites (sample):");
  for (const s of langFixed.slice(0, 10)) {
    console.log(`  - ${s.file}: ${s.from} → ${s.to}`);
  }
}
