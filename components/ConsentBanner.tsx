"use client";

import { useEffect, useState } from "react";
import { readConsent, writeConsent, isDNT, type ConsentState } from "@/lib/consent";

type Lang = "et" | "ru" | "en";

const T: Record<Lang, {
  pitch: string;
  allowAll: string;
  onlyNecessary: string;
  settings: string;
  title: string;
  save: string;
  necessary: string;
  analytics: string;
  marketing: string;
  necessaryNote: string;
  analyticsNote: string;
  marketingNote: string;
  close: string;
  footerLink: string;
}> = {
  et: {
    pitch: "Kasutame küpsiseid veebi parendamiseks ja statistikaks. Vaid vajalikud on vaikimisi sees.",
    allowAll: "Luba kõik",
    onlyNecessary: "Ainult vajalikud",
    settings: "Seaded",
    title: "Küpsiste seaded",
    save: "Salvesta valikud",
    necessary: "Vajalikud",
    analytics: "Analüütika",
    marketing: "Turundus",
    necessaryNote: "Vajalikud küpsised veebi tööks — neid ei saa välja lülitada.",
    analyticsNote: "Anonüümne statistika: artiklite lugemus ja CTA klikkide mõõtmine (GA4, sisene blog_events).",
    marketingNote: "Reklaamikampaaniate efektiivsuse mõõtmine (Meta pikslid jms, kui kasutatakse).",
    close: "Sulge",
    footerLink: "Küpsiste seaded",
  },
  ru: {
    pitch: "Мы используем cookies для улучшения сайта и статистики. По умолчанию включены только необходимые.",
    allowAll: "Разрешить все",
    onlyNecessary: "Только необходимые",
    settings: "Настройки",
    title: "Настройки cookies",
    save: "Сохранить",
    necessary: "Необходимые",
    analytics: "Аналитика",
    marketing: "Маркетинг",
    necessaryNote: "Необходимые cookies для работы сайта — их нельзя отключить.",
    analyticsNote: "Анонимная статистика: просмотры статей и клики по CTA (GA4, внутренние blog_events).",
    marketingNote: "Измерение эффективности рекламных кампаний (Meta pixel и т.п.).",
    close: "Закрыть",
    footerLink: "Настройки cookies",
  },
  en: {
    pitch: "We use cookies to improve the site and collect statistics. Only necessary cookies are on by default.",
    allowAll: "Allow all",
    onlyNecessary: "Only necessary",
    settings: "Settings",
    title: "Cookie settings",
    save: "Save choices",
    necessary: "Necessary",
    analytics: "Analytics",
    marketing: "Marketing",
    necessaryNote: "Necessary cookies for site operation — cannot be disabled.",
    analyticsNote: "Anonymous statistics: article reads and CTA click tracking (GA4, internal blog_events).",
    marketingNote: "Measuring advertising campaign performance (Meta pixel etc. if used).",
    close: "Close",
    footerLink: "Cookie settings",
  },
};

export default function ConsentBanner({ lang = "et" }: { lang?: Lang }) {
  const [decided, setDecided] = useState<boolean>(true); // assume decided until hydrated
  const [showSettings, setShowSettings] = useState(false);
  const [a, setA] = useState(false);
  const [m, setM] = useState(false);

  useEffect(() => {
    if (isDNT()) {
      // DNT = auto-reject everything. Record decision so banner doesn't reappear.
      writeConsent({ a: false, m: false });
      setDecided(true);
      return;
    }
    const existing = readConsent();
    if (existing) {
      setA(existing.a);
      setM(existing.m);
      setDecided(true);
    } else {
      setDecided(false);
    }

    const onOpen = () => setShowSettings(true);
    window.addEventListener("ksa:open-consent", onOpen);
    return () => window.removeEventListener("ksa:open-consent", onOpen);
  }, []);

  function save(state: Omit<ConsentState, "ts">) {
    writeConsent(state);
    setA(state.a);
    setM(state.m);
    setDecided(true);
    setShowSettings(false);
    window.dispatchEvent(new CustomEvent("ksa:consent-changed", { detail: state }));
  }

  const t = T[lang] ?? T.et;

  if (decided && !showSettings) return null;

  if (showSettings) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.45)",
          zIndex: 70,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowSettings(false);
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 28,
            maxWidth: 480,
            width: "100%",
            boxShadow: "0 16px 48px rgba(0,0,0,.25)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
            <h2 style={{ fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: "-0.015em" }}>{t.title}</h2>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              style={{ background: "none", border: 0, fontSize: 13, color: "var(--ink-60)", cursor: "pointer" }}
            >
              {t.close}
            </button>
          </div>

          <Row label={t.necessary} note={t.necessaryNote} checked disabled />
          <Row label={t.analytics} note={t.analyticsNote} checked={a} onChange={setA} />
          <Row label={t.marketing} note={t.marketingNote} checked={m} onChange={setM} />

          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <button
              type="button"
              onClick={() => save({ a, m })}
              style={{
                flex: 1,
                padding: "12px 18px",
                background: "var(--lime)",
                color: "var(--ink)",
                border: 0,
                borderRadius: 999,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {t.save}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Banner
  return (
    <div
      role="dialog"
      aria-label={t.title}
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 60,
        maxWidth: 380,
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 12px 40px rgba(0,0,0,.18)",
        fontSize: 13,
      }}
    >
      <div style={{ color: "var(--ink-80)", lineHeight: 1.55, marginBottom: 14 }}>{t.pitch}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          onClick={() => save({ a: true, m: true })}
          style={{
            padding: "10px 18px",
            background: "var(--lime)",
            color: "var(--ink)",
            border: 0,
            borderRadius: 999,
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {t.allowAll}
        </button>
        <button
          type="button"
          onClick={() => save({ a: false, m: false })}
          style={{
            padding: "10px 16px",
            background: "#fff",
            color: "var(--ink)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {t.onlyNecessary}
        </button>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          style={{
            padding: "10px 8px",
            background: "transparent",
            color: "var(--ink-60)",
            border: 0,
            cursor: "pointer",
            fontSize: 13,
            textDecoration: "underline",
          }}
        >
          {t.settings}
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  note,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  note: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        padding: "14px 0",
        borderTop: "1px solid var(--line)",
        alignItems: "flex-start",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--ink-60)", marginTop: 4, lineHeight: 1.5 }}>{note}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        style={{ marginTop: 4, width: 18, height: 18 }}
      />
    </label>
  );
}

export { T as CONSENT_COPY };
