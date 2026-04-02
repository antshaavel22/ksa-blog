"use client";

import { CtaType, PostLang } from "@/lib/posts";

interface KiirtestCTAProps {
  ctaType: CtaType;
  lang?: PostLang;
}

const KIIRTEST_URLS: Record<PostLang, string> = {
  et: "https://ksa-kiirtest-lp.vercel.app/",
  ru: "https://ksa-kiirtest-lp.vercel.app/ru.html",
  en: "https://ksa-kiirtest-lp.vercel.app/en.html",
};

const COPY: Record<PostLang, { headline: string; sub: string; soft: string; softSub: string }> = {
  et: {
    headline: "Kas laser sobib Sulle?",
    sub: "Vastake 5 küsimusele ja saate tasuta hinnangu oma nägemise kohta.",
    soft: "Huvitav, kas laser sobib Sulle?",
    softSub: "Tee tasuta kiirtest ja saa vastus 60 sekundiga.",
  },
  ru: {
    headline: "Подходит ли вам лазер?",
    sub: "Ответьте на 5 вопросов и получите бесплатную оценку вашего зрения.",
    soft: "Интересно, подойдёт ли вам лазер?",
    softSub: "Пройдите бесплатный тест и получите ответ за 60 секунд.",
  },
  en: {
    headline: "Is laser right for you?",
    sub: "Answer 5 questions and get a free assessment of your vision.",
    soft: "Curious if laser suits you?",
    softSub: "Take a free quick test and find out in 60 seconds.",
  },
};

export default function KiirtestCTA({ ctaType, lang = "et" }: KiirtestCTAProps) {
  if (ctaType === "none") return null;

  const url = KIIRTEST_URLS[lang];
  const copy = COPY[lang];

  if (ctaType === "kiirtest-soft") {
    return (
      <div className="my-8 p-6 bg-[#f9f9f7] border border-[#e6e6e6] rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <div>
          <p className="font-semibold text-[#1a1a1a] mb-1">{copy.soft}</p>
          <p className="text-sm text-[#5a6b6c]">{copy.softSub}</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-5 py-2.5 rounded-full bg-[#87be23] text-white text-sm font-medium hover:bg-[#74a31e] transition-colors whitespace-nowrap"
        >
          Tee kiirtest →
        </a>
      </div>
    );
  }

  // kiirtest-inline: prominent full-width CTA card
  return (
    <div className="my-10 rounded-2xl border-2 border-[#87be23] bg-gradient-to-br from-[#f9f9f7] to-white shadow-sm overflow-hidden">
      <div className="p-7 sm:p-8">
        <span className="inline-block text-xs font-semibold uppercase tracking-widest text-white bg-[#87be23] px-3 py-1 rounded-full mb-4">
          {lang === "ru" ? "Бесплатно · 60 секунд" : lang === "en" ? "Free · 60 seconds" : "Tasuta · 60 sekundit"}
        </span>
        <h3 className="text-2xl sm:text-3xl font-semibold text-[#1a1a1a] mb-2 leading-tight">
          {copy.headline}
        </h3>
        <p className="text-[#5a6b6c] mb-6 text-base leading-relaxed max-w-md">
          {copy.sub}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#87be23] text-white font-semibold text-base hover:bg-[#74a31e] active:scale-95 transition-all shadow-md hover:shadow-lg"
        >
          {lang === "ru" ? "Пройти тест" : lang === "en" ? "Take the test" : "Tee kiirtest"}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </a>
        <p className="mt-3 text-xs text-[#9a9a9a]">
          {lang === "ru" ? "Без обязательств — только честный ответ о вашем зрении." : lang === "en" ? "No commitment — just an honest answer about your vision." : "Ilma kohustuseta — aus vastus sinu nägemise kohta."}
        </p>
      </div>
    </div>
  );
}
