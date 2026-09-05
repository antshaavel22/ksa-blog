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

  const w = window as unknown as {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  w.dataLayer = w.dataLayer || [];

  // MUST push the `arguments` object, not a rest-parameter array.
  //
  // This previously read `function gtag(...args) { dataLayer.push(args) }`,
  // which pushes a real Array. gtag.js only interprets dataLayer entries that
  // are Arguments objects and silently ignores arrays — so "config" never
  // registered, no page_view was ever sent, and GA4 recorded ZERO traffic for
  // blog.ksa.ee while GTM, the scripts and consent all looked perfectly
  // healthy. Verified in the browser: our own pushes were `isArray: true`
  // while GTM's internal push was `isArguments: true`.
  //
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gtag: (...args: any[]) => void = function () {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  };
  // Expose it so anything else on the page can send events too.
  w.gtag = gtag;

  gtag("js", new Date());
  gtag("config", GA4_ID);
}
