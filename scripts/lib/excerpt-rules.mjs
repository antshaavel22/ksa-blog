// Single source of truth for what makes a valid excerpt.
//
// House rule (Ants, 2026-08-14): an excerpt is ORIGINAL copy — exactly two
// sentences that catchily summarise the WHOLE article, written for the reader.
// Never sentences lifted from the body, never cut mid-sentence.
//
// Everything that checks excerpts imports from here — the audit, the generator,
// and the prebuild gate — so the thresholds can never drift apart again.

// Two sentences that genuinely summarise a whole article land around 180-220
// characters; below ~130 they stop saying anything, above ~230 the card copy
// starts to wrap badly on mobile.
export const MIN_CHARS = 130;
export const MAX_CHARS = 230;
// Accept-band used when judging text we did not just generate, so we don't
// churn excerpts that are only a few characters outside the writing target.
export const HARD_MIN = 110;
export const HARD_MAX = 260;

export const LANG_NAMES = { et: "Estonian", ru: "Russian", en: "English" };

// Banned in KSA customer copy: "honest" reads as a manipulation tell in Estonian
// culture, and ICB is not promoted in card copy.
export const BANNED_RE = /\b(honest|honestly|aus|ausalt|честно|честный)\b|\bICB\b|ИКБ/iu;

// Meta phrasing — describing the article instead of speaking to the reader.
export const META_RE = /\b(this|the)\s+(article|post|piece)\b|selles\s+artiklis|artikkel\s+(räägib|selgitab|annab)|(в\s+)?(этой\s+)?статье|статья\s+(рассказывает|объясняет)/iu;

export const norm = (s) =>
  s.toLowerCase().replace(/[«»""'']/g, '"').replace(/\s+/g, " ").trim();

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
export function validateExcerpt(ex, lang, body, { strict = false } = {}) {
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
  if (BANNED_RE.test(t)) return "it used a banned word (honest / aus / честно, or ICB)";
  if (META_RE.test(t)) return "it described the article instead of speaking directly to the reader";
  if (body && isLifted(t, body)) return "it copied a sentence from the article instead of writing original copy";
  return null;
}
