/**
 * Blog CTA pricing — one source, switched by date.
 *
 * Why this file exists: the kids exam was priced 79 € in data/cta-config.json
 * and 69 € in SmartCTAEditorial at the same time, while the real price was
 * neither. Prices were living in three places in three languages, so they
 * drifted. Anything price-bearing now comes from here.
 *
 * The 12.10.2026 price list (Ants, deck "Uus hinnakiri 12.10.2026"):
 *   · Flow3 exam and Audit become ONE exam — 149 € for adults, 89 € for
 *     children 2,5–17. The booking form no longer asks which one you want;
 *     the exam decides what suits you.
 *   · The exam fee comes off the procedure price in full, within 60 days.
 *   · Through the kiirtest a qualified myope 18–45 pays 49 € up front and
 *     still gets the whole 149 € off the procedure. That hundred euros is
 *     the reason to act today, and it exists ONLY through the kiirtest.
 *
 * Which is why, from 12.10, the blog stops quoting a booking price and sends
 * people to the kiirtest instead (Ants, "option A", 23.09). One story: the
 * test decides your price. The blog previously sold "Flow3 uuring 39 €"
 * straight into booking, which from 12.10 would contradict the kiirtest on
 * the very next screen — and only 0.57% of blog visitors ever clicked it.
 *
 * NOTE the blog auto-deploys on push, so this cannot simply be edited on the
 * day. Both price sets ship together and the date flips them.
 */

/** Tallinn, because that is the day the reader is living in. */
export const NEW_PRICING_FROM = "2026-10-12";

function tallinnToday(): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tallinn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Evaluated per request on the server (posts are ISR, revalidate 120) and
 * once per load on the client — not inside a hook, so there is no flash of
 * the old price after hydration on the switchover day.
 */
export const NEW_PRICING_LIVE: boolean = tallinnToday() >= NEW_PRICING_FROM;

export type CtaFunnel = "flow3" | "audit" | "kids" | "dryeye" | "general";
export type CtaLang = "et" | "ru" | "en";

/** Only the fields that carry a price or a destination. Everything else in
 *  SmartCTAEditorial's COPY (callback labels, field names) is untouched. */
export type PricedCopy = {
  eyebrow?: string;
  headline?: string;
  body?: string;
  primaryButtonLabel?: string;
};

/**
 * From 12.10 the test is the entry point for flow3 / audit / general.
 * Children keep a direct booking link: a parent booking a school-age eye
 * test has nothing to qualify for. Dry eye is unchanged — the one-exam
 * merge covers Flow3 and Audit, and says nothing about dry-eye diagnostics.
 */
export const ROUTES_TO_KIIRTEST: readonly CtaFunnel[] = ["flow3", "audit", "general"];

export function ctaGoesToKiirtest(funnel: CtaFunnel): boolean {
  if (funnel === "general") return true; // already did, before and after
  return NEW_PRICING_LIVE && ROUTES_TO_KIIRTEST.includes(funnel);
}

/**
 * Copy that replaces the pre-12.10 wording. A funnel missing here keeps the
 * copy it already has (dryeye).
 *
 * RU is a draft: it goes to Jana before 12.10, like every RU page. Written
 * ё-free per her house rule.
 */
export const NEW_COPY: Record<CtaLang, Partial<Record<CtaFunnel, PricedCopy>>> = {
  et: {
    flow3: {
      headline: "Tahad teada, kas Flow3 sinu silmadele sobib?",
      body:
        "Kolm küsimust ja näed oma hinda. Sobivatele 49 € silmauuring — ja protseduuri hinnast läheb maha kogu 149 €, 60 päeva jooksul.",
      primaryButtonLabel: "Tee test · sobivatele 49 €",
    },
    audit: {
      eyebrow: "SILMAUURING",
      headline: "Vaata, milline uuring sinule sobib.",
      body:
        "Kolm küsimust ja näed oma hinda. Silmauuring 149 €, testi kaudu 139 €. Tasu läheb protseduuri hinnast maha 60 päeva jooksul.",
      primaryButtonLabel: "Tee test ja broneeri uuring",
    },
    kids: {
      headline: "Kontrolli lapse silmanägemine enne kooliminekut.",
      body:
        "Laste silmauuring 2,5–17a — 89 €. Sisaldab online kokkuvõtet ja arsti soovitusi.",
      primaryButtonLabel: "Broneeri lapse uuring — 89 €",
    },
    general: {
      body:
        "KSA kiirtest — kolm küsimust, kohene tulemus. Näed, kas ja milline uuring sinule sobib.",
      primaryButtonLabel: "Tee kiirtest · 0 €",
    },
  },
  ru: {
    flow3: {
      headline: "Хотите узнать, подходит ли Flow3 вашим глазам?",
      body:
        "Три вопроса — и вы увидите свою цену. Подходящим кандидатам обследование за 49 €, и вся сумма 149 € вычитается из стоимости процедуры в течение 60 дней.",
      primaryButtonLabel: "Пройти тест · подходящим 49 €",
    },
    audit: {
      eyebrow: "ОБСЛЕДОВАНИЕ ЗРЕНИЯ",
      headline: "Узнайте, какое обследование подходит именно вам.",
      body:
        "Три вопроса — и вы увидите свою цену. Обследование зрения 149 €, через тест 139 €. Сумма вычитается из стоимости процедуры в течение 60 дней.",
      primaryButtonLabel: "Пройти тест и записаться",
    },
    kids: {
      headline: "Проверьте зрение ребенка перед школой.",
      body:
        "Детское обследование 2,5–17 лет — 89 €. Включает онлайн-заключение и рекомендации врача.",
      primaryButtonLabel: "Записать ребенка — 89 €",
    },
    general: {
      body:
        "Быстрый тест KSA — три вопроса, результат сразу. Узнайте, какое обследование вам подходит.",
      primaryButtonLabel: "Пройти быстрый тест · 0 €",
    },
  },
  en: {
    flow3: {
      headline: "Want to know whether Flow3 suits your eyes?",
      body:
        "Three questions and you'll see your price. If you're suitable the exam is €49 — and the full €149 comes off the procedure, within 60 days.",
      primaryButtonLabel: "Take the test · €49 if suitable",
    },
    audit: {
      eyebrow: "EYE EXAM",
      headline: "See which exam fits you.",
      body:
        "Three questions and you'll see your price. Eye exam €149, or €139 through the test. The fee comes off the procedure price within 60 days.",
      primaryButtonLabel: "Take the test and book",
    },
    kids: {
      headline: "Check your child's eyesight before school starts.",
      body:
        "Children's eye exam, ages 2.5–17 — €89. Includes an online summary and the doctor's recommendations.",
      primaryButtonLabel: "Book your child's exam — €89",
    },
    general: {
      body:
        "KSA quick test — three questions, instant result. See which exam fits you.",
      primaryButtonLabel: "Take the quick test · €0",
    },
  },
};

/** Merge the dated copy over the existing block. Pre-12.10 this is a no-op. */
export function applyNewCopy<T extends PricedCopy>(
  base: T,
  lang: CtaLang,
  funnel: CtaFunnel,
): T {
  if (!NEW_PRICING_LIVE) return base;
  const over = NEW_COPY[lang]?.[funnel];
  return over ? { ...base, ...over } : base;
}
