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
    .order("ctr_pct", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ rows: [], error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
