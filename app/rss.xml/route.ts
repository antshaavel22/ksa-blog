import { buildRssFeed } from "@/lib/rss";

// Combined all-language feed. Per-language feeds (matching site policy that
// ET/RU/EN are independent article sets) live at /rss/et.xml, /rss/ru.xml,
// /rss/en.xml.
export async function GET() {
  return new Response(buildRssFeed(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
