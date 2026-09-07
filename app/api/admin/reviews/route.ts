/**
 * GET  /api/admin/reviews            → { reviews: { [slug]: { A?: iso, S?: … } } }
 * POST /api/admin/reviews            → toggle one tick
 *        body: { slug, editor, read: boolean }
 *
 * Ticks live in Supabase, NOT in the MDX frontmatter. A tick has to be instant;
 * writing frontmatter would mean a GitHub commit and a ~2 min Vercel rebuild
 * every time an editor clicks a checkbox.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isEditorCode } from "@/lib/editors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReviewMap = Record<string, Record<string, string>>;

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ reviews: {}, unavailable: true });
  }
  const { data, error } = await supabase
    .from("post_reviews")
    .select("slug,editor,ticked_at");
  if (error) {
    return NextResponse.json({ reviews: {}, error: error.message }, { status: 500 });
  }
  const reviews: ReviewMap = {};
  for (const row of data ?? []) {
    const slug = String(row.slug);
    (reviews[slug] ??= {})[String(row.editor)] = String(row.ticked_at);
  }
  return NextResponse.json({ reviews });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Andmebaas pole seadistatud (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY puudub)." },
      { status: 500 },
    );
  }
  const { slug, editor, read } = (await req.json()) as {
    slug?: string; editor?: string; read?: boolean;
  };
  if (!slug || !isEditorCode(editor)) {
    return NextResponse.json({ error: "slug ja editor (A/S/J/M) on kohustuslikud" }, { status: 400 });
  }

  if (read) {
    // upsert so a double-click can't error on the composite primary key
    const { error } = await supabase
      .from("post_reviews")
      .upsert({ slug, editor, ticked_at: new Date().toISOString() }, { onConflict: "slug,editor" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("post_reviews").delete().eq("slug", slug).eq("editor", editor);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, slug, editor, read: !!read });
}
