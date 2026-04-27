/**
 * VimeoEmbed — responsive 16:9 iframe embed for MDX posts.
 *
 * Usage in MDX:
 *   <VimeoEmbed id="725184410" />
 *   <VimeoEmbed url="https://vimeo.com/725184410" />
 *   <VimeoEmbed url="https://vimeo.com/725184410/abc123" caption="Keity Meieri lugu" />
 */

interface VimeoEmbedProps {
  /** Vimeo video ID (e.g. "725184410") */
  id?: string;
  /** Full Vimeo URL — id is extracted automatically */
  url?: string;
  /** Accessible title for the iframe. Defaults to "Vimeo video" */
  title?: string;
  /** Optional caption shown below the video */
  caption?: string;
}

function extractId(url: string): { id: string; hash?: string } | null {
  try {
    const u = new URL(url);
    // player.vimeo.com/video/ID  or  vimeo.com/video/ID
    const playerMatch = u.pathname.match(/\/video\/(\d+)/);
    if (playerMatch) return { id: playerMatch[1] };
    // vimeo.com/ID  or  vimeo.com/ID/HASH (private/unlisted videos)
    const m = u.pathname.match(/^\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
    if (m) return { id: m[1], hash: m[2] };
  } catch {
    // not a URL, might already be an ID
  }
  // Bare numeric ID fallback
  const bare = url.match(/^\d+$/);
  if (bare) return { id: url };
  return null;
}

export default function VimeoEmbed({ id, url, title = "Vimeo video", caption }: VimeoEmbedProps) {
  const parsed = id ? { id } : url ? extractId(url) : null;

  if (!parsed) {
    return (
      <div className="aspect-video bg-[#f5f3ee] rounded-xl flex items-center justify-center text-[#9a9a9a] text-sm my-8">
        Video not found
      </div>
    );
  }

  const src = parsed.hash
    ? `https://player.vimeo.com/video/${parsed.id}?h=${parsed.hash}&badge=0&autopause=0&player_id=0&app_id=58479`
    : `https://player.vimeo.com/video/${parsed.id}?badge=0&autopause=0&player_id=0&app_id=58479`;

  return (
    <figure className="my-8">
      <div className="aspect-video relative rounded-xl overflow-hidden bg-black">
        <iframe
          src={src}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-[#9a9a9a]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
