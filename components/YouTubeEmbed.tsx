/**
 * YouTubeEmbed — responsive 16:9 iframe embed for MDX posts.
 *
 * Usage in MDX:
 *   <YouTubeEmbed id="dQw4w9WgXcQ" />
 *   <YouTubeEmbed id="dQw4w9WgXcQ" title="KSA Flow3 laser procedure" />
 *
 * Or with full URL (url param):
 *   <YouTubeEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
 */

interface YouTubeEmbedProps {
  /** YouTube video ID (e.g. "dQw4w9WgXcQ") */
  id?: string;
  /** Full YouTube URL — id is extracted automatically */
  url?: string;
  /** Accessible title for the iframe. Defaults to "YouTube video" */
  title?: string;
  /** Optional caption shown below the video */
  caption?: string;
}

function extractId(url: string): string | null {
  try {
    const u = new URL(url);
    // Standard: youtube.com/watch?v=ID
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    // Short: youtu.be/ID
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    // Embed: youtube.com/embed/ID
    const embedMatch = u.pathname.match(/\/embed\/([^/?]+)/);
    if (embedMatch) return embedMatch[1];
  } catch {
    // not a URL, might already be an ID
  }
  return null;
}

export default function YouTubeEmbed({ id, url, title = "YouTube video", caption }: YouTubeEmbedProps) {
  const videoId = id ?? (url ? extractId(url) : null);

  if (!videoId) {
    return (
      <div className="aspect-video bg-[#f5f3ee] rounded-xl flex items-center justify-center text-[#9a9a9a] text-sm my-8">
        Video not found
      </div>
    );
  }

  return (
    <figure className="my-8">
      <div className="aspect-video relative rounded-xl overflow-hidden bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
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
