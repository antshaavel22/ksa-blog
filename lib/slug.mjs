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

/**
 * Build a URL slug from a title.
 * Truncates on a word boundary, never mid-word, and never leaves a trailing
 * hyphen. A single word longer than `max` is kept whole rather than cut.
 */
export function toSlug(title, { max = 60 } = {}) {
  const base = transliterate(title)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (base.length <= max) return base;

  // Keep whole words only: cut back to the last hyphen at or before the limit.
  const cut = base.slice(0, max + 1);
  const lastDash = cut.lastIndexOf("-");
  if (lastDash > 0) return cut.slice(0, lastDash).replace(/-+$/, "");

  // No boundary within the limit — the first word alone is longer than `max`.
  // Keeping it whole beats emitting a fragment.
  const firstDash = base.indexOf("-");
  return (firstDash > 0 ? base.slice(0, firstDash) : base).replace(/-+$/, "");
}
