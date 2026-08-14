/**
 * POST /api/admin/generate-excerpt
 *
 * Writes the card excerpt for a post: original copy, exactly two sentences,
 * summarising the WHOLE article — never sentences lifted from the body.
 * Same rules and thresholds as the batch script; both import lib/excerpt-rules.mjs
 * so the editor's button and the CLI can never disagree.
 *
 * In: { title, body, lang }  Out: { excerpt } | { error }
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { LANG_NAMES, MIN_CHARS, MAX_CHARS, plainBody, validateExcerpt } from "@/lib/excerpt-rules.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.EXCERPT_MODEL || "claude-sonnet-5";

function articleForPrompt(body: string): string {
  if (body.length <= 11000) return body;
  return `${body.slice(0, 7000)}\n\n[…middle of article omitted…]\n\n${body.slice(-4000)}`;
}

function buildPrompt(title: string, body: string, lang: string, problem?: string | null): string {
  const L = (LANG_NAMES as Record<string, string>)[lang] ?? "Estonian";
  return `You write card excerpts for the KSA Silmakeskus (Estonian eye clinic) blog.

Write the excerpt for the article below, in ${L} only.

WHAT AN EXCERPT IS:
Original copy you write yourself — exactly two sentences that capture what the
whole article is about and make the right reader want to open it. It is written
for the reader, not about the article.

LENGTH — this is the rule most often broken, so handle it first:
- ${MIN_CHARS}-${MAX_CHARS} characters IN TOTAL, aiming for about 180.
- That is roughly 28 words across BOTH sentences combined. Keep each sentence short.
- Draft it, count the characters, and if it is over ${MAX_CHARS}, cut detail until it
  fits. Never fix length by adding a third sentence.

HARD RULES:
- EXACTLY TWO sentences. Not one, not three.
- ORIGINAL WORDING. Do NOT copy or reword any sentence from the article, and never
  reuse its opening line. Write it in your own words.
- Cover the whole piece, including where it lands — not only how it opens.
- Speak to the reader. Never describe the article to them: no "This article...",
  "The article explains/closes with...", "Selles artiklis...", "Статья
  рассказывает...". Just tell them the substance directly.
- Both sentences complete, ending in . ! or ?. Never end mid-word. Never use "..." or "…".
- Only facts, names and numbers that appear in the article. Invent nothing.
- Calm, professional, trustworthy. Never salesy. No superlatives (best, magic,
  revolutionary, perfect, parim, imeline, лучший, чудо). No clickbait the article
  does not deliver.
- Never use the word honest / aus / честно.
- Never mention ICB or ИКБ.
- Do not open with the article's title.
- Output ONLY the excerpt text in ${L}. No quotes around it, no label, no notes.
${problem ? `\nYour previous attempt was rejected because ${problem}. Fix exactly that, keep everything else, and try again.\n` : ""}
TITLE: ${title}

ARTICLE:
${articleForPrompt(body)}`;
}

export async function POST(req: NextRequest) {
  try {
    const { title, body, lang } = (await req.json()) as {
      title?: string; body?: string; lang?: string;
    };
    const cleanBody = plainBody(String(body ?? ""));
    if (!cleanBody || cleanBody.length < 200) {
      return NextResponse.json(
        { error: "Artikli tekst on liiga lühike, et sellest väljavõtet teha." },
        { status: 400 },
      );
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY puudub." }, { status: 500 });
    }

    const client = new Anthropic();
    const useLang = (LANG_NAMES as Record<string, string>)[String(lang ?? "")] ? String(lang) : "et";

    let excerpt = "";
    let problem: string | null = "start";
    for (let attempt = 0; attempt < 4 && problem; attempt++) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 400,
        messages: [{
          role: "user",
          content: buildPrompt(String(title ?? ""), cleanBody, useLang, attempt === 0 ? null : problem),
        }],
      });
      // Join every text block — reading only content[0] returns empty whenever
      // the first block isn't text.
      excerpt = (res.content ?? [])
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join(" ")
        .trim()
        .replace(/^["'«»]+|["'«»]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();
      problem = validateExcerpt(excerpt, useLang, cleanBody, { strict: true, title: String(title ?? "") });
    }

    if (problem) {
      return NextResponse.json(
        { error: `Ei suutnud reeglitele vastavat väljavõtet luua (${problem}). Proovi uuesti.` },
        { status: 422 },
      );
    }
    return NextResponse.json({ excerpt });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
