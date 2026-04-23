"use client";

import { useEffect, useRef } from "react";
import { sendEvent } from "@/lib/analytics";
import { hasAnalyticsConsent } from "@/lib/consent";
import type { Funnel } from "@/lib/posts";

interface Props {
  slug: string;
  funnel: Funnel;
  lang?: string;
  author?: string;
  medicalTopic?: string;
}

export default function BlogAnalytics({ slug, funnel, lang, author, medicalTopic }: Props) {
  const started = useRef<number | null>(null);
  const thresholdsFired = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!hasAnalyticsConsent()) {
      // Re-check if consent changes mid-session — fire article_view once it flips on.
      const onConsent = () => {
        if (hasAnalyticsConsent() && started.current === null) bootstrap();
      };
      window.addEventListener("ksa:consent-changed", onConsent);
      return () => window.removeEventListener("ksa:consent-changed", onConsent);
    }
    bootstrap();

    function bootstrap() {
      started.current = Date.now();
      sendEvent("article_view", { slug, funnel, lang }, {
        author: author ?? null,
        medicalTopic: medicalTopic ?? null,
      });
    }

    const onScroll = () => {
      if (!hasAnalyticsConsent()) return;
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      if (total <= 0) return;
      const pct = Math.min(100, Math.max(0, (h.scrollTop / total) * 100));
      for (const t of [25, 50, 75, 100]) {
        if (pct >= t && !thresholdsFired.current.has(t)) {
          thresholdsFired.current.add(t);
          sendEvent("scroll_depth", { slug, funnel, lang }, { depth: t });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const onUnload = () => {
      if (!hasAnalyticsConsent() || started.current === null) return;
      const seconds = Math.round((Date.now() - started.current) / 1000);
      if (seconds > 10) {
        sendEvent("read_time", { slug, funnel, lang }, { seconds });
      }
    };
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [slug, funnel, lang, author, medicalTopic]);

  return null;
}
