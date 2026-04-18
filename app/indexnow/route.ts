/**
 * IndexNow key verification endpoint.
 *
 * IndexNow requires the `keyLocation` URL to return the key as plain text,
 * matching the key value passed in API submissions.
 *
 * We serve it here (not as a public/*.txt file) because Next.js's dynamic
 * [slug] route intercepts static files under public/ that share a URL shape
 * with blog posts.
 */
// IndexNow key is public by design (verifies domain ownership). Hardcoding
// avoids needing to set INDEXNOW_KEY in Vercel env for the endpoint to work.
const INDEXNOW_KEY = "056efc03cd2d7c9612d2dd756fc6273a";

export const dynamic = "force-static";

export async function GET() {
  return new Response(INDEXNOW_KEY, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
