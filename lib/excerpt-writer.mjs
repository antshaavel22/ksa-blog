// How an excerpt is WRITTEN — the counterpart to lib/excerpt-rules.mjs, which
// decides whether one is valid.
//
// This exists because the logic was duplicated: the CLI batch script and the
// admin's ✨ Genereeri button each carried their own prompt and retry loop. The
// CLI was upgraded (worked examples, imperative ban, revise-don't-restart
// retries, native-editor polish) and the API route silently kept the old copy,
// so the editor button started failing — "312 characters, the limit is 280" —
// on articles the CLI handled fine. Both now import from here.
//
// Everything is injected (client, models) so this stays runtime-agnostic and
// works identically in a Node script and a Next.js route handler.
import {
  LANG_NAMES as LANG, MIN_CHARS, MAX_CHARS, validateExcerpt,
} from "./excerpt-rules.mjs";

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
  et: `HEA — "Kuiv kollatähni kahjustus areneb aastatega, märg vorm võib nägemise rikkuda mõne päevaga. Kõverad jooned uksepiidal või tekstiread lainetamas on esimene märk, mis nõuab kiiret silmaarsti vastuvõttu."
   Miks: esimene lause ütleb sisu, teine annab järelduse ja konkreetse märgi. Ei käsi lugeda, ei reklaami.

HEA — "Silmade vesisus ei tule liigsest niiskusest, vaid pisarakile kehvast koostisest. Ummistunud meibomi näärmed jätavad pisarad kaitsva õlikihita, mistõttu need aurustuvad kiiresti ja silm hakkab refleksiivselt vett jooksma."
   Miks: parandab levinud väärarusaama ja selgitab põhjuse. Terve, loomulik eesti keel.

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
// `max` is stated rather than assumed: when tightening an over-long draft the
// caller passes a ceiling well below MAX_CHARS. Quoting the real limit here at
// the same time as the hint asked for a shorter one gave the model two
// different targets, and it settled just above the real one — the "288
// characters, the limit is 280" failure Ants hit from the editor.
function buildRevisePrompt(draft, lang, problem, max = MAX_CHARS) {
  const L = LANG[lang];
  return `Revise this standfirst. It was rejected because ${problem}.

DRAFT:
${draft}

Fix exactly that problem and change nothing else that already works. Keep it in ${L}.

Requirements it must still meet:
- EXACTLY TWO sentences, both complete, ending in . ! or ?
- Between ${MIN_CHARS} and ${max} characters in total. Count them. ${max < MAX_CHARS
    ? `Aim for about ${max} — being under is fine, going over is not.`
    : "Never drop to one sentence or add a third to fix the length."}
- Keeps the concrete specifics (numbers, findings, caveats) — do not make it vaguer
- Does not tell the reader to read (no Discover / Learn / Loe / Avasta / Узнайте …)
- Does not end on a clinic or product name as its payoff
- Original wording, not copied from the article

Output ONLY the revised excerpt in ${L}. No quotes, no label, no explanation.`;
}


// Estonian is where the model's grammar slips: case endings, government of
// verbs, and invented compounds ("hädapisar") pass every structural rule while
// reading wrong to a native speaker. Validation cannot see this, so a native
// editor pass runs over the finished text. Meaning is held fixed — this only
// repairs language.
export const DEFAULT_POLISH_LANGS = (process.env.EXCERPT_POLISH_LANGS ?? "et,ru")
  .split(",").map((s) => s.trim()).filter(Boolean);
export const DEFAULT_POLISH_MODEL = process.env.EXCERPT_POLISH_MODEL || "claude-opus-5";
export const DEFAULT_MODEL = process.env.EXCERPT_MODEL || "claude-sonnet-5";

const POLISH_GUIDE = {
  et: `Oled eesti keele toimetaja. Paranda allolev tekst korrektseks, loomulikuks eesti keeleks.

Jälgi eriti:
- käändeid ja rektsiooni ("vihjeid tähelepanu kohta", mitte "vihjeid tähelepanust")
- sõnajärge — vältimatult selget, mitte inglise keelest kopeeritud
- väljamõeldud liitsõnu (nt "hädapisar") — kasuta tavakeelset sõna
- kohmakaid konstruktsioone ("mitte ei peata" → "ei peata seda")
- meditsiiniterminid jäävad alles, aga peavad olema õiges käändes`,
  ru: `Ты — редактор русского языка. Исправь текст, чтобы он звучал естественно и грамотно.

Обрати внимание на:
- падежи и управление глаголов
- порядок слов — русский, не калька с английского
- канцелярит и неестественные обороты
- медицинские термины сохраняются, но в правильной форме`,
};

async function polish(text, lang, { client, polishModel, polishLangs }) {
  if (!polishLangs.includes(lang) || !POLISH_GUIDE[lang]) return text;
  const res = await client.messages.create({
    model: polishModel,
    // Generous ceiling: a tight one occasionally returned an empty block for
    // longer Estonian text, which silently fell back to the unpolished draft.
    max_tokens: 1200,
    messages: [{
      role: "user",
      content: `${POLISH_GUIDE[lang]}

ÄRA MUUDA sisu, fakte, numbreid ega mõtet. ÄRA muuda lausete arvu (jääb täpselt kaks).
Kui tekst on juba korrektne, tagasta see muutmata kujul.
Väljasta AINULT parandatud tekst, ilma jutumärkide, selgituste või kommentaarideta.

TEKST:
${text}`,
    }],
  });
  const out = (res.content ?? [])
    .filter((b) => b.type === "text").map((b) => b.text).join(" ")
    .trim().replace(/^["'«»]+|["'«»]+$/g, "").replace(/\s+/g, " ").trim();
  return out || text;
}


// Ask the model once. `draft` switches it into revise-this mode.
async function ask({ client, model, title, body, lang, problem, draft, max }) {
  const content = draft
    ? buildRevisePrompt(draft, lang, problem, max)
    : buildPrompt(title, body, lang, problem);
  const res = await client.messages.create({
    model,
    // Was 400, which the model could spend entirely on reasoning before emitting
    // any text — the call then returned an empty block. Because an empty reply is
    // skipped ("keep the draft we had"), every retry silently did nothing and the
    // first over-long draft survived all five attempts. That is what produced the
    // "288 characters — the limit is 280" the editor kept showing: it was never
    // actually revising. A standfirst is ~60 tokens; the ceiling only has to be
    // clear of the reasoning budget.
    max_tokens: 2000,
    messages: [{ role: "user", content }],
  });
  return (res.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim()
    .replace(/^["'\u00ab\u00bb]+|["'\u00ab\u00bb]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Naming the ceiling doesn't work — drafts land just over it again and again.
// Naming a target well below the ceiling does: the usual overshoot then still
// lands inside the allowed band.
const TIGHT_TARGET = 195;
// Returns the ceiling to state in the revise prompt: tightened while the draft
// runs long, the normal limit otherwise.
function targetMax(draft, problem) {
  if (!draft || !problem || !/too long/.test(problem)) return MAX_CHARS;
  return TIGHT_TARGET;
}
function lengthHint(draft, problem) {
  if (!draft || !/too long|under the/.test(problem)) return problem;
  const n = draft.trim().length;
  if (n > MAX_CHARS) {
    return `it is ${n} characters, which is too long. Rewrite it in AT MOST ${TIGHT_TARGET} characters `
      + `\u2014 aim for ${TIGHT_TARGET}, not ${MAX_CHARS}. Keep both sentences and the key specifics, `
      + `and cut qualifiers, examples and sub-clauses to get there`;
  }
  return `it is only ${n} characters. Expand it to about ${TIGHT_TARGET} characters by adding a concrete `
    + `detail from the article (a number, a finding, a caveat) \u2014 not filler`;
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

/**
 * Write one excerpt. Returns { excerpt, problem } — problem is null on success,
 * otherwise the reason the best candidate still failed, so callers can surface
 * it. Never throws for content reasons.
 */
export async function writeExcerpt({
  client,
  title = "",
  body,
  lang,
  model = DEFAULT_MODEL,
  polishModel = DEFAULT_POLISH_MODEL,
  polishLangs = DEFAULT_POLISH_LANGS,
  attempts = 5,
}) {
  const validate = (t) => validateExcerpt(t, lang, body, { strict: true, title });

  let ex = await ask({ client, model, title, body, lang });
  let problem = validate(ex);

  for (let i = 0; i < attempts && problem; i++) {
    // "lifted from the article" can't be repaired by editing the draft \u2014 that
    // one needs a fresh start. Everything else is a revision of what we have.
    const revisable = ex && !/copied a sentence/.test(problem);
    const next = await ask({
      client, model, title, body, lang,
      problem: lengthHint(ex, problem),
      draft: revisable ? ex : null,
      max: targetMax(ex, problem),
    });
    if (!next) continue;                    // empty reply: keep the draft we had
    const nextProblem = validate(next);
    if (!nextProblem) { ex = next; problem = null; break; }
    if (score(next, nextProblem) <= score(ex, problem)) { ex = next; problem = nextProblem; }
  }

  // Native-editor pass on the accepted text. Kept only if it still validates, so
  // a polish that breaks the two-sentence shape can never make things worse.
  if (!problem) {
    const polished = await polish(ex, lang, { client, polishModel, polishLangs });
    if (polished !== ex && !validate(polished)) ex = polished;
  }

  return { excerpt: ex, problem };
}
