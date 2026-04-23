"use client";

import { useEffect } from "react";
import { hasAnalyticsConsent } from "@/lib/consent";

const GTM_ID = "GTM-KCZVRJ8";
const GA4_ID = "G-7R7T8GF37J";

export default function Analytics() {
  useEffect(() => {
    if (hasAnalyticsConsent()) loadAnalytics();

    const handler = () => {
      if (hasAnalyticsConsent()) loadAnalytics();
    };
    window.addEventListener("ksa:consent-changed", handler);
    return () => window.removeEventListener("ksa:consent-changed", handler);
  }, []);

  return null;
}

function loadAnalytics() {
  if ((window as unknown as { __ksa_analytics_loaded?: boolean }).__ksa_analytics_loaded) return;
  (window as unknown as { __ksa_analytics_loaded?: boolean }).__ksa_analytics_loaded = true;

  (function (w: Record<string, unknown>, d: Document, s: string, l: string, i: string) {
    const dl = (w[l] = (w[l] as unknown[]) || []) as unknown[];
    dl.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    const f = d.getElementsByTagName(s)[0] as HTMLElement;
    const j = d.createElement(s) as HTMLScriptElement;
    j.async = true;
    j.src = "https://www.googletagmanager.com/gtm.js?id=" + i;
    f.parentNode!.insertBefore(j, f);
  })(window as unknown as Record<string, unknown>, document, "script", "dataLayer", GTM_ID);

  const ga = document.createElement("script");
  ga.async = true;
  ga.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(ga);

  const w = window as unknown as { dataLayer: unknown[] };
  w.dataLayer = w.dataLayer || [];
  function gtag(...args: unknown[]) { w.dataLayer.push(args); }
  gtag("js", new Date());
  gtag("config", GA4_ID);
}
