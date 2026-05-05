/**
 * POST /api/admin/format-body
 * Reformats article body + excerpts to KSA blog standard:
 *   1. Deterministic cleanup (empty H2s, stray periods, excess blanks, broken bullets)
 *   2. Excerpt / seoExcerpt — truncate to last full sentence or append "..."
 *   3. Claude structural polish — inserts H2 headings, paragraph breaks, bold lead-ins
 *      under strict word-preservation rules. Never rewrites meaning.
 *
 * Preserves: links, images, YouTube/Rendia embeds, bold/italic, MDX tags.
 *
 * Input:  { body, excerpt, seoExcerpt, title, lang }
 * Output: { body, excerpt, seoExcerpt, stats: { before, after, addedHeadings } }
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

// Load .env.local in dev
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

// ─── Deterministic cleanup ────────────────────────────────────────────────────
function deterministicClean(body: string): string {
  let out = body;
  // Normalise line endings
  out = out.replace(/\r\n/g, "\n");
  // Reattach orphan sentence-ending punctuation that wrapped to its own line.
  // AI scout output often produces:    "...зрения\n. Исторически возможности..."
  // Reattach the dot/?/!/…/:/; to the preceding word so it reads "зрения. Исторически…".
  // Must run BEFORE the "remove stray period-only lines" rule, otherwise the dot
  // disappears entirely.
  // Includes : and ; because section labels frequently break across lines too:
  //   "...делится на два типа\n:\nВододефицитный…" → "…делится на два типа: Вододефицитный…"
  out = out.replace(/([^\n\s])\n([.!?…:;]+)(\s+|$)/g, "$1$2$3");
  // Also collapse a colon/semicolon sitting alone on its own line between two text lines:
  //   "word\n:\nNext" → "word: Next"
  out = out.replace(/([^\n\s])\n([:;])\n(?=\S)/g, "$1$2 ");
  // Remove empty H2/H3/H4 lines (e.g. "## " with nothing after)
  out = out.replace(/^#{2,4}\s*$/gm, "");
  // Remove stray single-period lines (". " or just ".")
  out = out.replace(/^\s*\.\s*$/gm, "");
  // Collapse 3+ blank lines to 2
  out = out.replace(/\n{3,}/g, "\n\n");
  // Trim trailing whitespace per line
  out = out.split("\n").map((l) => l.replace(/\s+$/, "")).join("\n");
  // Fix space-before-punctuation across the board ("word ." → "word.")
  out = out.replace(/(\S) +([.!?,;:])/g, "$1$2");
  // Trim overall
  return out.trim() + "\n";
}

// ─── Excerpt hygiene (mirrors scripts/fix-excerpts.mjs) ──────────────────────
function fixExcerpt(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return s;
  if (/[.!?…]$/.test(s) || /\.\.\.$/.test(s)) return s;
  // Try to truncate to last sentence ending
  const m = s.match(/^(.*[.!?…])[^.!?…]*$/);
  if (m) {
    const truncated = m[1].trim();
    if (truncated.length >= 50 && truncated.length >= s.length * 0.4) {
      return truncated;
    }
  }
  return s.replace(/[,;:\s]+$/, "") + "...";
}

// ─── Word-count tolerance check ──────────────────────────────────────────────
// Unicode-aware: matches letters across alphabets (Latin, Cyrillic, etc.)
// Plain \w is [A-Za-z0-9_] which under-counts RU drastically and ET (õäöü).
function wordCount(s: string): number {
  return (s.match(/\p{L}[\p{L}\p{M}\d]*/gu) ?? []).length;
}

// ─── Claude structural polish ────────────────────────────────────────────────
async function claudePolish(body: string, title: string, lang: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return body;

  const langLabel = lang === "ru" ? "Russian" : lang === "en" ? "English" : "Estonian";
  const client = new Anthropic();

  const prompt = `You are a markdown structure editor for the KSA Silmakeskus blog. Your ONLY job is to improve readability through structure — NEVER rewrite meaning, NEVER add or remove facts, NEVER translate.

Language: ${langLabel}
Title: ${title}

RULES — strict:
1. Keep ALL words. You may reorder or split sentences for readability, but the word set must be preserved (±5% tolerance).
2. Insert \`## H2\` headings at natural topic breaks (3–5 H2s for a typical article). Headings must be in ${langLabel} and derived from the content below them.
3. Split wall-of-text paragraphs (>120 words) into 2–3 shorter ones. Keep paragraphs 40–90 words ideally.
4. For definition-style list intros like "X: Foo bar" at the start of a paragraph, convert to **X.** Foo bar (bold lead-in).
5. Preserve EXACTLY: all markdown links [text](url), images ![alt](url), MDX tags like <YouTubeEmbed .../> and <RendiaEmbed .../>, bold **x**, italic *x*, existing bullet lists.
6. Do NOT add new sentences, examples, or commentary. Do NOT add disclaimers. Do NOT add a conclusion section that wasn't there.
7. Return ONLY the reformatted markdown body. No frontmatter. No code fences. No explanation before or after.

BODY TO REFORMAT:
───────
${body}
───────

Return only the reformatted markdown body now.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (response.content[0] as { text: string }).text.trim();
  // Strip accidental code fences
  return text.replace(/^```(?:markdown|mdx)?\n?/i, "").replace(/\n?```$/i, "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const { body, excerpt, seoExcerpt, title, lang } = (await req.json()) as {
      body: string;
      excerpt?: string;
      seoExcerpt?: string;
      title?: string;
      lang?: string;
    };

    if (!body?.trim()) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    // 1. Deterministic cleanup
    const cleaned = deterministicClean(body);
    const beforeWords = wordCount(cleaned);

    // 2. Claude polish (skipped if < 150 words — too short to need H2 structure)
    let polished = cleaned;
    let addedHeadings = 0;
    if (beforeWords >= 150) {
      try {
        const claude = await claudePolish(cleaned, title ?? "", lang ?? "et");
        const afterWords = wordCount(claude);
        const drift = Math.abs(afterWords - beforeWords) / beforeWords;
        if (drift <= 0.1) {
          polished = claude;
          addedHeadings =
            (claude.match(/^## /gm) ?? []).length - (cleaned.match(/^## /gm) ?? []).length;
        }
        // If drift > 10%, discard AI output silently and return cleaned-only
      } catch {
        // Network/API error — fall back to deterministic-only
      }
    }

    return NextResponse.json({
      body: polished,
      excerpt: fixExcerpt(excerpt ?? ""),
      seoExcerpt: fixExcerpt(seoExcerpt ?? ""),
      stats: {
        before: beforeWords,
        after: wordCount(polished),
        addedHeadings: Math.max(0, addedHeadings),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "format failed" },
      { status: 500 }
    );
  }
}
