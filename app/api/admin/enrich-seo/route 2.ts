/**
 * POST /api/admin/enrich-seo
 *
 * Fills in MISSING SEO + LLM frontmatter fields without overwriting anything
 * the editor has already filled. One Haiku call generates whatever is empty.
 *
 * Input fields the client sends (any can be null/undefined/empty):
 *   - body, title, lang  (always)
 *   - currentSeoTitle, currentSeoExcerpt, currentLlmQueries (array), currentFaq (array)
 *
 * Output:
 *   {
 *     seoTitle?: string,        // only present if missing on input
 *     seoExcerpt?: string,      // only present if missing on input
 *     llmSearchQueries?: string[],  // only present if missing or empty on input
 *     faqItems?: Array<{q: string; a: string}>,  // only present if missing or empty on input
 *     skipped: string[],        // names of fields that already had content
 *   }
 *
 * Languages supported: et, ru, en. Output strings are in the post's language.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const LANG_LABEL: Record<string, string> = {
  et: "Estonian",
  ru: "Russian",
  en: "English",
};

interface EnrichRequest {
  body: string;
  title: string;
  lang?: string;
  currentSeoTitle?: string;
  currentSeoExcerpt?: string;
  currentLlmQueries?: string[];
  currentFaq?: Array<{ q: string; a: string }>;
}

interface EnrichResponse {
  seoTitle?: string;
  seoExcerpt?: string;
  llmSearchQueries?: string[];
  faqItems?: Array<{ q: string; a: string }>;
  skipped: string[];
}

export async function POST(req: NextRequest) {
  try {
    const input = (await req.json()) as EnrichRequest;
    const { body, title, lang } = input;

    if (!body?.trim() || !title?.trim()) {
      return NextResponse.json({ error: "body and title required" }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const langLabel = LANG_LABEL[lang ?? "et"] ?? "Estonian";

    // Decide which fields to fill
    const need = {
      seoTitle: !input.currentSeoTitle || input.currentSeoTitle.trim().length === 0,
      seoExcerpt: !input.currentSeoExcerpt || input.currentSeoExcerpt.trim().length === 0,
      llm: !input.currentLlmQueries || input.currentLlmQueries.length === 0,
      faq: !input.currentFaq || input.currentFaq.length === 0,
    };
    const skipped: string[] = [];
    if (!need.seoTitle) skipped.push("seoTitle");
    if (!need.seoExcerpt) skipped.push("seoExcerpt");
    if (!need.llm) skipped.push("llmSearchQueries");
    if (!need.faq) skipped.push("faqItems");

    if (!need.seoTitle && !need.seoExcerpt && !need.llm && !need.faq) {
      return NextResponse.json({ skipped } as EnrichResponse);
    }

    // Trim body for prompt (3000 char tokens generally enough for SEO derivation)
    const bodyTrim = body.length > 4000 ? body.slice(0, 4000) + "…" : body;

    // Build a single Haiku call asking only for the fields we need
    const fields: string[] = [];
    if (need.seoTitle) fields.push("seoTitle");
    if (need.seoExcerpt) fields.push("seoExcerpt");
    if (need.llm) fields.push("llmSearchQueries");
    if (need.faq) fields.push("faqItems");

    const prompt = `You generate SEO + LLM-search frontmatter for a KSA Silmakeskus (vision clinic) blog post. The post is in ${langLabel}.

Generate ONLY these fields: ${fields.join(", ")}.

Output strict JSON with exactly these top-level keys (omit any not requested). No commentary, no code fences.

FIELD SPECS:
- seoTitle: string, max 60 characters, ${langLabel}, leads with the primary keyword, ends with " | KSA Silmakeskus" only if doing so keeps it under 60 chars.
- seoExcerpt: string, 130–155 characters, ${langLabel}, complete sentence ending in punctuation (. ! ?), no truncation.
- llmSearchQueries: array of exactly 10 strings — questions or search-style phrases readers might type into Google / Perplexity / ChatGPT to find this post. ${langLabel}. Mix of how/why/what/can-I phrasings. No duplicates.
- faqItems: array of 4–6 objects {q: string, a: string}. ${langLabel}. Q is a real reader question (under 80 chars). A is 1–3 sentences derived from the body — never invent facts. Keep medical claims conservative; cite the body's framing.

VOICE rules (KSA): warm, professional, low-key trust. Never use superlatives ("best", "magical", "revolutionary", "лучший", "чудо", "kõige parem"). Cite numbers and procedure names instead of intensifiers. Russian: spell Tallinn as "Таллинн" (two н).

POST TITLE: ${title}

POST BODY:
───
${bodyTrim}
───

Return JSON now.`;

    const client = new Anthropic();
    const resp = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    let text = (resp.content[0] as { text: string }).text.trim();
    // Strip accidental code fences
    text = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

    let parsed: Partial<EnrichResponse>;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Haiku returned non-JSON output", raw: text.slice(0, 400) },
        { status: 500 }
      );
    }

    // Build the response — only include fields we actually requested AND got back
    const out: EnrichResponse = { skipped };
    if (need.seoTitle && typeof parsed.seoTitle === "string") {
      const t = parsed.seoTitle.trim();
      if (t.length > 0 && t.length <= 70) out.seoTitle = t;
    }
    if (need.seoExcerpt && typeof parsed.seoExcerpt === "string") {
      const e = parsed.seoExcerpt.trim();
      if (e.length > 30 && e.length <= 200) out.seoExcerpt = e;
    }
    if (need.llm && Array.isArray(parsed.llmSearchQueries)) {
      const arr = parsed.llmSearchQueries
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 12);
      if (arr.length >= 5) out.llmSearchQueries = arr;
    }
    if (need.faq && Array.isArray(parsed.faqItems)) {
      const arr = parsed.faqItems
        .filter(
          (x): x is { q: string; a: string } =>
            !!x && typeof (x as { q?: unknown }).q === "string" && typeof (x as { a?: unknown }).a === "string"
        )
        .map((x) => ({ q: x.q.trim(), a: x.a.trim() }))
        .filter((x) => x.q.length > 0 && x.a.length > 0)
        .slice(0, 8);
      if (arr.length >= 3) out.faqItems = arr;
    }

    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "enrich failed" },
      { status: 500 }
    );
  }
}
