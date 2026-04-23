import { toSlug } from "@/lib/categories";

export interface DraftMeta {
  filename: string;
  path: string;
  title: string;
  excerpt: string;
  lang: string;
  date: string;
  slug?: string;
  featuredImage?: string;
  category?: string;
  status?: string;
  assignedTo?: string;
  deadline?: string;
  medicalReview?: boolean;
}

export interface PostResult {
  lang: string;
  filename: string;
  title: string;
  excerpt: string;
}

export const LANG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  et: { bg: "#edf7d6", text: "#3d6b00", border: "#c5e58a" },
  ru: { bg: "#e8f0ff", text: "#1a3a99", border: "#a8c0f0" },
  en: { bg: "#f3e8ff", text: "#5b21b6", border: "#c4b5fd" },
};

export const LANG_NAME: Record<string, string> = { et: "Eesti", ru: "Русский", en: "English" };

export const QUOTES = [
  "Behind every published post is someone who paused, thought carefully, and chose to say something true.",
  "Good writing is an act of generosity — you give the reader clarity they didn't have before.",
  "Words heal. That's why we're here.",
  "Every draft is already an act of courage. Publishing it is just the sequel.",
  "Clarity is the highest form of kindness in writing.",
  "You're not just editing text. You're shaping how someone feels about their eyesight.",
  "The best editors don't just fix — they illuminate.",
  "Write to be understood. Read to grow.",
  "Precision in language is precision in thought.",
  "Your reader doesn't have time — so every sentence must earn its place.",
];

export function parseMdx(raw: string): { frontmatter: string; body: string } | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  return { frontmatter: match[1], body: match[2] };
}

export function getFmField(fm: string, key: string): string {
  const m = fm.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?`, "m"));
  return m ? m[1].trim() : "";
}

export function setFmField(fm: string, key: string, value: string): string {
  const hasDouble = value.includes('"');
  const line = hasDouble
    ? `${key}: '${value.replace(/'/g, "''")}'`
    : `${key}: "${value}"`;
  const re = new RegExp(`^${key}:.*$`, "m");
  return re.test(fm) ? fm.replace(re, () => line) : fm + `\n${line}`;
}

export function setCategoriesField(fm: string, slugsOrSlug: string | string[]): string {
  const slugs = Array.isArray(slugsOrSlug) ? slugsOrSlug : [slugsOrSlug];
  if (slugs.length === 0) return fm;
  const labels = slugs.map(s => s.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
  const block = `categories:\n${labels.map(l => `  - ${l}`).join("\n")}`;
  const blockRe = /^categories:\s*\n(?:[ \t]+-[ \t]+.+\n?)*/m;
  const inlineRe = /^categories:.*$/m;
  if (blockRe.test(fm)) return fm.replace(blockRe, block + "\n");
  if (inlineRe.test(fm)) return fm.replace(inlineRe, block);
  return fm + `\n${block}`;
}

export function getFmCategories(fm: string): string[] {
  const blockMatch = fm.match(/^categories:\s*\n((?:[ \t]+-[ \t]+.+\n?)+)/m);
  if (blockMatch) {
    return blockMatch[1]
      .split("\n")
      .map(line => line.replace(/^[ \t]+-[ \t]+/, "").trim())
      .filter(Boolean)
      .map(cat => toSlug(cat));
  }
  const inlineMatch = fm.match(/^categories:\s*["']?([^"'\n\[\]]+)["']?/m);
  if (inlineMatch) {
    const val = inlineMatch[1].replace(/^-\s*/, "").trim();
    return val ? [toSlug(val)] : [];
  }
  return [];
}

export function buildMdx(frontmatter: string, body: string): string {
  return `---\n${frontmatter}\n---\n${body}`;
}
