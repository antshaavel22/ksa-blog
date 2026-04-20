/**
 * VimeoEmbed — responsive 16:9 iframe embed for MDX posts.
 *
 * Usage in MDX:
 *   <VimeoEmbed id="725184410" />
 *   <VimeoEmbed id="725184410" title="Keity Meier – Flow3 laseroperatsioon" />
 *   <VimeoEmbed id="725184410" caption="Keity Meieri lugu" />
 */

interface VimeoEmbedProps {
  /** Vimeo video ID (e.g. "725184410") */
  id: string;
  /** Accessible title for the iframe. Defaults to "Vimeo video" */
  title?: string;
  /** Optional caption shown below the video */
  caption?: string;
}

export default function VimeoEmbed({ id, title = "Vimeo video", caption }: VimeoEmbedProps) {
  if (!id) {
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
          src={`https://player.vimeo.com/video/${id}?badge=0&autopause=0&player_id=0&app_id=58479`}
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
