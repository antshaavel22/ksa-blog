// Generate excerpts to the house rule (Ants, 2026-08-14):
//
//   An excerpt is ORIGINAL copy — exactly TWO sentences that catchily summarise
//   the WHOLE article. It is never sentences lifted or lightly reworded from the
//   post body, and it never ends mid-sentence.
//
// Two earlier design mistakes this replaces: the old prompt told the model to
// "lightly adapt the article's own opening" (the opposite of the rule), and it
// only ever saw the first 1800 characters — so it could not summarise the whole
// piece even in principle. Now the model sees the article's arc (head + tail on
// long posts) and is told to write fresh copy.
//
//   node scripts/audit-excerpts.mjs               # see what fails first
//   node scripts/generate-excerpts.mjs --dry-run  # preview, write nothing
//   node scripts/generate-excerpts.mjs            # write into frontmatter
//   node scripts/generate-excerpts.mjs --limit 10 # try a small batch
//   node scripts/generate-excerpts.mjs --all      # regenerate even passing posts
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Anthropic from "@anthropic-ai/sdk";
import {
  LANG_NAMES as LANG, MIN_CHARS, MAX_CHARS, plainBody, validateExcerpt,
} from "./lib/excerpt-rules.mjs";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const DRY = process.argv.includes("--dry-run");
const ALL = process.argv.includes("--all");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;
const MODEL = process.env.EXCERPT_MODEL || "claude-sonnet-5";

const dir = "content/posts";
const client = new Anthropic();

// The model must see the whole arc to summarise it. Long posts get head + tail
// rather than a truncated opening, so the conclusion is never invisible.
function articleForPrompt(body) {
  if (body.length <= 11000) return body;
  return `${body.slice(0, 7000)}\n\n[…middle of article omitted…]\n\n${body.slice(-4000)}`;
}

function buildPrompt(title, body, lang, problem) {
  const L = LANG[lang];
  return `You write card excerpts for the KSA Silmakeskus (Estonian eye clinic) blog.

Write the excerpt for the article below, in ${L} only.

WHAT AN EXCERPT IS:
Original copy you write yourself — exactly two sentences that capture what the
whole article is about and make the right reader want to open it. It is written
for the reader, not about the article.

LENGTH — this is the rule most often broken, so handle it first:
- ${MIN_CHARS}-${MAX_CHARS} characters IN TOTAL, aiming for about 180.
- That is roughly 28 words across BOTH sentences combined. Keep each sentence short.
- Draft it, count the characters, and if it is over ${MAX_CHARS}, cut detail until it
  fits. Never fix length by adding a third sentence.

HARD RULES:
- EXACTLY TWO sentences. Not one, not three.
- ORIGINAL WORDING. Do NOT copy or reword any sentence from the article, and never
  reuse its opening line. Write it in your own words.
- Cover the whole piece, including where it lands — not only how it opens.
- Speak to the reader. Never describe the article to them: no "This article...",
  "The article explains/closes with...", "Selles artiklis...", "Статья
  рассказывает...". Just tell them the substance directly.
- Both sentences complete, ending in . ! or ?. Never end mid-word. Never use "..." or "…".
- Only facts, names and numbers that appear in the article. Invent nothing.
- Calm, professional, trustworthy. Never salesy. No superlatives (best, magic,
  revolutionary, perfect, parim, imeline, лучший, чудо). No clickbait the article
  does not deliver.
- Never use the word honest / aus / честно.
- Never mention ICB or ИКБ.
- Do not open with the article's title.
- Output ONLY the excerpt text in ${L}. No quotes around it, no label, no notes.
${problem ? `\nYour previous attempt was rejected because ${problem}. Fix exactly that, keep everything else, and try again.\n` : ""}
TITLE: ${title}

ARTICLE:
${articleForPrompt(body)}`;
}

async function genExcerpt(title, body, lang, problem) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{ role: "user", content: buildPrompt(title, body, lang, problem) }],
  });
  // Join every text block — reading only content[0] returns empty whenever the
  // first block isn't text.
  return (res.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim()
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Generation is held to the tighter writing target, not the wider accept-band.
const validate = (ex, lang, body) => validateExcerpt(ex, lang, body, { strict: true });

function writeExcerpt(content, value) {
  value = value.replace(/\s+/g, " ").trim();
  const yaml = value.includes('"') ? `'${value.replace(/'/g, "''")}'` : `"${value}"`;
  // Replace a multi-line block-scalar excerpt (key + indented continuation
  // lines) as one unit, else the old continuation lines are orphaned.
  const blockRe = /^excerpt:\s*[>|][+-]?\s*\n(?:[ \t]+.*(?:\n|$))+/m;
  if (blockRe.test(content)) return content.replace(blockRe, () => `excerpt: ${yaml}\n`);
  const lineRe = /^excerpt:.*$(?:\n[ \t]+\S.*$)*/m;
  if (lineRe.test(content)) return content.replace(lineRe, () => `excerpt: ${yaml}`);
  return content.replace(/^(title:.*)$/m, (m) => `${m}\nexcerpt: ${yaml}`);
}

// ── collect targets ──────────────────────────────────────────────────────────
const targets = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".mdx")) continue;
  let g;
  try { g = matter(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
  const lang = String(g.data.lang || "").trim();
  if (!LANG[lang]) continue;
  const title = String(g.data.title || "").trim();
  const old = String(g.data.excerpt || "").trim();
  const body = plainBody(g.content);
  if (!body) continue;
  const problem = old ? validate(old, lang, body) : "missing";
  if (!ALL && !problem) continue;
  targets.push({ f, lang, title, old, body, why: problem ?? "regenerate-all" });
}
targets.sort((a, b) => a.lang.localeCompare(b.lang) || a.f.localeCompare(b.f));
const work = targets.slice(0, LIMIT);
console.error(`Targets: ${work.length}${targets.length > work.length ? ` of ${targets.length}` : ""} — model ${MODEL} ${DRY ? "(DRY-RUN)" : "(WRITING)"}`);

let ok = 0, failed = 0;
const POOL = 6;
const results = [];

async function run(t) {
  try {
    let ex = await genExcerpt(t.title, t.body, t.lang);
    let problem = validate(ex, t.lang, t.body);
    for (let attempt = 0; attempt < 3 && problem; attempt++) {
      ex = await genExcerpt(t.title, t.body, t.lang, problem);
      problem = validate(ex, t.lang, t.body);
    }
    if (problem) {
      failed++;
      results.push({ ...t, newEx: ex, status: `FAIL (${problem})` });
      return;
    }
    if (!DRY) {
      const p = path.join(dir, t.f);
      fs.writeFileSync(p, writeExcerpt(fs.readFileSync(p, "utf8"), ex));
    }
    ok++;
    results.push({ ...t, newEx: ex, status: "OK" });
  } catch (e) {
    failed++;
    results.push({ ...t, newEx: "", status: `ERR ${e.message}` });
  }
}

for (let i = 0; i < work.length; i += POOL) {
  await Promise.all(work.slice(i, i + POOL).map(run));
  console.error(`  …${Math.min(i + POOL, work.length)}/${work.length}`);
}

results.sort((a, b) => a.lang.localeCompare(b.lang) || a.f.localeCompare(b.f));
for (const r of results) {
  console.log(`\n[${r.lang.toUpperCase()}] ${r.f}`);
  console.log(`  why: ${r.why}  → ${r.status}`);
  console.log(`  OLD: ${r.old || "(none)"}`);
  console.log(`  NEW: ${r.newEx}`);
}
console.error(`\nDone. OK=${ok} FAIL=${failed} ${DRY ? "(dry-run, nothing written)" : "(written)"}`);
