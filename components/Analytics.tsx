"use client";

import { useEffect } from "react";

const GTM_ID = "GTM-KCZVRJ8";
const GA4_ID = "G-7R7T8GF37J";

export default function Analytics() {
  useEffect(() => {
    const consent = localStorage.getItem("ksa_cookie_consent");
    if (consent === "accepted") loadAnalytics();

    const handler = () => loadAnalytics();
    window.addEventListener("ksa_consent_accepted", handler);
    return () => window.removeEventListener("ksa_consent_accepted", handler);
  }, []);

  return null;
}

function loadAnalytics() {
  if ((window as any).__ksa_analytics_loaded) return;
  (window as any).__ksa_analytics_loaded = true;

  // GTM
  (function (w: any, d: Document, s: string, l: string, i: string) {
    w[l] = w[l] || [];
    w[l].push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    const f = d.getElementsByTagName(s)[0] as HTMLElement;
    const j = d.createElement(s) as HTMLScriptElement;
    j.async = true;
    j.src = "https://www.googletagmanager.com/gtm.js?id=" + i;
    f.parentNode!.insertBefore(j, f);
  })(window, document, "script", "dataLayer", GTM_ID);

  // GA4
  const ga = document.createElement("script");
  ga.async = true;
  ga.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(ga);

  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: any[]) { (window as any).dataLayer.push(args); }
  gtag("js", new Date());
  gtag("config", GA4_ID);
}
