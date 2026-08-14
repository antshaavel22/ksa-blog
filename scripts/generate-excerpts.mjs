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
} from "../lib/excerpt-rules.mjs";

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

// Worked examples carry more of the standard than any list of rules. Each shows
// the same shape: sentence 1 states the substance, sentence 2 delivers the turn
// — the consequence, the caveat, or the number that makes it matter.
const EXAMPLES = {
  en: `GOOD — "Most drifting specks are a harmless change in the eye's vitreous gel, and the brain learns to ignore them. A sudden shower of them alongside flashes of light is different, and can mean a retinal tear that needs same-day attention."
   Why: opens with the substance, turns on the thing that actually matters, gives the reader the decision rule. No instruction to read, no clinic name.

BAD — "Discover everything you need to know about eye floaters. Learn how KSA Silmakeskus can help you today."
   Why: tells the reader to read instead of telling them anything, and ends on a plug.`,
  et: `GOOD — "Laserkorrektsiooni sobivuse otsustab sarvkesta kuju ja paksus, mitte dioptrite arv. Just seepärast ei anna ükski veebitest vastust, mille saab põhjalikust sobivusuuringust."
   Miks: esimene lause ütleb sisu, teine annab järelduse. Ei käsi lugeda, ei reklaami.

HALB — "Loe, kuidas laserkorrektsioon toimib. Avasta, kuidas KSA Silmakeskus sind aidata saab."
   Miks: käsib lugeda, aga ei ütle midagi; lõpeb reklaamiga.`,
  ru: `GOOD — "Слезящиеся глаза чаще говорят не об избытке влаги, а о нехватке жирового слоя слёзной плёнки. Именно поэтому обычные увлажняющие капли приносят лишь короткое облегчение."
   Почему: первое предложение — суть, второе — вывод. Не приказывает читать, не рекламирует.

BAD — "Узнайте всё о синдроме сухого глаза. Разбираемся, как KSA Silmakeskus может вам помочь."
   Почему: вместо содержания — призыв читать, в конце реклама.`,
};

function buildPrompt(title, body, lang, problem) {
  const L = LANG[lang];
  return `You are a senior copy editor writing the standfirst for an article on the
KSA Silmakeskus (Estonian eye clinic) blog. Hold yourself to the standard of a
BBC News standfirst: informative, specific, and calm. It should read as though a
knowledgeable editor summarised the piece, not as though marketing wrote a teaser.

Write it in ${L} only.

THE SHAPE THAT WORKS — follow it:
- Sentence 1: state the substance of the article. The finding, the situation, the
  fact that makes it worth reading.
- Sentence 2: deliver the turn — the consequence, the caveat, the exception, or the
  number that makes sentence 1 matter.
Together they must cover the WHOLE article, including where it lands.

${EXAMPLES[lang] ?? EXAMPLES.en}

LENGTH:
- ${MIN_CHARS}-${MAX_CHARS} characters IN TOTAL, aiming for about 200 — roughly 32 words
  across both sentences. Draft it, count, and cut detail if it runs over. Never fix
  length by adding a third sentence.

ABSOLUTE RULES:
- EXACTLY TWO sentences. Not one, not three.
- ORIGINAL WORDING. Never copy or lightly reword a sentence from the article, and
  never reuse its opening line. This is the single most common failure — if your
  draft echoes the article's first paragraph, throw it away and start again.
- NEVER instruct the reader to read. Banned openers and any equivalent:
  "Discover…", "Learn…", "Find out…", "Read on…", "Here's what…",
  "Loe, …", "Avasta…", "Vaata, …", "Siit leiad…",
  "Узнайте…", "Разбираемся…", "Расскажем…", "Здесь …".
  State the information itself instead.
- NO promotional ending. Do not name KSA, Silmakeskus, Flow3, Rexon-Eye or any
  service unless that name is genuinely the subject of the article (a patient story
  about the procedure, or a piece specifically about that treatment). Never append a
  clinic mention as the second sentence's payoff.
- Never describe the article: no "This article…", "Selles artiklis…", "Статья…".
- Both sentences complete, ending in . ! or ?. Never end mid-word. Never use "..." or "…".
- Only facts, names and numbers that actually appear in the article. Invent nothing.
- No superlatives (best, magic, revolutionary, perfect, parim, imeline, лучший, чудо).
- Never use the word honest / aus / честно. Do not mention ICB unless the article itself is about ICB lens implantation.
- Do not open with the article's title.
- Output ONLY the excerpt text in ${L}. No quotes around it, no label, no notes.
${problem ? `\nYour previous attempt was rejected because ${problem}. Fix exactly that, keep everything else, and try again.\n` : ""}
TITLE: ${title}

ARTICLE:
${articleForPrompt(body)}`;
}

// Rewriting from scratch on every retry just produces a fresh draft with a fresh
// set of problems — especially for length, where the model reliably overshoots.
// Handing back its own draft to fix is far more reliable than asking again.
function buildRevisePrompt(draft, lang, problem) {
  const L = LANG[lang];
  return `Revise this standfirst. It was rejected because ${problem}.

DRAFT:
${draft}

Fix exactly that problem and change nothing else that already works. Keep it in ${L}.

Requirements it must still meet:
- EXACTLY TWO sentences, both complete, ending in . ! or ?
- ${MIN_CHARS}-${MAX_CHARS} characters in total (count them — if it is too long, cut
  detail and tighten wording; never drop to one sentence or add a third)
- Keeps the concrete specifics (numbers, findings, caveats) — do not make it vaguer
- Does not tell the reader to read (no Discover / Learn / Loe / Avasta / Узнайте …)
- Does not end on a clinic or product name as its payoff
- Original wording, not copied from the article

Output ONLY the revised excerpt in ${L}. No quotes, no label, no explanation.`;
}

async function genExcerpt(title, body, lang, problem, draft) {
  const content = draft
    ? buildRevisePrompt(draft, lang, problem)
    : buildPrompt(title, body, lang, problem);
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{ role: "user", content }],
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

// Naming the ceiling doesn't work — drafts land just over it again and again.
// Naming a target well below the ceiling does: the usual overshoot then still
// lands inside the allowed band.
const TIGHT_TARGET = 195;
function lengthHint(draft, problem) {
  if (!draft || !/too long|under the/.test(problem)) return problem;
  const n = draft.trim().length;
  if (n > MAX_CHARS) {
    return `it is ${n} characters, which is too long. Rewrite it in AT MOST ${TIGHT_TARGET} characters `
      + `— aim for ${TIGHT_TARGET}, not ${MAX_CHARS}. Keep both sentences and the key specifics, `
      + `and cut qualifiers, examples and sub-clauses to get there`;
  }
  return `it is only ${n} characters. Expand it to about ${TIGHT_TARGET} characters by adding a concrete `
    + `detail from the article (a number, a finding, a caveat) — not filler`;
}

// How far off a draft is, for picking the better of two rejected candidates.
// Length misses are recoverable by tightening; the rest are structural.
function score(text, problem) {
  if (!problem) return 0;
  const n = (text ?? "").trim().length;
  if (/too long/.test(problem)) return 1 + (n - MAX_CHARS) / 1000;
  if (/under the/.test(problem)) return 1 + (MIN_CHARS - n) / 1000;
  return 2;
}

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

    for (let attempt = 0; attempt < 5 && problem; attempt++) {
      // "lifted from the article" can't be repaired by editing the draft — that
      // one needs a fresh start. Everything else is a revision of what we have.
      const revisable = ex && !/copied a sentence/.test(problem);
      const next = await genExcerpt(
        t.title, t.body, t.lang,
        lengthHint(ex, problem),
        revisable ? ex : null,
      );
      if (!next) continue;                     // empty reply: keep the draft we had
      const nextProblem = validate(next, t.lang, t.body);
      if (!nextProblem) { ex = next; problem = null; break; }
      // Otherwise carry the new draft forward only if it isn't worse than what we
      // hold — an over-long draft that keeps its specifics is a better base to
      // tighten than a vague short one.
      if (score(next, nextProblem) <= score(ex, problem)) { ex = next; problem = nextProblem; }
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
