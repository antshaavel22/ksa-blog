"use client";

import type { Funnel } from "@/lib/posts";
import { buildCtaUrl, sendEvent } from "@/lib/analytics";
import { normalizeLang, type CtaLang } from "@/lib/cta-config";

type LinkItem = {
  label: Record<CtaLang, string>;
  href: string | Partial<Record<CtaLang, string>>;
  external?: boolean;
};

const HEADINGS: Record<CtaLang, { title: string; sub: string }> = {
  et: {
    title: "Seotud teekond",
    sub: "Kui see teema puudutab sind, on järgmised lehed tavaliselt kõige kasulikumad.",
  },
  ru: {
    title: "Связанный маршрут",
    sub: "Если эта тема вам близка, эти страницы обычно помогают сделать следующий шаг.",
  },
  en: {
    title: "Related path",
    sub: "If this topic feels relevant, these pages are usually the most useful next step.",
  },
};

// Routing policy (Silvia 2026-06-10 + Mai's guidance, 2026-06-11):
// all booking-intent links → booking.ksa.ee deep-links, EXCEPT dry-eye which
// goes to the kuivsilm/dryeye landing page (not a bookable wizard service).
// Internal /kategooria article links stay (blog navigation, not landing pages).
// Old pricelist / contact / homepage CTAs removed — they were dead-ends.
const BOOKING = (svc: string, code: string, f: string) => ({
  et: `https://booking.ksa.ee/?service=${svc}&lang=et&promokood=${code}&source=blog&funnel=${f}`,
  ru: `https://booking.ksa.ee/?service=${svc}&lang=ru&promokood=${code}&source=blog&funnel=${f}`,
  en: `https://booking.ksa.ee/?service=${svc}&lang=en&promokood=${code}&source=blog&funnel=${f}`,
});
const KIIRTEST = {
  et: "https://kiirtest.ksa.ee/?source=blog&funnel=qualifier",
  ru: "https://kiirtest.ksa.ee/ru?source=blog&funnel=qualifier",
  en: "https://kiirtest.ksa.ee/en?source=blog&funnel=qualifier",
};
const KIIRTEST_LABEL = { et: "Tee Kiirtest", ru: "Пройти быстрый тест", en: "Take the quick test" };
const ARTICLES_LABEL = { et: "Silmade tervise artiklid", ru: "Статьи о здоровье глаз", en: "Eye health articles" };

const LINKS: Record<Funnel, LinkItem[]> = {
  flow3: [
    {
      label: { et: "Broneeri Flow3 uuring", ru: "Записаться на Flow3", en: "Book a Flow3 exam" },
      href: BOOKING("flow3", "BLOG39", "flow3"),
      external: true,
    },
    {
      label: { et: "Flow3 artiklid", ru: "Статьи о Flow3", en: "Flow3 articles" },
      href: "/kategooria/flow-protseduur",
    },
    {
      label: KIIRTEST_LABEL,
      href: KIIRTEST,
      external: true,
    },
  ],
  audit: [
    {
      label: { et: "Broneeri Nägemise Audit", ru: "Записаться на Аудит зрения", en: "Book a Vision Audit" },
      href: BOOKING("audit", "BLOG139", "audit"),
      external: true,
    },
    {
      label: ARTICLES_LABEL,
      href: "/kategooria/silmad-ja-tervis",
    },
    {
      label: KIIRTEST_LABEL,
      href: KIIRTEST,
      external: true,
    },
  ],
  kids: [
    {
      label: { et: "Broneeri laste silmauuring", ru: "Записать ребёнка на обследование", en: "Book a children's eye exam" },
      href: BOOKING("kids", "BLOGKIDS", "kids"),
      external: true,
    },
    {
      label: ARTICLES_LABEL,
      href: "/kategooria/silmad-ja-tervis",
    },
    {
      label: KIIRTEST_LABEL,
      href: KIIRTEST,
      external: true,
    },
  ],
  dryeye: [
    {
      // Dry-eye is NOT a bookable wizard service — goes to the dedicated LP.
      label: { et: "Kuiva silma diagnostika ja teraapia", ru: "Диагностика сухого глаза", en: "Dry eye diagnostics" },
      href: {
        et: "https://kuivsilm.ksa.ee/?source=blog&funnel=dryeye",
        ru: "https://kuivsilm.ksa.ee/?lang=ru&source=blog&funnel=dryeye",
        en: "https://dryeye.ksa.ee/?source=blog&funnel=dryeye",
      },
      external: true,
    },
    {
      label: { et: "Kuiva silma teemad", ru: "Темы о сухости глаз", en: "Dry eye topics" },
      href: "/kategooria/silmad-ja-tervis",
    },
    {
      label: KIIRTEST_LABEL,
      href: KIIRTEST,
      external: true,
    },
  ],
  general: [
    {
      label: KIIRTEST_LABEL,
      href: KIIRTEST,
      external: true,
    },
    {
      label: ARTICLES_LABEL,
      href: "/kategooria/silmad-ja-tervis",
    },
    {
      label: { et: "Broneeri aeg", ru: "Записаться на приём", en: "Book an appointment" },
      href: {
        et: "https://booking.ksa.ee/?lang=et&source=blog&funnel=general",
        ru: "https://booking.ksa.ee/?lang=ru&source=blog&funnel=general",
        en: "https://booking.ksa.ee/?lang=en&source=blog&funnel=general",
      },
      external: true,
    },
  ],
};

interface RelatedPathLinksProps {
  funnel: Funnel;
  slug: string;
  lang?: string;
}

export default function RelatedPathLinks({ funnel, slug, lang }: RelatedPathLinksProps) {
  const normalizedLang = normalizeLang(lang);
  const heading = HEADINGS[normalizedLang];
  const links = LINKS[funnel] ?? LINKS.general;

  const handleClick = (label: string, href: string) => () => {
    sendEvent("related_path_click", { slug, funnel, lang }, { label, href });
  };

  return (
    <nav
      aria-label={heading.title}
      style={{
        marginTop: 48,
        padding: "22px 0",
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink-40)",
          fontWeight: 650,
          marginBottom: 8,
        }}
      >
        {heading.title}
      </div>
      <p style={{ margin: "0 0 14px", color: "var(--ink-60)", fontSize: 14, lineHeight: 1.55 }}>
        {heading.sub}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {links.map((item) => {
          const label = item.label[normalizedLang];
          const rawHref = typeof item.href === "string"
            ? item.href
            : item.href[normalizedLang] ?? item.href.et ?? "/";
          const href = item.external ? buildCtaUrl(rawHref, funnel, slug, funnel) : rawHref;
          return (
            <a
              key={href}
              href={href}
              onClick={handleClick(label, href)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 38,
                padding: "9px 13px",
                borderRadius: 999,
                border: "1px solid var(--line)",
                color: "var(--ink)",
                background: item.external ? "var(--lime-wash)" : "#fff",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
