"use client";

import { useEffect } from "react";

/**
 * Sets document.documentElement.lang for the current page and notifies listeners
 * (ConsentBanner, Analytics) via ksa:lang-changed. Must be mounted on every route.
 */
export default function PageLang({ lang }: { lang: string }) {
  useEffect(() => {
    const raw = (lang || "et").toLowerCase().slice(0, 2);
    const l = raw === "ru" || raw === "en" ? raw : "et";
    if (document.documentElement.lang !== l) {
      document.documentElement.lang = l;
    }
    if (document.body) document.body.dataset.lang = l;
    window.dispatchEvent(new CustomEvent("ksa:lang-changed", { detail: l }));
  }, [lang]);
  return null;
}
