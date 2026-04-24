/**
 * Funnel auto-classifier.
 *
 * Decides which Smart CTA fires on a post without editor intervention.
 * Priority:
 *   1. Explicit override via frontmatter `funnelOverride: true` — trust editor's `funnel`.
 *   2. Keyword rules (title + categories + slug + first 500 chars of body).
 *   3. Fall back to whatever `funnel` frontmatter says (typically flow3 or general).
 *
 * The fallback guarantees we never show nothing — worst case is the Kiirtest qualifier.
 */

import type { Funnel } from "./posts";

const AUDIT_KEYWORDS = [
  // ET
  "glaukoom", "kae", "kollatähn", "kollatähni", "silmapõhja", "silmarõhu", "makula",
  "hormoon", "hormonaal", "beebipill", "rasedus", "menopaus",
  "diabeet", "kõrgvererõhu", "vanust", "45+", "50+", "60+",
  // RU
  "глаукома", "катаракта", "макул", "диабет", "гормон",
  // EN
  "glaucoma", "cataract", "macular", "diabet", "hormone", "pregnancy", "menopaus",
];

const KIDS_KEYWORDS = [
  // ET
  "laps", "lapsed", "laste", "kooliõpilas", "koolivorm", "lasteaed", "tudengeile",
  // RU
  "детск", "ребён", "ребенк", "ребят", "школьник",
  // EN
  "children", "child", "kids", "toddler", "school-age",
];

const DRYEYE_KEYWORDS = [
  // ET
  "kuiv silm", "kuivasilma", "kuivsilma", "pisarakile", "pisaranäärme",
  "bensalkoonium", "BAK", "OMR", "Rexon Eye", "pisarakanali kork", "punctum plug",
  // RU
  "сухой глаз", "сухость глаз", "BAK", "OMR",
  // EN
  "dry eye", "tear film", "meibomian", "punctum plug", "Rexon",
];

const KIDS_CATEGORIES = new Set(["laste-nagemiskontroll", "childrens-vision"]);

function hasAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

export interface ClassifierInput {
  title?: string;
  slug?: string;
  categories?: string[];
  body?: string;
  funnel?: Funnel;          // current frontmatter value
  funnelOverride?: boolean; // if true, trust frontmatter unconditionally
}

/**
 * Resolve the effective funnel for a post.
 * Safe to call on any post — always returns a valid funnel.
 */
export function resolveFunnel(input: ClassifierInput): Funnel {
  // 1. Explicit editor override wins.
  if (input.funnelOverride && input.funnel) {
    return input.funnel;
  }

  // 2. Category signals (strongest).
  const cats = (input.categories ?? []).map((c) => c.toLowerCase());
  if (cats.some((c) => KIDS_CATEGORIES.has(c))) return "kids";

  // 3. Keyword rules on title + slug + first 500 chars of body.
  const probe = [
    input.title ?? "",
    input.slug ?? "",
    (input.body ?? "").slice(0, 500),
  ].join(" ");

  if (hasAny(probe, KIDS_KEYWORDS)) return "kids";
  if (hasAny(probe, DRYEYE_KEYWORDS)) return "dryeye";
  if (hasAny(probe, AUDIT_KEYWORDS)) return "audit";

  // 4. Fall back to frontmatter (flow3 / general).
  return input.funnel ?? "general";
}
