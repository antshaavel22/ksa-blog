"use client";

import type { Funnel } from "@/lib/posts";
import { sendEvent, buildCtaUrl } from "@/lib/analytics";
import { RAW_CONFIG, resolveCtaEntry, normalizeLang, type CtaLang } from "@/lib/cta-config";

const LABELS: Record<CtaLang, { eyebrow: string; fallback: string; secondary: string }> = {
  et: {
    eyebrow: "Sinu järgmine samm",
    fallback: "Vali rahulikult sobiv järgmine samm.",
    secondary: "Kiirem tee alustamiseks",
  },
  ru: {
    eyebrow: "Ваш следующий шаг",
    fallback: "Выберите спокойный и понятный следующий шаг.",
    secondary: "Быстрый способ начать",
  },
  en: {
    eyebrow: "Your next step",
    fallback: "Choose a calm, practical next step.",
    secondary: "A faster way to start",
  },
};

interface ContextualInlineCTAProps {
  funnel: Funnel;
  slug: string;
  lang?: string;
}

export default function ContextualInlineCTA({ funnel, slug, lang }: ContextualInlineCTAProps) {
  const normalizedLang = normalizeLang(lang);
  const raw = RAW_CONFIG[funnel] ?? RAW_CONFIG.general;
  const c = resolveCtaEntry(raw, normalizedLang);
  const labels = LABELS[normalizedLang];

  if (!c?.live) return null;

  const campaign = c.campaign?.trim() || funnel;
  const primaryHref = buildCtaUrl(c.primaryHref, funnel, slug, campaign);
  const secondaryHref = c.secondaryHref ? buildCtaUrl(c.secondaryHref, funnel, slug, campaign) : null;

  const handleClick = (target: string, href: string) => () => {
    sendEvent("cta_click", { slug, funnel, lang }, { target, placement: "inline_contextual" });
    try {
      const hostname = new URL(href, window.location.href).hostname;
      if (hostname && hostname !== window.location.hostname) {
        sendEvent("funnel_outbound", { slug, funnel, lang }, { destination: hostname, placement: "inline_contextual" });
      }
    } catch {}
  };

  return (
    <aside
      aria-label={labels.eyebrow}
      style={{
        margin: "44px 0",
        padding: 24,
        borderRadius: 20,
        border: "1px solid var(--line)",
        background: "linear-gradient(135deg, var(--beige-light) 0%, #fff 100%)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          color: "var(--ink-40)",
          fontWeight: 650,
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {labels.eyebrow}
      </div>
      <h2
        style={{
          fontSize: "clamp(23px, 3vw, 30px)",
          lineHeight: 1.14,
          letterSpacing: "-0.02em",
          fontWeight: 500,
          margin: "0 0 10px",
          color: "var(--ink)",
        }}
      >
        {c.headline}
      </h2>
      <p style={{ margin: "0 0 18px", color: "var(--ink-60)", fontSize: 15, lineHeight: 1.55 }}>
        {c.primarySub || c.sub || labels.fallback}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <a
          href={primaryHref}
          onClick={handleClick(`${funnel}_inline_primary`, primaryHref)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 46,
            padding: "12px 18px",
            borderRadius: 999,
            background: c.accent,
            color: "var(--ink)",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 650,
          }}
        >
          {c.primaryLabel}
        </a>
        {secondaryHref && c.secondaryLabel && (
          <a
            href={secondaryHref}
            onClick={handleClick(`${funnel}_inline_secondary`, secondaryHref)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 46,
              padding: "12px 18px",
              borderRadius: 999,
              border: "1px solid var(--line)",
              color: "var(--ink)",
              background: "#fff",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {c.secondaryLabel || labels.secondary}
          </a>
        )}
      </div>
    </aside>
  );
}
