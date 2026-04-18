"use client";

import { useEffect, useState } from "react";

type Lang = "et" | "ru" | "en";

const T: Record<Lang, {
  body: string;
  policy: string;
  accept: string;
  decline: string;
}> = {
  et: {
    body: "Kasutame küpsiseid (Google Analytics), et mõista, kuidas külastajad meie blogis liiguvad. Andmeid kasutatakse ainult statistika eesmärgil.",
    policy: "Privaatsuspoliitika",
    accept: "Nõustun",
    decline: "Keeldu",
  },
  ru: {
    body: "Мы используем файлы cookie (Google Analytics), чтобы понимать, как посетители пользуются нашим блогом. Данные используются только в статистических целях.",
    policy: "Политика конфиденциальности",
    accept: "Согласен",
    decline: "Отклонить",
  },
  en: {
    body: "We use cookies (Google Analytics) to understand how visitors use our blog. Data is collected for statistics only.",
    policy: "Privacy policy",
    accept: "Accept",
    decline: "Decline",
  },
};

function detectLang(): Lang {
  if (typeof document === "undefined") return "et";
  // 1. <html lang> set by the page — most reliable when a post sets it
  const htmlLang = document.documentElement.lang?.toLowerCase().slice(0, 2);
  if (htmlLang === "ru" || htmlLang === "en" || htmlLang === "et") return htmlLang;
  // 2. data-lang on body — set by post pages at mount time
  const bodyLang = document.body?.dataset?.lang?.toLowerCase();
  if (bodyLang === "ru" || bodyLang === "en" || bodyLang === "et") return bodyLang;
  // 3. browser preference as last resort
  const nav = navigator.language?.toLowerCase().slice(0, 2);
  if (nav === "ru" || nav === "en") return nav;
  return "et";
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [lang, setLang] = useState<Lang>("et");

  useEffect(() => {
    const consent = localStorage.getItem("ksa_cookie_consent");
    if (consent) return;
    // Wait a tick so post-page client components can set <html lang> / body[data-lang]
    const t = setTimeout(() => {
      setLang(detectLang());
      setVisible(true);
    }, 100);
    return () => clearTimeout(t);
  }, []);

  // Re-detect if the post page updates <html lang> after mount (SPA nav)
  useEffect(() => {
    if (!visible) return;
    const obs = new MutationObserver(() => setLang(detectLang()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    if (document.body) obs.observe(document.body, { attributes: true, attributeFilter: ["data-lang"] });
    return () => obs.disconnect();
  }, [visible]);

  function accept() {
    localStorage.setItem("ksa_cookie_consent", "accepted");
    setVisible(false);
    window.dispatchEvent(new Event("ksa_consent_accepted"));
  }

  function decline() {
    localStorage.setItem("ksa_cookie_consent", "declined");
    setVisible(false);
  }

  if (!visible) return null;
  const t = T[lang];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#fff",
        borderTop: "1px solid #e6e6e6",
        padding: "16px 24px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "12px",
        fontFamily: "var(--font-geist-sans, sans-serif)",
        fontSize: "14px",
        color: "#1a1a1a",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
      }}
    >
      <p style={{ margin: 0, flex: "1 1 260px", lineHeight: 1.5 }}>
        {t.body}{" "}
        <a
          href="https://ksa.ee/privaatsuspoliitika/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#87be23", textDecoration: "underline" }}
        >
          {t.policy}
        </a>
      </p>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button
          onClick={decline}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid #e6e6e6",
            background: "#fff",
            color: "#5a6b6c",
            cursor: "pointer",
            fontSize: "14px",
            fontFamily: "inherit",
          }}
        >
          {t.decline}
        </button>
        <button
          onClick={accept}
          style={{
            padding: "8px 20px",
            borderRadius: "6px",
            border: "none",
            background: "#87be23",
            color: "#fff",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          {t.accept}
        </button>
      </div>
    </div>
  );
}
