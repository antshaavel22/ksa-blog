/** Normalize a raw category name or slug to a consistent registry key */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")   // strip &, #, etc.
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Display names for categories per language
export const CATEGORY_LABELS: Record<string, { et: string; ru: string; en: string }> = {
  edulood: { et: "Edulood", ru: "Истории успеха", en: "Success Stories" },
  kogemuslood: { et: "Kogemuslood", ru: "Истории пациентов", en: "Patient Stories" },
  "flow-protseduur": { et: "Flow Protseduur", ru: "Процедура Flow", en: "Flow Procedure" },
  "huvitavad-faktid": { et: "Huvitavad faktid", ru: "Интересные факты", en: "Interesting Facts" },
  "ksa-silmakeskus": { et: "KSA Silmakeskus", ru: "KSA Vision Center", en: "KSA Vision Center" },
  "nagemise-korrigeerimine": { et: "Nägemise korrigeerimine", ru: "Коррекция зрения", en: "Vision Correction" },
  "silmad-ja-tervis": { et: "Silmad ja Tervis", ru: "Глаза и Здоровье", en: "Eyes & Health" },
  "silmade-tervis-nipid": { et: "Silmade tervis & nipid", ru: "Здоровье глаз", en: "Eye Health & Tips" },
  "eye-health-tips": { et: "Silmade tervis & nipid", ru: "Здоровье глаз", en: "Eye Health & Tips" },
  "eye-health--tips": { et: "Silmade tervis & nipid", ru: "Здоровье глаз", en: "Eye Health & Tips" },
  tehnoloogia: { et: "Tehnoloogia", ru: "Технология", en: "Technology" },
  "tehnoloogia-laserprotseduur": { et: "Tehnoloogia & laserprotseduur", ru: "Технология & лазер", en: "Technology & Laser" },
};

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
