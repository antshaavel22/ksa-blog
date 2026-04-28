import { NextResponse } from "next/server";

// Cross-language sister-article sync was retired 2026-04-28. ET / RU / EN
// posts are independent works for SEO (Ahrefs) — editing one must never
// touch another. This endpoint is kept as a no-op for any old admin client
// that still calls it; it always reports zero sisters and zero updates.
export async function POST() {
  return NextResponse.json({ ok: true, sistersFound: 0, synced: [], alreadySynced: 0 });
}

export async function GET() {
  return NextResponse.json({ source: null, sisters: [] });
}
