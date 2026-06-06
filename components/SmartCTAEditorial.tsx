"use client";

/**
 * SmartCTAEditorial — non-pushy, magazine-style CTA matching the silmatervis
 * refraktiivkirurgia-juhend pattern. Reference sample only — does NOT replace
 * the production SmartCTA component (per Ants 2026-05-28: "do not change
 * blog design at all").
 *
 * Two-path hierarchy (Ants 2026-05-28):
 *   PRIMARY (ideal outcome — zero staff time):
 *     Direct text-button to booking.ksa.ee/?service=X&promokood=Y&lang=Z
 *     Promo code pre-fills discounted price at checkout.
 *
 *   SECONDARY (warm fallback — KAISA AI calls back within 15 min, 24/7):
 *     Small callback form: Eesnimi + telefon
 *     POST → /api/callback-request with funnel + lang context so KAISA
 *     knows the topic when she dials.
 *
 * Goal (Ants): "manage all leads within 15 minutes in some form"
 * — either they book themselves OR we call them back.
 *
 * Visible at: /admin/cta-editorial-preview?lang=et|ru|en (port 3002)
 */

import { useState, useEffect, useRef } from "react";
import type { Funnel } from "@/lib/posts";
import { RAW_CONFIG, resolveCtaEntry, normalizeLang, type CtaLang } from "@/lib/cta-config";
import { sendEvent } from "@/lib/analytics";
import { BLOG_PUBLIC_BASE_URL } from "@/lib/url";

interface EditorialCopy {
  eyebrow: string;
  headline: string;
  body: string;
  primaryButtonLabel: string;
  callbackPromptLabel: string;
  callbackHelpText: string;
  callbackButtonLabel: string;
  reassurance: string;
  nameLabel: string;
  namePlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
}

const COPY: Record<CtaLang, Record<Funnel, EditorialCopy>> = {
  et: {
    flow3: {
      eyebrow: "FLOW3 · VABANE PRILLIDEST",
      headline: "Tahad teada, kas Flow3 sinu silmadele sobib?",
      body: "Flow3 uuring kliinikus — 39 € (tavahind 69 €) kuni 31. mai 2026. 60 minutit, Tallinn või Tartu.",
      primaryButtonLabel: "Broneeri Flow3 uuring · 39 € sooduskoodiga",
      callbackPromptLabel: "Mul on veel küsimusi ja soovin, et helistate tagasi",
      callbackHelpText: "Jäta nimi + telefon",
      callbackButtonLabel: "Helistage mulle tagasi",
      reassurance: "Sinu andmeid ei jaga me kunagi kolmandate osapooltega.",
      nameLabel: "Eesnimi",
      namePlaceholder: "Sinu eesnimi",
      phoneLabel: "Telefon",
      phonePlaceholder: "+372 …",
    },
    audit: {
      eyebrow: "NÄGEMISE AUDIT · PÕHJALIK SILMAUURING",
      headline: "Saa täielik ülevaade oma silmade tervisest.",
      body: "Audit silmauuring — 139 € sooduskoodiga (tavahind 149 €). 60-minutiline uuring mõõdab üle 50 parameetri + kirjalik raport. Tallinn või Tartu.",
      primaryButtonLabel: "Broneeri Audit · 139 € sooduskoodiga",
      callbackPromptLabel: "Mul on veel küsimusi ja soovin, et helistate tagasi",
      callbackHelpText: "Jäta nimi + telefon",
      callbackButtonLabel: "Helistage mulle tagasi",
      reassurance: "Sinu andmeid ei jaga me kunagi kolmandate osapooltega.",
      nameLabel: "Eesnimi",
      namePlaceholder: "Sinu eesnimi",
      phoneLabel: "Telefon",
      phonePlaceholder: "+372 …",
    },
    kids: {
      eyebrow: "LASTE SILMAUURING",
      headline: "Kontrolli lapse silmanägemine enne kooliminekut.",
      body: "Laste silmauuring 4–17a — 69 € sooduskoodiga. Sisaldab online kokkuvõtet ja arsti soovitusi.",
      primaryButtonLabel: "Broneeri lapse uuring sooduskoodiga",
      callbackPromptLabel: "Mul on veel küsimusi ja soovin, et helistate tagasi",
      callbackHelpText: "Jäta nimi + telefon",
      callbackButtonLabel: "Helistage mulle tagasi",
      reassurance: "Sinu andmeid ei jaga me kunagi kolmandate osapooltega.",
      nameLabel: "Eesnimi",
      namePlaceholder: "Sinu eesnimi",
      phoneLabel: "Telefon",
      phonePlaceholder: "+372 …",
    },
    dryeye: {
      eyebrow: "KUIVASILMA KONSULTATSIOON + TERAAPIA",
      headline: "Põhjalik diagnoos ja efektiivne Rexon Eye teraapia.",
      body: "Kuiva silma teraapia — 89 € sooduskoodiga (tavahind 150 €). Esimene konsultatsioon sisaldab tasuta Rexon Eye -raviseanssi.",
      primaryButtonLabel: "Broneeri kuiva silma teraapia sooduskoodiga",
      callbackPromptLabel: "Mul on veel küsimusi ja soovin, et helistate tagasi",
      callbackHelpText: "Jäta nimi + telefon",
      callbackButtonLabel: "Helistage mulle tagasi",
      reassurance: "Sinu andmeid ei jaga me kunagi kolmandate osapooltega.",
      nameLabel: "Eesnimi",
      namePlaceholder: "Sinu eesnimi",
      phoneLabel: "Telefon",
      phonePlaceholder: "+372 …",
    },
    general: {
      eyebrow: "TEE KIIRTEST",
      headline: "Vaata, mida sinu silmad sulle räägivad.",
      body: "KSA kiirtest — 3 minutiga online. Tulemus näitab, kas oleks aeg silmaarstile minna.",
      primaryButtonLabel: "Online Flow3 kiirtest · 0 €",
      callbackPromptLabel: "Mul on veel küsimusi ja soovin, et helistate tagasi",
      callbackHelpText: "Jäta nimi + telefon",
      callbackButtonLabel: "Helistage mulle tagasi",
      reassurance: "Test on tasuta. Sinu andmeid ei jaga me kolmandate osapooltega.",
      nameLabel: "Eesnimi",
      namePlaceholder: "Sinu eesnimi",
      phoneLabel: "Telefon",
      phonePlaceholder: "+372 …",
    },
  },
  ru: {
    flow3: {
      eyebrow: "FLOW3 · СВОБОДА ОТ ОЧКОВ",
      headline: "Хотите узнать, подходит ли Flow3 вашим глазам?",
      body: "Обследование Flow3 в клинике — 39 € (вместо 69 €) до 31 мая 2026. 60 минут, Таллинн или Тарту.",
      primaryButtonLabel: "Записаться на Flow3 · промокод 39 €",
      callbackPromptLabel: "У меня ещё есть вопросы — перезвоните мне",
      callbackHelpText: "Оставьте имя и телефон",
      callbackButtonLabel: "Перезвоните мне",
      reassurance: "Мы не передаём ваши данные третьим лицам.",
      nameLabel: "Имя",
      namePlaceholder: "Ваше имя",
      phoneLabel: "Телефон",
      phonePlaceholder: "+372 …",
    },
    audit: {
      eyebrow: "АУДИТ ЗРЕНИЯ · ПОЛНОЕ ОБСЛЕДОВАНИЕ",
      headline: "Получите полный обзор здоровья ваших глаз.",
      body: "Аудит зрения — 139 € по промокоду (вместо 149 €). 60-минутное обследование с измерением 50+ параметров + письменный отчёт. Таллинн или Тарту.",
      primaryButtonLabel: "Записаться на Аудит · 139 €",
      callbackPromptLabel: "У меня ещё есть вопросы — перезвоните мне",
      callbackHelpText: "Оставьте имя и телефон",
      callbackButtonLabel: "Перезвоните мне",
      reassurance: "Мы не передаём ваши данные третьим лицам.",
      nameLabel: "Имя",
      namePlaceholder: "Ваше имя",
      phoneLabel: "Телефон",
      phonePlaceholder: "+372 …",
    },
    kids: {
      eyebrow: "ОСМОТР ЗРЕНИЯ У ДЕТЕЙ",
      headline: "Проверьте зрение ребёнка перед школой.",
      body: "Детский осмотр 4–17 лет — 69 € по промокоду. Включает онлайн-заключение и рекомендации врача.",
      primaryButtonLabel: "Записать ребёнка по промокоду",
      callbackPromptLabel: "У меня ещё есть вопросы — перезвоните мне",
      callbackHelpText: "Оставьте имя и телефон",
      callbackButtonLabel: "Перезвоните мне",
      reassurance: "Мы не передаём ваши данные третьим лицам.",
      nameLabel: "Имя",
      namePlaceholder: "Ваше имя",
      phoneLabel: "Телефон",
      phonePlaceholder: "+372 …",
    },
    dryeye: {
      eyebrow: "КОНСУЛЬТАЦИЯ ПО СУХОМУ ГЛАЗУ + ТЕРАПИЯ",
      headline: "Тщательная диагностика и эффективная терапия Rexon Eye.",
      body: "Терапия сухого глаза — 89 € по промокоду (вместо 150 €). Первая консультация включает бесплатный сеанс Rexon Eye.",
      primaryButtonLabel: "Записаться на терапию по промокоду",
      callbackPromptLabel: "У меня ещё есть вопросы — перезвоните мне",
      callbackHelpText: "Оставьте имя и телефон",
      callbackButtonLabel: "Перезвоните мне",
      reassurance: "Мы не передаём ваши данные третьим лицам.",
      nameLabel: "Имя",
      namePlaceholder: "Ваше имя",
      phoneLabel: "Телефон",
      phonePlaceholder: "+372 …",
    },
    general: {
      eyebrow: "БЫСТРЫЙ ТЕСТ",
      headline: "Узнайте, что говорят вам ваши глаза.",
      body: "Быстрый тест KSA — 3 минуты онлайн. Результат покажет, не пора ли посетить офтальмолога.",
      primaryButtonLabel: "Онлайн быстрый тест Flow3 · 0 €",
      callbackPromptLabel: "У меня ещё есть вопросы — перезвоните мне",
      callbackHelpText: "Оставьте имя и телефон",
      callbackButtonLabel: "Перезвоните мне",
      reassurance: "Тест бесплатный. Мы не передаём ваши данные третьим лицам.",
      nameLabel: "Имя",
      namePlaceholder: "Ваше имя",
      phoneLabel: "Телефон",
      phonePlaceholder: "+372 …",
    },
  },
  en: {
    flow3: {
      eyebrow: "FLOW3 · FREEDOM FROM GLASSES",
      headline: "Want to know if Flow3 is right for your eyes?",
      body: "Flow3 exam at the clinic — €39 (regular €69) until 31 May 2026. 60 minutes, Tallinn or Tartu.",
      primaryButtonLabel: "Book Flow3 exam · €39 with promo",
      callbackPromptLabel: "I have more questions — please call me back",
      callbackHelpText: "Leave your name and phone",
      callbackButtonLabel: "Call me back",
      reassurance: "We never share your data with third parties.",
      nameLabel: "First name",
      namePlaceholder: "Your first name",
      phoneLabel: "Phone",
      phonePlaceholder: "+372 …",
    },
    audit: {
      eyebrow: "VISION AUDIT · FULL EYE EXAM",
      headline: "Get a complete overview of your eye health.",
      body: "Audit exam — €139 with promo (regular €149). 60-minute exam measures 50+ parameters + written report. Tallinn or Tartu.",
      primaryButtonLabel: "Book Audit · €139 with promo",
      callbackPromptLabel: "I have more questions — please call me back",
      callbackHelpText: "Leave your name and phone",
      callbackButtonLabel: "Call me back",
      reassurance: "We never share your data with third parties.",
      nameLabel: "First name",
      namePlaceholder: "Your first name",
      phoneLabel: "Phone",
      phonePlaceholder: "+372 …",
    },
    kids: {
      eyebrow: "CHILD VISION EXAM",
      headline: "Check your child's vision before school.",
      body: "Child exam 4–17 — €69 with promo. Includes online summary and doctor's recommendations.",
      primaryButtonLabel: "Book child exam with promo",
      callbackPromptLabel: "I have more questions — please call me back",
      callbackHelpText: "Leave your name and phone",
      callbackButtonLabel: "Call me back",
      reassurance: "We never share your data with third parties.",
      nameLabel: "First name",
      namePlaceholder: "Your first name",
      phoneLabel: "Phone",
      phonePlaceholder: "+372 …",
    },
    dryeye: {
      eyebrow: "DRY EYE CONSULTATION + THERAPY",
      headline: "Thorough diagnosis and effective Rexon Eye therapy.",
      body: "Dry eye therapy — €89 with promo (regular €150). First consultation includes a complimentary Rexon Eye session.",
      primaryButtonLabel: "Book dry-eye therapy with promo",
      callbackPromptLabel: "I have more questions — please call me back",
      callbackHelpText: "Leave your name and phone",
      callbackButtonLabel: "Call me back",
      reassurance: "We never share your data with third parties.",
      nameLabel: "First name",
      namePlaceholder: "Your first name",
      phoneLabel: "Phone",
      phonePlaceholder: "+372 …",
    },
    general: {
      eyebrow: "QUICK TEST",
      headline: "See what your eyes are telling you.",
      body: "KSA Quick Test — 3 minutes online. The result shows whether it's time to see an eye doctor.",
      primaryButtonLabel: "Online Flow3 quick test · €0",
      callbackPromptLabel: "I have more questions — please call me back",
      callbackHelpText: "Leave your name and phone",
      callbackButtonLabel: "Call me back",
      reassurance: "The test is free. We never share your data with third parties.",
      nameLabel: "First name",
      namePlaceholder: "Your first name",
      phoneLabel: "Phone",
      phonePlaceholder: "+372 …",
    },
  },
};

/**
 * booking.ksa.ee URL for each funnel — Mai confirmed scheme 2026-05-27:
 *   booking.ksa.ee/?service={slug}&lang={et|ru|en}&promokood={code}
 *
 * Service slugs and promo codes locked to cta-config.json defaults.
 * `general` funnel routes to kiirtest (it's a qualifier test, not a booking).
 */
function buildPrimaryUrl(funnel: Funnel, lang: CtaLang, slug: string): string {
  if (funnel === "general") {
    return `https://kiirtest.ksa.ee/${lang === "et" ? "" : lang}?source=blog&funnel=qualifier`;
  }
  const slugMap: Record<Exclude<Funnel, "general">, string> = {
    flow3: "flow3",
    audit: "audit",
    kids: "kids",
    dryeye: "dryeye",
  };
  const codeMap: Record<Exclude<Funnel, "general">, string> = {
    flow3: "BLOG39",
    audit: "BLOG139",
    kids: "BLOGKIDS",
    dryeye: "BLOGDRY",
  };
  const service = slugMap[funnel];
  const promo = codeMap[funnel];
  const params = new URLSearchParams({
    service,
    lang,
    promokood: promo,
    source: "blog",
    utm_source: "blog",
    utm_medium: "cta",
    utm_campaign: `${service}-${lang}`,
    utm_content: slug,
  });
  return `https://booking.ksa.ee/?${params.toString()}`;
}

interface Props {
  funnel?: Funnel;
  slug: string;
  lang?: string;
}

export default function SmartCTAEditorial({ funnel = "flow3", slug, lang }: Props) {
  const normalizedLang = normalizeLang(lang);
  const raw = RAW_CONFIG[funnel] ?? RAW_CONFIG.general;
  const c = resolveCtaEntry(raw, normalizedLang);
  const copy = COPY[normalizedLang][funnel];
  const primaryUrl = buildPrimaryUrl(funnel, normalizedLang, slug);

  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [callbackOpen, setCallbackOpen] = useState(false);

  // Analytics: fire cta_view once when the CTA scrolls 50%+ into view.
  // Matches the old SmartCTA's behaviour so the dashboard time-series stays
  // comparable across the 2026-05-28 switch.
  const sectionRef = useRef<HTMLElement | null>(null);
  const viewed = useRef(false);
  useEffect(() => {
    if (!sectionRef.current || viewed.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !viewed.current) {
            viewed.current = true;
            sendEvent("cta_view", { slug, funnel, lang }, { variant: "editorial" });
            io.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );
    io.observe(sectionRef.current);
    return () => io.disconnect();
  }, [slug, funnel, lang]);

  function onPrimaryClick() {
    sendEvent("cta_click", { slug, funnel, lang }, { target: funnel, path: "primary" });
    try {
      const hostname = new URL(
        primaryUrl,
        typeof window !== "undefined" ? window.location.href : BLOG_PUBLIC_BASE_URL,
      ).hostname;
      const currentHost = typeof window !== "undefined" ? window.location.hostname : "";
      if (hostname && hostname !== currentHost) {
        sendEvent("funnel_outbound", { slug, funnel, lang }, { destination: hostname });
      }
    } catch {}
  }

  function onCallbackOpen() {
    sendEvent("cta_click", { slug, funnel, lang }, { target: "callback", path: "secondary" });
    setCallbackOpen(true);
  }

  if (!c?.live) return null;

  const canSubmit =
    firstName.trim().length > 0 &&
    phone.replace(/\D/g, "").length >= 7 &&
    !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    // POST stub — wires to KAISA callback queue when she goes live (~2 weeks
    // from 2026-05-28). Until then, lands in CRM ticket queue for manual
    // dial-back within 15 minutes (Ants's 15-min response target).
    try {
      await fetch("/api/callback-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funnel,
          slug,
          lang: normalizedLang,
          firstName: firstName.trim(),
          phone: phone.trim(),
        }),
      }).catch(() => null);
    } finally {
      setSubmitting(false);
      setDone(true);
      sendEvent("funnel_outbound", { slug, funnel, lang }, { destination: "callback_submitted" });
    }
  }

  return (
    <section ref={sectionRef} id="smart-cta-editorial" className="px-6 pb-16 md:pb-20 mt-16">
      <div className="max-w-[560px] mx-auto">
        <div className="border-t-2 border-[#1a1a1a] pt-10">
          <p className="text-[10.5px] uppercase tracking-[0.25em] text-[#6f7f80] mb-3 font-semibold">
            {copy.eyebrow}
          </p>
          <h2
            className="font-serif text-[28px] md:text-[34px] text-[#1a1a1a] leading-snug mb-4"
            style={{
              letterSpacing: "-0.012em",
              fontFamily: 'var(--font-serif-v2, "Fraunces", Georgia, serif)',
            }}
          >
            {copy.headline}
          </h2>
          <p className="text-[16px] text-[#1a1a1a] leading-relaxed mb-8">{copy.body}</p>

          {/* PRIMARY PATH — direct booking. Ideal outcome: zero staff time. */}
          <div className="mb-10">
            <a
              href={primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onPrimaryClick}
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-semibold text-[#1a1a1a] border-b border-[#1a1a1a] pb-1 hover:opacity-60 transition"
            >
              {copy.primaryButtonLabel} →
            </a>
          </div>

          {/* SECONDARY PATH — callback. Warm fallback for hesitant readers.
              KAISA AI handles 24/7 once live (~2 weeks). */}
          {!callbackOpen && !done && (
            <button
              type="button"
              onClick={onCallbackOpen}
              className="text-[13.5px] text-[#4a5a5b] underline underline-offset-4 hover:text-[#1a1a1a] transition"
            >
              {copy.callbackPromptLabel} →
            </button>
          )}

          {callbackOpen && !done && (
            <div className="border-t border-[#e8e4dc] pt-8 mt-2">
              <p className="text-[14px] text-[#4a5a5b] leading-relaxed mb-6">
                {copy.callbackHelpText}
              </p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor={`cb-name-${funnel}`}
                    className="block text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[#1a1a1a] mb-1.5"
                  >
                    {copy.nameLabel}
                  </label>
                  <input
                    type="text"
                    id={`cb-name-${funnel}`}
                    name="name"
                    required
                    placeholder={copy.namePlaceholder}
                    className="w-full px-0 py-2 bg-transparent border-0 border-b border-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0 focus:outline-none text-[#1a1a1a] text-[16px]"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`cb-phone-${funnel}`}
                    className="block text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[#1a1a1a] mb-1.5"
                  >
                    {copy.phoneLabel}
                  </label>
                  <input
                    type="tel"
                    id={`cb-phone-${funnel}`}
                    name="phone"
                    required
                    placeholder={copy.phonePlaceholder}
                    className="w-full px-0 py-2 bg-transparent border-0 border-b border-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0 focus:outline-none text-[#1a1a1a] text-[16px]"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-semibold text-[#1a1a1a] border-b border-[#1a1a1a] pb-1 hover:opacity-60 disabled:opacity-30 transition"
                  >
                    {submitting ? "Saadan…" : copy.callbackButtonLabel} →
                  </button>
                </div>
                <p className="text-[12px] text-[#92a0a1] pt-2">{copy.reassurance}</p>
              </form>
            </div>
          )}

          {done && (
            <p className="text-[15px] text-[#1a1a1a] leading-relaxed border-l-2 border-[#86bc25] pl-4 py-2">
              ✓ Aitäh! Helistame Teile esimesel võimalusel tagasi.
            </p>
          )}

          {/* Reassurance line shown when callback collapsed (matches silmatervis pattern) */}
          {!callbackOpen && !done && (
            <p className="text-[12px] text-[#92a0a1] pt-6">{copy.reassurance}</p>
          )}
        </div>
      </div>
    </section>
  );
}
