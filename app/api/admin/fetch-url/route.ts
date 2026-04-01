/**
 * GET /api/admin/fetch-url?url=...
 * Fetches a URL and returns the readable text content stripped of HTML.
 * Used by the admin UI "fetch from URL" feature.
 */

import { NextRequest, NextResponse } from "next/server";

function stripHtml(html: string): string {
  return html
    // Remove script/style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    // Remove nav/header/footer/aside
    .replace(/<(nav|header|footer|aside|figure|figcaption)[^>]*>[\s\S]*?<\/\1>/gi, "")
    // Block elements → newlines
    .replace(/<\/(p|div|h[1-6]|li|br|tr|blockquote|section|article)>/gi, "\n")
    // All remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Collapse whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url param required" }, { status: 400 });

  try {
    new URL(url); // validate
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KSA-Blog-Scout/1.0)" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed: ${res.status} ${res.statusText}` }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return NextResponse.json({ error: `Unsupported content type: ${contentType}` }, { status: 415 });
    }

    const html = await res.text();
    const text = stripHtml(html);

    // Extract title from <title> tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Truncate to ~4000 chars to keep Claude prompt manageable
    const truncated = text.length > 4000 ? text.slice(0, 4000) + "\n\n[content truncated]" : text;

    return NextResponse.json({ text: truncated, title, url, chars: text.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
