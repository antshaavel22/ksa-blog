/**
 * Blog editors and who is responsible for reading which language.
 *
 * Routing set by Ants (2026-09-05):
 *   ET  →  Mia, Silvia, Ants
 *   RU  →  Jana
 *   EN  →  Ants
 *
 * Note on M: this is Mia Haavel, who is NOT in the KSA Slack workspace. She is
 * a different person from Mai Hollo (mai.hollo@ksa.ee), who is marketing-ops
 * and not a blog editor — do not route reading tasks to Mai.
 *
 * The single-letter code is what's stored in Supabase `post_reviews.editor`
 * and what shows on the dashboard badges.
 */
export type EditorCode = "A" | "S" | "J" | "M";

export interface Editor {
  code: EditorCode;
  name: string;
  /** Languages this editor is expected to proof-read. */
  reads: Array<"et" | "ru" | "en">;
  /** Slack user id, for the Friday reminder. Absent = not in Slack. */
  slackId?: string;
  /** Used when the editor is not reachable in Slack. */
  email?: string;
  colour: string;
}

export const EDITORS: Editor[] = [
  { code: "A", name: "Ants",   reads: ["et", "en"], slackId: "U08C1C757NX", colour: "#2f6f2f" },
  { code: "S", name: "Silvia", reads: ["et"],       slackId: "U08N63QURHC", colour: "#7a5800" },
  // Mia Haavel — not in Slack; reached by email, or via Ants in the channel post.
  { code: "M", name: "Mia",    reads: ["et"],       email: "mia.haavel@ksa.ee", colour: "#8a4b2a" },
  { code: "J", name: "Jana",   reads: ["ru"],       slackId: "U093CDPHZS5", colour: "#2a5f8a" },
];

export const EDITOR_BY_CODE: Record<EditorCode, Editor> = Object.fromEntries(
  EDITORS.map((e) => [e.code, e]),
) as Record<EditorCode, Editor>;

/** Editors expected to read a post in this language. */
export function editorsForLang(lang: string): Editor[] {
  const l = (lang || "et").trim().toLowerCase();
  return EDITORS.filter((e) => (e.reads as string[]).includes(l));
}

export function isEditorCode(v: unknown): v is EditorCode {
  return v === "A" || v === "S" || v === "J" || v === "M";
}
