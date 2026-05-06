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

const LINKS: Record<Funnel, LinkItem[]> = {
  flow3: [
    {
      label: { et: "Flow3 silmauuring", ru: "Исследование Flow3", en: "Flow3 exam" },
      href: {
        et: "https://ksa.ee/vabane-prillidest/flow3-silmauuring/?source=blog&funnel=flow3",
        ru: "https://ksa.ee/ru/flow-silmauuring/?source=blog&funnel=flow3",
        en: "https://ksa.ee/en/flow-examination/?source=blog&funnel=flow3",
      },
      external: true,
    },
    {
      label: { et: "Flow3 artiklid", ru: "Статьи о Flow3", en: "Flow3 articles" },
      href: "/kategooria/flow-protseduur",
    },
    {
      label: { et: "Hinnakiri", ru: "Цены", en: "Prices" },
      href: "https://ksa.ee/hinnakiri/?source=blog&funnel=flow3",
      external: true,
    },
  ],
  audit: [
    {
      label: { et: "Nägemise Audit", ru: "Аудит зрения", en: "Vision Audit" },
      href: "https://ksa.ee/lp/broneeri-aeg-audit-silmauuring/?source=blog&funnel=audit",
      external: true,
    },
    {
      label: { et: "Silmade tervise artiklid", ru: "Статьи о здоровье глаз", en: "Eye health articles" },
      href: "/kategooria/silmad-ja-tervis",
    },
    {
      label: { et: "KSA teenused", ru: "Услуги KSA", en: "KSA services" },
      href: "https://ksa.ee/?source=blog&funnel=audit",
      external: true,
    },
  ],
  kids: [
    {
      label: { et: "Laste nägemiskontroll", ru: "Проверка зрения у детей", en: "Children's vision exam" },
      href: "https://ksa.ee/nagemiskontroll-lastele/?source=blog&funnel=kids",
      external: true,
    },
    {
      label: { et: "Silmade tervise artiklid", ru: "Статьи о здоровье глаз", en: "Eye health articles" },
      href: "/kategooria/silmad-ja-tervis",
    },
    {
      label: { et: "Kontakt", ru: "Контакты", en: "Contact" },
      href: "https://ksa.ee/kontakt/?source=blog&funnel=kids",
      external: true,
    },
  ],
  dryeye: [
    {
      label: { et: "Kuiva silma diagnostika ja teraapia", ru: "Диагностика сухого глаза", en: "Dry eye diagnostics" },
      href: "https://ksa.ee/kuivasilma-diagnostika-ja-teraapia/?source=blog&funnel=dryeye",
      external: true,
    },
    {
      label: { et: "Kuiva silma teemad", ru: "Темы о сухости глаз", en: "Dry eye topics" },
      href: "/kategooria/silmad-ja-tervis",
    },
    {
      label: { et: "Hinnakiri", ru: "Цены", en: "Prices" },
      href: "https://ksa.ee/hinnakiri/?source=blog&funnel=dryeye",
      external: true,
    },
  ],
  general: [
    {
      label: { et: "Tee Kiirtest", ru: "Пройти быстрый тест", en: "Take the quick test" },
      href: "https://kiirtest.ksa.ee?source=blog&funnel=qualifier",
      external: true,
    },
    {
      label: { et: "Silmade tervise artiklid", ru: "Статьи о здоровье глаз", en: "Eye health articles" },
      href: "/kategooria/silmad-ja-tervis",
    },
    {
      label: { et: "KSA hinnakiri", ru: "Цены KSA", en: "KSA prices" },
      href: "https://ksa.ee/hinnakiri/?source=blog&funnel=general",
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
