// Single source of truth for what makes a valid excerpt.
//
// House rule (Ants, 2026-08-14): an excerpt is ORIGINAL copy — exactly two
// sentences that catchily summarise the WHOLE article, written for the reader.
// Never sentences lifted from the body, never cut mid-sentence.
//
// Everything that checks excerpts imports from here — the audit, the generator,
// and the prebuild gate — so the thresholds can never drift apart again.

// Two sentences carrying real information — a finding plus its consequence —
// land around 180-250 characters. Below ~130 they stop saying anything; a tighter
// ceiling was tried first and simply squeezed out the specifics (numbers, caveats)
// that make a standfirst worth reading.
export const MIN_CHARS = 130;
export const MAX_CHARS = 280;
// Accept-band used when judging text we did not just generate, so we don't
// churn excerpts that are only a few characters outside the writing target.
export const HARD_MIN = 110;
export const HARD_MAX = 310;

export const LANG_NAMES = { et: "Estonian", ru: "Russian", en: "English" };

// "honest" reads as a manipulation tell in Estonian culture — banned outright in
// KSA customer copy.
export const BANNED_RE = /\b(honest|honestly|aus|ausalt|честно|честный)\b/iu;

// ICB is not name-dropped in card copy, but some articles are genuinely about
// ICB lens implantation — there the term is the subject, not a plug. So it is
// only rejected when the article itself doesn't discuss it.
export const ICB_RE = /\bICB\b|ИКБ/iu;

// Meta phrasing — describing the article instead of speaking to the reader.
export const META_RE = /\b(this|the)\s+(article|post|piece)\b|selles\s+artiklis|artikkel\s+(räägib|selgitab|annab)|(в\s+)?(этой\s+)?статье|статья\s+(рассказывает|объясняет)/iu;

// "Read on and discover…" — instructing the reader instead of informing them.
// A standfirst carries information; it never tells you to go and get it.
//
// Estonian needed the widest net: its imperative is a bare stem (õpi, tea,
// märka, tutvu), so "Õpi tundma varajasi märke" is the same instruction as
// "Learn the early signs" but matched none of the original English-shaped
// patterns and shipped clean.
export const FORMULA_RE = new RegExp(
  "(^|[.!?]\\s+)(" + [
    // English
    "discover", "learn", "find out", "read on", "here'?s what", "explore",
    "see how", "uncover", "take a look",
    // Estonian — imperative verb stems used as reader instructions
    "loe\\b", "loe,", "vaata\\b", "uuri\\b", "avasta", "tutvu", "õpi\\b",
    "tea,", "tea\\b", "märka\\b", "saa teada", "pane tähele", "kuula\\b",
    "siit\\s+leiad", "vaata,",
    // Russian
    "узнайте", "узнай\\b", "разбираемся", "расскажем", "читайте", "смотрите",
    "откройте", "познакомьтесь", "запомните", "обратите внимание",
  ].join("|") + ")",
  "iu",
);

// A clinic/product name used as the payoff of the closing sentence reads as an
// ad — but only when it's bolted on. For a patient story about Flow3, or a piece
// announcing a new clinic, that name IS the subject and belongs there. The
// article's own title is the test: if the name appears in the title, the article
// is about it and the ending is legitimate.
const PROMO_NAMES = /\b(KSA|Silmakeskus|Flow\s*3|Rexon[- ]?Eye|Eye Audit)\b/i;
export function endsOnPromo(s, title = "") {
  const parts = s.trim().split(/(?<=[.!?])\s+/u);
  const last = parts[parts.length - 1] ?? "";
  const m = last.match(PROMO_NAMES);
  if (!m) return false;
  // Same name in the title → it's the subject, not a plug.
  return !PROMO_NAMES.test(String(title));
}

// Strip quotes and apostrophes entirely rather than mapping them to a common
// character: a curly apostrophe in the excerpt against a straight one in the
// body ("can’t" vs "can't") was enough to hide a verbatim copy of the article's
// opening paragraph from the lifted-text check. Dashes vary the same way.
export const norm = (s) =>
  s.toLowerCase()
    .replace(/[«»""''"'`´]/g, "")
    .replace(/[–—−-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Abbreviations whose full stop does NOT end a sentence. Without this, "Dr. Joel"
// counts as a sentence break and a valid 2-sentence excerpt is rejected as 3.
const ABBREV = [
  "dr", "mr", "mrs", "ms", "prof", "st", "vs", "etc", "no", "nr", "inc", "ltd",
  "jr", "sr", "phd", "md", "e.g", "i.e",
  "nt", "jne", "vt", "ehk", "ca", "u",              // Estonian
  "т.д", "т.п", "др", "им", "гг", "проф", "акад",   // Russian
];

function maskNonBreaking(s) {
  let out = s;
  for (const a of ABBREV) {
    // Escape regex metachars in the abbreviation (e.g. the dots in "e.g").
    const esc = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(^|[\\s(«"'])${esc}\\.`, "giu"), (m) => m.replace(/\.$/, ""));
  }
  // Single-letter initials: "J. Fuhrman", "А. Иванов".
  return out.replace(/(^|[\s(«"'])(\p{Lu})\./gu, `$1$2`);
}

export function sentenceCount(s) {
  return maskNonBreaking(s.trim())
    .split(/(?<=[.!?])[\s ]+(?=[«"'(\p{Lu}])/u)
    .map((x) => x.trim())
    .filter(Boolean).length;
}

export function endsClean(s) {
  const t = s.trim();
  if (!t) return false;
  // A trailing ellipsis after a word means the text was cut, not finished.
  if (/\p{L}\.\.\.$|\p{L}…$/u.test(t)) return false;
  return /[.!?]["'»""')\]]?$/u.test(t);
}

// Did this excerpt copy a sentence out of the body instead of being written?
export function isLifted(excerpt, body) {
  const nb = norm(body);
  const ne = norm(excerpt);
  // The commonest failure by far: the excerpt simply IS the article's opening.
  // Catch it directly on the leading characters, independent of sentence
  // splitting — a sentence-level check can be defeated by a single stray comma.
  if (ne.length >= 50 && nb.startsWith(ne.slice(0, 50))) return true;
  return excerpt
    .split(/(?<=[.!?])\s+/u)
    .map((s) => norm(s).replace(/[.!?]+$/, ""))
    .filter((s) => s.length >= 40)
    .some((s) => nb.includes(s));
}

export function scriptOk(text, lang) {
  const cyr = (text.match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (text.match(/[A-Za-zõäöüÕÄÖÜ]/g) || []).length;
  return lang === "ru" ? cyr > lat : lat > cyr;
}

export function plainBody(md) {
  return md
    .replace(/<[^>]+\/>/g, " ")
    .replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Judge an excerpt. Returns null when valid, else a human-readable reason —
 * the same string is fed back to the model as retry guidance.
 * `strict` uses the writing target; otherwise the wider accept-band is used so
 * existing near-miss excerpts aren't needlessly regenerated.
 */
export function validateExcerpt(ex, lang, body, { strict = false, title = "" } = {}) {
  const min = strict ? MIN_CHARS : HARD_MIN;
  const max = strict ? MAX_CHARS : HARD_MAX;
  if (!ex || !ex.trim()) return "it was empty";
  const t = ex.trim();
  if (lang && LANG_NAMES[lang] && !scriptOk(t, lang)) return `it was not written in ${LANG_NAMES[lang]}`;
  const sc = sentenceCount(t);
  if (sc !== 2) return `it had ${sc} sentence(s), not exactly 2`;
  if (!endsClean(t)) return "it did not end on a complete sentence";
  if (t.length < min) return `it was ${t.length} characters, under the ${MIN_CHARS} minimum`;
  if (t.length > max) return `it was ${t.length} characters — too long, the limit is ${MAX_CHARS}`;
  if (BANNED_RE.test(t)) return "it used the word honest / aus / честно, which is banned in KSA copy";
  if (ICB_RE.test(t) && !(body && ICB_RE.test(body))) return "it mentioned ICB, which this article is not about";
  if (META_RE.test(t)) return "it described the article instead of speaking directly to the reader";
  if (FORMULA_RE.test(t)) return "it told the reader to read (Discover/Learn/Loe/Узнайте…) instead of stating the information itself";
  if (endsOnPromo(t, title)) return "its closing sentence ended on a clinic or product name, which reads as an advert";
  if (body && isLifted(t, body)) return "it copied a sentence from the article instead of writing original copy";
  return null;
}
