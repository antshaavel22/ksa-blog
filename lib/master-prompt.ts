/**
 * KSA Blog — Master Content System Prompt loader
 *
 * The prompt text lives in content/system/master-prompt.md
 * so editors can view and update it from the admin panel.
 *
 * This module is SERVER-SIDE ONLY (used in API routes and scripts).
 */

import fs from "fs";
import path from "path";

const PROMPT_FILE = path.join(process.cwd(), "content/system/master-prompt.md");

function loadPrompt(): string {
  try {
    return fs.readFileSync(PROMPT_FILE, "utf-8");
  } catch {
    return FALLBACK_PROMPT;
  }
}

export function getKSAMasterPrompt(): string {
  return loadPrompt();
}

// Keep named export for backwards compat with batch-generate and write-post
export const KSA_MASTER_PROMPT = loadPrompt();

/**
 * Language-specific SEO keywords to weave in naturally.
 */
export const LANG_SEO_KEYWORDS: Record<string, string[]> = {
  et: [
    "laserkorrektsiooni hind",
    "silmade laseroperatsioon Tallinnas",
    "Flow3 laserkorrektsiooni meetod",
    "kuivsilma sündroom ravi",
    "silmade põhjalik läbivaatus",
    "KSA Silmakeskus",
    "müoopia ravi",
    "prillide asendamine operatsiooniga",
    "lühinägelikkuse operatsioon",
  ],
  ru: [
    "лазерная коррекция зрения Таллинн",
    "операция на глаза Flow3",
    "синдром сухого глаза лечение Таллинн",
    "комплексное обследование зрения",
    "KSA Silmakeskus",
    "лечение близорукости Эстония",
    "лазерная операция цена Таллинн",
    "очки или операция",
    "коррекция зрения без флэпа",
  ],
  en: [
    "laser eye surgery Tallinn",
    "Flow3 laser procedure Estonia",
    "dry eye treatment Tallinn",
    "comprehensive eye examination Estonia",
    "KSA Silmakeskus",
    "refractive surgery Tallinn",
    "vision correction without glasses",
    "eye surgery cost Estonia",
    "flapless laser eye surgery",
  ],
};

// ── Fallback (used if file missing) ───────────────────────────────────────────

const FALLBACK_PROMPT = `
╔══════════════════════════════════════════════════════════════════════════╗
║           KSA SILMAKESKUS — CONTENT SYSTEM PROMPT v2.0                  ║
╚══════════════════════════════════════════════════════════════════════════╝

You are the lead content editor and medical communicator for KSA Silmakeskus,
an eye clinic in Tallinn, Estonia. You write for blog.ksa.ee.

ABOUT KSA: 55,000+ procedures, Flow3 laser (flapless, 1-week recovery),
advanced dry-eye diagnostics and treatment, comprehensive eye examinations.
Founded by Dr. Ants Haavel.

VOICE: Warm, knowledgeable friend who happens to be an eye doctor.
Not a brochure. Write to ONE person. Hook immediately.

LANGUAGES:
ET — natural Tallinn Estonian, "sina" form, active voice
RU — Baltic Russian (Narva/Riga style), warm, "вы", Таллин (one н)
EN — British English: colour, centre, whilst, GP

READING LEVEL: accessible to a motivated 14-year-old, comfortable for a
40-year-old professional. Medical terms always with plain translation:
"myopia (short-sightedness)", "conjunctivitis (pink eye)"

medicalReview: false for 99% of articles. Only true for specific dosages,
complication percentages, or contraindication lists.

STRUCTURE: Hook → Empathy → 4-6 H2 sections → FAQ → Empowering close.
`;
