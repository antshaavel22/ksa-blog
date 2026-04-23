"use client";

import { CONSENT_COPY } from "./ConsentBanner";

type Lang = "et" | "ru" | "en";

export default function ConsentLink({ lang = "et" }: { lang?: Lang }) {
  const label = (CONSENT_COPY[lang] ?? CONSENT_COPY.et).footerLink;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("ksa:open-consent"))}
      style={{
        background: "none",
        border: 0,
        padding: 0,
        color: "#fff",
        cursor: "pointer",
        fontSize: 12,
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}
