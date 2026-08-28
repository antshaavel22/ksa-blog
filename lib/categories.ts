/** Normalize a raw category name or slug to a consistent registry key */
export function toSlug(name: string): string {
  if (typeof name !== "string") return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")   // strip &, #, etc.
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Display names for categories — trilingual, keyed by slug
export const CATEGORY_LABELS: Record<string, { et: string; ru: string; en: string }> = {
  // Lifestyle / general
  elustiil:              { et: "Elustiil",                  ru: "Стиль жизни",          en: "Lifestyle" },
  lifestyle:             { et: "Elustiil",                  ru: "Стиль жизни",          en: "Lifestyle" },
  // Stories
  edulood:               { et: "Edulood",                   ru: "Истории успеха",        en: "Success Stories" },
  "success-stories":     { et: "Edulood",                   ru: "Истории успеха",        en: "Success Stories" },
  kogemuslood:           { et: "Kogemuslood",               ru: "Истории пациентов",     en: "Patient Stories" },
  "patient-stories":     { et: "Kogemuslood",               ru: "Истории пациентов",     en: "Patient Stories" },
  // Procedures
  "flow-protseduur":     { et: "Flow Protseduur",           ru: "Процедура Flow",        en: "Flow Procedure" },
  "flow-procedure":      { et: "Flow Protseduur",           ru: "Процедура Flow",        en: "Flow Procedure" },
  // Facts & science
  "huvitavad-faktid":    { et: "Huvitavad faktid",          ru: "Интересные факты",      en: "Interesting Facts" },
  "interesting-facts":   { et: "Huvitavad faktid",          ru: "Интересные факты",      en: "Interesting Facts" },
  // KSA brand
  "ksa-silmakeskus":     { et: "KSA Silmakeskus",           ru: "Глазной центр KSA",     en: "KSA Vision Center" },
  "ksa-vision-center":   { et: "KSA Silmakeskus",           ru: "Глазной центр KSA",     en: "KSA Vision Center" },
  // Vision correction
  "nagemise-korrigeerimine": { et: "Nägemise korrigeerimine", ru: "Коррекция зрения",    en: "Vision Correction" },
  "vision-correction":   { et: "Nägemise korrigeerimine",   ru: "Коррекция зрения",      en: "Vision Correction" },
  // Eye health
  "silmad-ja-tervis":    { et: "Silmad ja Tervis",          ru: "Глаза и Здоровье",      en: "Eyes & Health" },
  "eyes-health":         { et: "Silmad ja Tervis",          ru: "Глаза и Здоровье",      en: "Eyes & Health" },
  "silmade-tervis-nipid":{ et: "Silmade tervis & nipid",    ru: "Здоровье глаз",         en: "Eye Health & Tips" },
  "eye-health-tips":     { et: "Silmade tervis & nipid",    ru: "Здоровье глаз",         en: "Eye Health & Tips" },
  "eye-health--tips":    { et: "Silmade tervis & nipid",    ru: "Здоровье глаз",         en: "Eye Health & Tips" },
  "eye-health":          { et: "Silmade tervis & nipid",    ru: "Здоровье глаз",         en: "Eye Health & Tips" },
  // Tech
  tehnoloogia:           { et: "Tehnoloogia",               ru: "Технология",            en: "Technology" },
  technology:            { et: "Tehnoloogia",               ru: "Технология",            en: "Technology" },
  "tehnoloogia-laserprotseduur": { et: "Tehnoloogia & laserprotseduur", ru: "Технология & лазер", en: "Technology & Laser" },
};

// Slug variants that share an identical trilingual label above (language-variant
// duplicates, e.g. an EN post's "Flow Procedure" vs. an ET post's "Flow Protseduur")
// collapse onto one canonical slug for pill listing + filtering. This does NOT
// reclassify any post's actual category value — it only merges display/filter,
// so no post frontmatter needs editing and nothing can crash a build.
export const CATEGORY_ALIASES: Record<string, string> = {
  lifestyle: "elustiil",
  "success-stories": "edulood",
  "patient-stories": "kogemuslood",
  "flow-procedure": "flow-protseduur",
  "interesting-facts": "huvitavad-faktid",
  "ksa-vision-center": "ksa-silmakeskus",
  "vision-correction": "nagemise-korrigeerimine",
  "eyes-health": "silmad-ja-tervis",
  "eye-health-tips": "silmade-tervis-nipid",
  "eye-health--tips": "silmade-tervis-nipid",
  "eye-health": "silmade-tervis-nipid",
  technology: "tehnoloogia",
  // Diacritic-damaged slug: toSlug() strips ä/ö/õ/ü rather than transliterating,
  // so a category typed "Nägemise korrigeerimine" that doesn't already match an
  // entry mints "ngemise-korrigeerimine". Same category, not a separate one.
  "ngemise-korrigeerimine": "nagemise-korrigeerimine",
  // EN long tail: one- and two-post categories minted ad hoc by generated
  // drafts. Same subjects as the canonical set, different wording.
  "eyes-and-health": "silmad-ja-tervis",
  "flow3-procedure": "flow-protseduur",
  flow3: "flow-protseduur",
  "laser-eye-surgery": "flow-protseduur",
  "laser-technology": "tehnoloogia",
  "laser-eye-surgery-technology": "tehnoloogia",
  "eye-health-wellness": "silmade-tervis-nipid",
  "eye-care-tips": "silmade-tervis-nipid",
  "eye-care": "silmade-tervis-nipid",
  "eye-health-advice": "silmade-tervis-nipid",
  "eye-health-education": "silmade-tervis-nipid",
  "vision-tips": "silmade-tervis-nipid",
  "childrens-eye-health": "silmade-tervis-nipid",
  prevention: "silmade-tervis-nipid",
  safety: "silmade-tervis-nipid",
  "customer-stories": "kogemuslood",
  "client-stories": "kogemuslood",
  "patient-experience": "kogemuslood",
  "ksa-eye-clinic": "ksa-silmakeskus",
  wellness: "elustiil",
  "digital-lifestyle": "elustiil",
  "living-in-estonia": "elustiil",
  "medical-travel": "elustiil",
  "patient-education": "huvitavad-faktid",
  "icb-lens-implantation": "nagemise-korrigeerimine",
  // Typo / truncation variants of existing categories.
  "technology-laser-procedure": "tehnoloogia",
  "tehnoloogia-laserprotseduur": "tehnoloogia",
  "silmade-tervis": "silmade-tervis-nipid",
  "uncategorized-et": "uncategorized",
  edulool: "edulood",
};

/**
 * Category names that toSlug() cannot slugify, because it strips every
 * non-ASCII character: a Cyrillic name like "Глаза и здоровье" reduces to the
 * empty string, and "Flow Процедура" reduces to "flow". On the RU blog that
 * collapsed most Cyrillic-named categories into one nameless pill.
 *
 * Resolved by name rather than by slug, so the original character data is
 * still there to match on. Keys are lowercased; see resolveCategorySlug().
 *
 * Some entries are recovering mangled transliterations of Estonian names
 * ("Силмад ья Тервис" ← "Silmad ja Tervis") left by generated drafts.
 */
export const CATEGORY_NAME_ALIASES: Record<string, string> = {
  // Flow procedure
  "flow процедура": "flow-protseduur",
  "процедура flow": "flow-protseduur",
  "flow3 процедура": "flow-protseduur",
  "процедура flow3": "flow-protseduur",
  "flow proцедура": "flow-protseduur",
  "лазерная процедура": "flow-protseduur",
  // Eye health
  "глаза и здоровье": "silmad-ja-tervis",
  "силмад и здоровье": "silmad-ja-tervis",
  "силмад ья тервис": "silmad-ja-tervis",
  "силмад яа тервис": "silmad-ja-tervis",
  "силмад я терvis": "silmad-ja-tervis",
  "силмад ja tervis": "silmad-ja-tervis",
  "силма ja tervis": "silmad-ja-tervis",
  // Eye health tips
  "здоровье глаз": "silmade-tervis-nipid",
  "здоровье глаз и советы": "silmade-tervis-nipid",
  советы: "silmade-tervis-nipid",
  "советы и рекомендации": "silmade-tervis-nipid",
  "советы по зрению": "silmade-tervis-nipid",
  "детское зрение": "silmade-tervis-nipid",
  диагностика: "silmade-tervis-nipid",
  "диагностика зрения": "silmade-tervis-nipid",
  // Vision correction
  "коррекция зрения": "nagemise-korrigeerimine",
  "лазерная коррекция": "nagemise-korrigeerimine",
  // Clinic
  "глазной центр ksa": "ksa-silmakeskus",
  "силмакескус ksa": "ksa-silmakeskus",
  // Facts
  "интересные факты": "huvitavad-faktid",
  "мифы и факты": "huvitavad-faktid",
  // Stories
  "истории клиентов": "kogemuslood",
  "истории пациентов": "kogemuslood",
  "истории опыта": "kogemuslood",
  "опыт пациентов": "kogemuslood",
  "истории успеха": "edulood",
  // Lifestyle / tech / none
  "образ жизни": "elustiil",
  технология: "tehnoloogia",
  "технология & лазерная процедура": "tehnoloogia",
  "без категории": "uncategorized",
};

export function canonicalCategorySlug(slug: string): string {
  return CATEGORY_ALIASES[slug] ?? slug;
}

/**
 * Raw category name (as written in a post's frontmatter) -> canonical slug.
 * Checks the name map first so non-ASCII names survive, then falls back to
 * slugifying and de-aliasing. Use this instead of canonicalCategorySlug(toSlug(x)).
 */
export function resolveCategorySlug(name: string): string {
  if (typeof name !== "string") return "";
  const byName = CATEGORY_NAME_ALIASES[name.trim().toLowerCase()];
  if (byName) return byName;
  return canonicalCategorySlug(toSlug(name));
}

export function getCategoryLabel(slug: string, lang: "et" | "ru" | "en" = "et"): string {
  const entry = CATEGORY_LABELS[slug];
  if (entry) return entry[lang];
  // Fallback: humanize slug
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Categories that trigger kiirtest-inline CTA (Rule 1)
export const KIIRTEST_INLINE_CATEGORIES = [
  "flow-protseduur",
  "flow-procedure",
  "nagemise-korrigeerimine",
  "vision-correction",
  "edulood",
  "success-stories",
  "kogemuslood",
  "patient-stories",
];

// Categories that suppress CTA entirely (Rule 3)
export const NO_CTA_CATEGORIES = [
  "silmad-ja-tervis",
  "eyes-health",
  "silmade-tervis-nipid",
  "eye-health-tips",
];
