"use client";

/**
 * RendiaEmbed — responsive 16:9 Rendia patient-education video embed for MDX posts.
 *
 * Rendia's whitelabel embed requires the current page URL to be base64-encoded
 * in the src path. This Client Component reads the live URL at render time.
 *
 * Usage in MDX:
 *   <RendiaEmbed id="abc123" />
 *   <RendiaEmbed id="abc123" title="Kuidas katarakti ravitakse" />
 *   <RendiaEmbed id="abc123" caption="Allikas: Rendia / PatientPoint" />
 *
 * The `id` is the Rendia video ID (UUID or short ID from fyi.rendia.com links).
 *
 * NOTE: blog.ksa.ee must be whitelisted by Rendia (contact Terrie Brown or Janice Mitchell)
 * for embeds to display. Currently silmatervis.ksa.ee is whitelisted — blog.ksa.ee may need adding.
 */

import { usePathname } from "next/navigation";

const BLOG_BASE = "https://blog.ksa.ee";

interface RendiaEmbedProps {
  /** Rendia video ID — UUID or short ID */
  id: string;
  /** Accessible iframe title. Defaults to "Rendia video" */
  title?: string;
  /** Optional caption shown below the video */
  caption?: string;
}

export default function RendiaEmbed({ id, title = "Rendia video", caption }: RendiaEmbedProps) {
  const pathname = usePathname();

  if (!id) {
    return (
      <div className="aspect-video bg-[#f5f3ee] rounded-xl flex items-center justify-center text-[#9a9a9a] text-sm my-8">
        Rendia video ID puudub
      </div>
    );
  }

  // Rendia whitelabel embed format:
  // https://share.rendia.com/whitelabel/load/{base64(pageUrl)}/{videoId}
  const pageUrl = `${BLOG_BASE}${pathname}`;
  const encodedUrl = btoa(pageUrl);
  const src = `https://share.rendia.com/whitelabel/load/${encodedUrl}/${id}`;

  return (
    <figure className="my-8">
      <div className="aspect-video relative rounded-xl overflow-hidden bg-[#0a0a0a]">
        <iframe
          src={src}
          title={title}
          allow="autoplay; fullscreen"
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
