"use client";

/**
 * RendiaEmbed — Rendia patient-education video embed for MDX posts.
 *
 * Rendia's embed mechanism: a <var data-presentation="UUID"> placeholder
 * that hub.rendia.com/whitelabel/embed.js transforms into a video player.
 *
 * Usage in MDX:
 *   <RendiaEmbed id="3e00363f-4c2d-417e-4c88-4cc44d954a81" />
 *   <RendiaEmbed id="3e00363f-4c2d-417e-4c88-4cc44d954a81" caption="Allikas: Rendia" />
 *
 * The `id` is the UUID from the data-presentation attribute in the Rendia embed code.
 * (Click the </> button in Rendia's Embed Manager and copy the data-presentation value.)
 *
 * ⚠️ blog.ksa.ee must be whitelisted by Rendia for embeds to display.
 *    Contact: Terrie Brown (Terrie.Brown@patientpoint.com) to add the domain.
 *    Currently whitelisted: silmatervis.ksa.ee
 */

import { useEffect } from "react";

const RENDIA_SCRIPT = "//hub.rendia.com/whitelabel/embed.js";

interface RendiaEmbedProps {
  /** UUID from the data-presentation attribute in Rendia's embed code */
  id: string;
  /** Optional caption shown below the video */
  caption?: string;
}

export default function RendiaEmbed({ id, caption }: RendiaEmbedProps) {
  useEffect(() => {
    if (!id) return;
    // Rendia's embed.js binds findAndLoadPlayers to window.load, which has
    // already fired by the time React mounts. We must call it ourselves.
    type RendiaWindow = Window & { findAndLoadPlayers?: () => void };
    const w = window as RendiaWindow;
    const trigger = () => { if (typeof w.findAndLoadPlayers === "function") w.findAndLoadPlayers(); };
    const existing = document.querySelector(`script[src="${RENDIA_SCRIPT}"]`) as HTMLScriptElement | null;
    if (existing) {
      trigger();
    } else {
      const script = document.createElement("script");
      script.src = RENDIA_SCRIPT;
      script.type = "text/javascript";
      script.async = true;
      script.onload = trigger;
      document.body.appendChild(script);
    }
  }, [id]);

  if (!id) {
    return (
      <div className="aspect-video bg-[#f5f3ee] rounded-xl flex items-center justify-center text-[#9a9a9a] text-sm my-8">
        Rendia video ID puudub
      </div>
    );
  }

  return (
    <figure className="my-8 rounded-xl overflow-hidden">
      {/* Rendia transforms this <var> into their video player via embed.js */}
      <var
        style={{ width: "100%", paddingBottom: "56.25%", display: "block" }}
        data-presentation={id}
      >
        <a href={`http://fyi.rendia.com/${id}`} style={{ display: "none" }}>
          View Video
        </a>
      </var>
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-[#9a9a9a]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
