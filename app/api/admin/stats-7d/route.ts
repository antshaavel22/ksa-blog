import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ rows: [] });
  const { data, error } = await supabase
    .from("blog_events_7d_by_slug")
    .select("slug,views,cta_views,cta_clicks,ctr_pct")
    // All slugs, most-read first. The old top-50-by-CTR cut made the admin's
    // 7-day total undercount (243 shown vs 385 real on 2026-09-09) and hid the
    // newsletter's featured stories, which have many views but a low CTR.
    .order("views", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ rows: [], error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
