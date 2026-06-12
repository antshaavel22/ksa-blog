// Generate faithful, engaging 1–2 sentence excerpts for weak April-2026+ posts.
// Grounded strictly in each article's body, written in the post's own language,
// KSA low-key voice, ending on a complete sentence. Leaves good excerpts alone.
//   node scripts/generate-excerpts.mjs --dry-run   # preview, write nothing
//   node scripts/generate-excerpts.mjs             # write excerpt into frontmatter
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Anthropic from "@anthropic-ai/sdk";

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}
const DRY = process.argv.includes("--dry-run");
const dir = "content/posts";
const client = new Anthropic();
const LANG = { et: "Estonian", ru: "Russian", en: "English" };

function endsClean(s) {
  const t = s.trim();
  if (!t) return false;
  if (/[\p{L}\d]…$/u.test(t) || /[\p{L}\d]\.\.\.$/u.test(t)) return false;
  if (/\.\.\.$|…$/.test(t)) return false;
  return /[.!?]["»“”'\)]?$/u.test(t);
}
function isWeak(ex, title) {
  ex = ex.trim();
  if (!ex) return "MISSING";
  if (ex.length < 80) return "too-short";
  if (!endsClean(ex)) return "abrupt/ellipsis";
  if (ex.toLowerCase() === title.toLowerCase() || ex.toLowerCase().startsWith(title.toLowerCase().slice(0, 40))) return "dupes-title";
  return null;
}
function plainBody(md) {
  return md
    .replace(/<[^>]+\/>/g, " ")               // self-closing MDX
    .replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, " ") // paired tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")     // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")   // links → text
    .replace(/[#>*_`]/g, "")                    // md syntax
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1800);
}
function scriptOk(text, lang) {
  const cyr = (text.match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (text.match(/[A-Za-zõäöüÕÄÖÜ]/g) || []).length;
  if (lang === "ru") return cyr > lat;
  return lat > cyr; // et / en
}

async function genExcerpt(title, body, lang, strict = false) {
  const L = LANG[lang] || "Estonian";
  const prompt = `You are writing the card excerpt (lead-in summary) for a KSA Silmakeskus (Estonian eye clinic) blog article.
Language: ${L}. Write the excerpt in ${L} only.

STRICT RULES:
- Use ONLY facts, names, numbers and tone found in the article below. Invent nothing.
- Prefer lightly adapting the article's own opening so it keeps the writer's spark.
- Calm, professional, trustworthy — never salesy. No superlatives (best/magic/revolutionary/perfect/лучший/чудо/parim/imeline).
- 1–2 complete sentences, about 90–220 characters.
- MUST end on a full sentence (. ! ?). Never end mid-word, and never with "...".
- Output ONLY the excerpt text in ${L}. No quotes around it, no label, no explanation.${strict ? "\n- Your previous attempt was invalid. Return a clean 1–2 sentence excerpt that ends with proper punctuation, in " + L + "." : ""}

TITLE: ${title}

ARTICLE:
${body}`;
  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });
  // Collapse any internal newlines so the excerpt is always a single YAML line.
  return (res.content[0]?.text || "").trim().replace(/^["'«»]+|["'«»]+$/g, "").replace(/\s+/g, " ").trim();
}

function writeExcerpt(content, value) {
  value = value.replace(/\s+/g, " ").trim();
  const yaml = value.includes('"') ? `'${value.replace(/'/g, "''")}'` : `"${value}"`;
  // Replace a multi-line block-scalar excerpt (key + indented continuation lines)
  // as one unit, else the old continuation lines are orphaned → broken YAML.
  const blockRe = /^excerpt:\s*[>|][+-]?\s*\n(?:[ \t]+.*(?:\n|$))+/m;
  if (blockRe.test(content)) return content.replace(blockRe, () => `excerpt: ${yaml}\n`);
  // Plain single-line excerpt, possibly followed by stray indented orphan lines.
  const lineRe = /^excerpt:.*$(?:\n[ \t]+\S.*$)*/m;
  if (lineRe.test(content)) return content.replace(lineRe, () => `excerpt: ${yaml}`);
  return content.replace(/^(title:.*)$/m, (m) => `${m}\nexcerpt: ${yaml}`);
}

// Collect weak posts
const targets = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".mdx")) continue;
  let g; try { g = matter(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
  const d = String(g.data.date || ""); if (d < "2026-04-01") continue;
  const lang = String(g.data.lang || "").trim(); if (!LANG[lang]) continue;
  const title = String(g.data.title || "").trim();
  const ex = String(g.data.excerpt || "").trim();
  const verdict = isWeak(ex, title);
  if (verdict) targets.push({ f, lang, title, old: ex, verdict, body: plainBody(g.content) });
}
targets.sort((a, b) => a.lang.localeCompare(b.lang));
console.error(`Weak posts to process: ${targets.length} (${DRY ? "DRY-RUN" : "WRITING"})`);

let ok = 0, failed = 0;
const POOL = 5;
const results = [];
async function worker(t) {
  try {
    let ex = await genExcerpt(t.title, t.body, t.lang);
    if (!(ex.length >= 70 && ex.length <= 320 && endsClean(ex) && scriptOk(ex, t.lang))) {
      ex = await genExcerpt(t.title, t.body, t.lang, true);
    }
    if (!(ex.length >= 60 && ex.length <= 340 && endsClean(ex) && scriptOk(ex, t.lang))) {
      failed++; results.push({ ...t, newEx: "(invalid: " + ex.slice(0, 60) + ")", status: "FAIL" }); return;
    }
    if (!DRY) {
      const p = path.join(dir, t.f);
      fs.writeFileSync(p, writeExcerpt(fs.readFileSync(p, "utf8"), ex));
    }
    ok++; results.push({ ...t, newEx: ex, status: "OK" });
  } catch (e) {
    failed++; results.push({ ...t, newEx: "(error: " + e.message + ")", status: "ERR" });
  }
}
for (let i = 0; i < targets.length; i += POOL) {
  await Promise.all(targets.slice(i, i + POOL).map(worker));
  console.error(`  …${Math.min(i + POOL, targets.length)}/${targets.length}`);
}

// Report
results.sort((a, b) => a.lang.localeCompare(b.lang) || a.f.localeCompare(b.f));
for (const r of results) {
  console.log(`\n[${r.lang.toUpperCase()}] ${r.f}  (${r.verdict}) ${r.status}`);
  console.log(`  OLD: ${r.old || "(none)"}`);
  console.log(`  NEW: ${r.newEx}`);
}
console.error(`\nDone. OK=${ok} FAIL=${failed} ${DRY ? "(dry-run, nothing written)" : "(written)"}`);
