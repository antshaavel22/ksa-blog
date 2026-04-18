"use client";

import { useEffect } from "react";

/**
 * Tiny client helper that tells the browser what language the current page is in.
 * CookieBanner (and future i18n-aware components) read this to localize themselves.
 *
 * Sets both:
 *   - document.documentElement.lang  (for accessibility / SEO sanity)
 *   - document.body.dataset.lang     (belt-and-braces for the banner)
 *
 * Must be a client component so it runs after hydration.
 */
export default function PageLang({ lang }: { lang: string }) {
  useEffect(() => {
    const l = (lang || "et").toLowerCase().slice(0, 2);
    document.documentElement.lang = l;
    if (document.body) document.body.dataset.lang = l;
  }, [lang]);
  return null;
}
