import ctaConfig from "@/data/cta-config.json";
import type { Funnel } from "@/lib/posts";

export type CtaLang = "et" | "ru" | "en";

export type CtaLangOverrides = {
  eyebrow?: string;
  headline?: string;
  sub?: string;
  stats?: [string, string][];
  primaryLabel?: string;
  primarySub?: string | null;
  secondaryLabel?: string | null;
  secondarySub?: string | null;
};

export type CtaEntry = {
  live: boolean;
  eyebrow: string;
  headline: string;
  sub: string;
  stats: [string, string][];
  primaryLabel: string;
  primaryStrike?: string | null;
  primarySub?: string | null;
  primaryHref: string;
  secondaryLabel?: string | null;
  secondarySub?: string | null;
  secondaryHref?: string | null;
  accent: string;
  ladder: boolean;
  campaign?: string | null;
  validUntil?: string | null;
  ru?: CtaLangOverrides;
  en?: CtaLangOverrides;
};

export type CtaConfig = Record<Funnel, CtaEntry>;

export const RAW_CONFIG = ctaConfig as unknown as CtaConfig;

/**
 * Resolve a CTA entry for a given language with ET fallback.
 * Lang-overridable fields: eyebrow, headline, sub, stats, primaryLabel, primarySub, secondaryLabel, secondarySub.
 * Shared fields (not overridable per lang): primaryHref, secondaryHref, accent, ladder, live, campaign, validUntil, primaryStrike.
 */
export function resolveCtaEntry(entry: CtaEntry, lang: CtaLang = "et"): CtaEntry {
  if (lang === "et") return entry;
  const overrides = lang === "ru" ? entry.ru : entry.en;
  if (!overrides) return entry;
  return {
    ...entry,
    eyebrow: overrides.eyebrow ?? entry.eyebrow,
    headline: overrides.headline ?? entry.headline,
    sub: overrides.sub ?? entry.sub,
    stats: overrides.stats ?? entry.stats,
    primaryLabel: overrides.primaryLabel ?? entry.primaryLabel,
    primarySub: overrides.primarySub ?? entry.primarySub,
    secondaryLabel: overrides.secondaryLabel ?? entry.secondaryLabel,
    secondarySub: overrides.secondarySub ?? entry.secondarySub,
  };
}

export function normalizeLang(raw: string | undefined): CtaLang {
  if (raw === "ru" || raw === "en") return raw;
  return "et";
}
