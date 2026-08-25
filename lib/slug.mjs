// Post URL slugs — single source of truth.
//
// The previous implementation applied `.slice(0, 60)` as its LAST step, after
// trimming hyphens. A hard character cut lands wherever it lands, so it sliced
// words in half and could leave a dangling hyphen. Across the blog that produced
// 127 URLs cut mid-word (/...-kuiva-silma-s, /...-punctum-plugs-to-qu) and 33
// ending in a bare hyphen.
//
// Cutting on a word boundary instead costs nothing and never produces a
// half-word. Keep every slug generator importing from here.

const MAP = {
  ä: "a", ö: "o", ü: "u", õ: "o", š: "s", ž: "z",
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function transliterate(s) {
  return String(s).toLowerCase().split("").map((c) => MAP[c] ?? c).join("");
}

// Filler words, already transliterated. Dropped only when a slug is over
// length — a short title keeps its natural wording.
//
// Silvia's feedback (2026-08-25): the generated URLs are hard to read and hard
// to say out loud. They were running 6-10 words because every word survived up
// to the 60-character limit. Google does not reward short slugs, but people
// share and read them, so the words that carry meaning should come first.
const STOPWORDS = new Set([
  // Estonian
  "ja", "või", "voi", "kui", "see", "on", "ei", "aga", "mis", "kes", "kas",
  "oma", "ka", "siis", "veel", "nii", "et", "seda", "sinu", "meie", "teie",
  "kuidas", "miks", "millal", "kus", "need", "selle", "ning",
  // English
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "your", "you", "we", "our", "it", "its",
  "how", "why", "when", "what", "does", "do", "did", "can", "as", "at", "by",
  "from", "that", "this", "these", "those", "but", "if", "so",
  // Russian (transliterated by the map above)
  "i", "ili", "kak", "chto", "eto", "dlya", "na", "s", "po", "iz", "u", "o",
  "ne", "no", "a", "vash", "vashi", "nash", "nashi", "my", "vy", "ikh", "ego",
  "ee", "pochemu", "kogda", "gde", "li", "zhe", "tak", "vse", "ves",
]);

/**
 * Build a URL slug from a title.
 *
 * Aims for something a person can read and repeat: at most `maxWords` words
 * and `max` characters, cut only on word boundaries, never leaving a dangling
 * hyphen. Filler words are dropped only when the slug is too long, so short
 * titles keep their natural phrasing.
 */
export function toSlug(title, { max = 50, maxWords = 6 } = {}) {
  const base = transliterate(title)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!base) return "";

  let words = base.split("-").filter(Boolean);
  const fits = (w) => w.length <= maxWords && w.join("-").length <= max;
  if (fits(words)) return words.join("-");

  // Too long: drop filler words, but never all of them.
  const meaningful = words.filter((w) => !STOPWORDS.has(w));
  if (meaningful.length >= 2) words = meaningful;
  if (fits(words)) return words.join("-");

  // Still long: keep the leading words that fit, whole words only.
  const kept = [];
  for (const w of words.slice(0, maxWords)) {
    const next = [...kept, w].join("-");
    if (next.length > max && kept.length > 0) break;
    kept.push(w);
  }
  return (kept.length ? kept.join("-") : words[0]).replace(/-+$/, "");
}
