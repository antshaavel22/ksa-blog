/**
 * POST /api/admin/generate-excerpt
 *
 * Writes the card excerpt for a post: original copy, exactly two sentences,
 * summarising the WHOLE article — never sentences lifted from the body.
 *
 * The prompt, retry strategy and native-editor polish all live in
 * lib/excerpt-writer.mjs, and validation in lib/excerpt-rules.mjs. This route
 * used to carry its own copy of the prompt and retry loop; when the CLI script
 * was improved, this one silently kept the old version and the editor's
 * ✨ Genereeri button started failing ("312 characters — the limit is 280") on
 * articles the CLI handled fine. Importing the shared writer is what stops that
 * from recurring — do not inline prompt logic here again.
 *
 * In: { title, body, lang }  Out: { excerpt } | { error }
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { LANG_NAMES, plainBody } from "@/lib/excerpt-rules.mjs";
import { writeExcerpt } from "@/lib/excerpt-writer.mjs";

export const runtime = "nodejs";
// The polish pass adds a second model call on top of up to six generation
// attempts, so allow the full serverless window rather than the default 60s.
export const maxDuration = 300;

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

    const useLang = (LANG_NAMES as Record<string, string>)[String(lang ?? "")] ? String(lang) : "et";

    const { excerpt, problem } = await writeExcerpt({
      client: new Anthropic(),
      title: String(title ?? ""),
      body: cleanBody,
      lang: useLang,
    });

    if (problem) {
      // Hand back the best draft alongside the reason: a near-miss the editor can
      // trim in five seconds is far more useful than an empty field and a retry.
      return NextResponse.json(
        {
          error: `Ei suutnud reeglitele täielikult vastavat väljavõtet luua (${problem}).`,
          draft: excerpt || undefined,
        },
        { status: 422 },
      );
    }
    return NextResponse.json({ excerpt });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
