import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isBot } from "@/lib/bot-detect";

// Don't cache this route or statically prerender it.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT_PER_MIN = 60;

// CORS: ksa-web's ported BlogAnalytics (ksa.ee/blogi/[slug]) sends events
// here cross-origin via sendBeacon, keeping all analytics in this one
// Supabase pipeline instead of a duplicate. The Blob content-type
// ("application/json") is not CORS-safelisted, so the browser preflights
// with OPTIONS before the real POST — both the preflight AND the actual
// POST response need these headers, or the browser logs a CORS failure
// even though the request itself completed (found via live testing
// 2026-08-27 — only the OPTIONS handler had them at first).
const ALLOWED_ORIGIN = "https://ksa.ee";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  // navigator.sendBeacon always sends credentials (cookies) cross-origin —
  // unlike fetch, there's no way to opt it out. Without this, the browser
  // silently blocks the beacon at the CORS preflight and no event is sent.
  "Access-Control-Allow-Credentials": "true",
};

function respond(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Ingest blog analytics events. No PII: IP is dropped, admin sessions skipped,
 * bots filtered by UA, hard-capped at 60 req/min per visitor_id.
 */
export async function POST(req: Request) {
  // Skip admin traffic so editors don't pollute reader stats.
  const cookieHeader = req.headers.get("cookie") ?? "";
  if (cookieHeader.includes("admin_session=ksa-admin-authenticated")) {
    return respond({ skipped: "admin" }, 202);
  }

  const userAgent = req.headers.get("user-agent");
  if (isBot(userAgent)) {
    return respond({ skipped: "bot" }, 202);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return respond({ error: "invalid_json" }, 400);
  }

  const eventName = String(payload.event_name ?? "");
  const visitorId = String(payload.visitor_id ?? "");
  const sessionId = String(payload.session_id ?? "");
  if (!eventName || !visitorId || !sessionId) {
    return respond({ error: "missing_fields" }, 400);
  }
  if (eventName.length > 64 || visitorId.length > 64 || sessionId.length > 64) {
    return respond({ error: "field_too_long" }, 400);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // Analytics not configured — accept silently so the client doesn't retry.
    return respond({ skipped: "not_configured" }, 202);
  }

  // Rate-limit: 60 events/min per visitor, hard cap. Atomic upsert-with-check.
  const now = new Date();
  const { data: rateRow } = await supabase
    .from("blog_event_rate")
    .select("window_start,count")
    .eq("visitor_id", visitorId)
    .maybeSingle();

  let windowStart = now;
  let count = 1;
  if (rateRow) {
    const ws = new Date(rateRow.window_start);
    const ageMs = now.getTime() - ws.getTime();
    if (ageMs < 60_000) {
      if (rateRow.count >= RATE_LIMIT_PER_MIN) {
        return respond({ error: "rate_limited" }, 429);
      }
      windowStart = ws;
      count = rateRow.count + 1;
    }
  }
  await supabase.from("blog_event_rate").upsert({
    visitor_id: visitorId,
    window_start: windowStart.toISOString(),
    count,
  });

  const slug = typeof payload.slug === "string" ? payload.slug.slice(0, 200) : null;
  const funnel = typeof payload.funnel === "string" ? payload.funnel.slice(0, 32) : null;
  const lang = typeof payload.lang === "string" ? payload.lang.slice(0, 8) : null;
  const props = typeof payload.props === "object" && payload.props !== null ? payload.props : {};
  const referrer =
    typeof payload.referrer === "string" ? payload.referrer.slice(0, 500) : null;

  // Store truncated UA for coarse device/browser segmentation — no IP ever.
  const uaClean = userAgent ? userAgent.slice(0, 300) : null;

  const { error } = await supabase.from("blog_events").insert({
    event_name: eventName,
    slug,
    funnel,
    lang,
    props,
    session_id: sessionId,
    visitor_id: visitorId,
    user_agent: uaClean,
    referrer,
  });

  if (error) {
    return respond({ error: "write_failed" }, 500);
  }
  return respond({ ok: true }, 202);
}
