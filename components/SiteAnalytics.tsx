"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Sends page views, booking-link clicks and exits to ksa.ee/api/track.
 *
 * blog.ksa.ee is a separate app but the same website to a reader, so its
 * traffic reports into the same dashboard rather than a second one nobody
 * checks. Copied from ksa-web; keep the two in step.
 *
 * Uses sendBeacon so it never delays navigation, and sets no cookies — see
 * app/api/track/route.ts for why that matters. Any failure is swallowed: a
 * visitor must never notice that analytics exists.
 */
export default function SiteAnalytics({
  lang,
  endpoint = "https://ksa.ee/api/track",
}: {
  lang?: string;
  /** blog.ksa.ee points this at https://ksa.ee/api/track so both sites report
      into one dashboard. */
  endpoint?: string;
}) {
  const pathname = usePathname();

  useEffect(() => {
    // The admin is staff using the tool, not visitors using the site. Counting
    // it would inflate every figure on the dashboard it feeds.
    if (pathname?.startsWith("/admin")) return;

    const send = (kind: string, meta?: unknown) => {
      try {
        const payload = JSON.stringify({ kind, path: pathname, lang, meta });
        // text/plain keeps this a "simple" request, so the identical component
        // works from blog.ksa.ee without a CORS preflight on every event.
        if (navigator.sendBeacon) {
          navigator.sendBeacon(endpoint, new Blob([payload], { type: "text/plain" }));
        } else {
          void fetch(endpoint, {
            method: "POST",
            body: payload,
            keepalive: true,
            headers: { "Content-Type": "text/plain" },
          });
        }
      } catch {
        /* never surface analytics errors */
      }
    };

    send("view");

    // A click onto booking.ksa.ee is the closest thing to a conversion we can
    // see from the website side.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (href.includes("booking.ksa.ee")) send("booking", { href });
    };

    // "Exit" = left without going anywhere else on the site.
    const onHide = () => {
      if (document.visibilityState === "hidden") send("exit");
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [pathname, lang, endpoint]);

  return null;
}
