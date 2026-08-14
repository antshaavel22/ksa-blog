import { buildRssFeed } from "@/lib/rss";

export async function GET() {
  return new Response(buildRssFeed("et"), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
