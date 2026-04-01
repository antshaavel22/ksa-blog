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

  // kiirtest-inline: prominent embed
  return (
    <div className="my-10 rounded-2xl overflow-hidden border border-[#e6e6e6] bg-white shadow-sm">
      <div className="p-6 pb-4 border-b border-[#e6e6e6]">
        <span className="text-xs font-medium uppercase tracking-wide text-[#87be23]">
          Tasuta kiirtest · 60 sekundit
        </span>
        <h3 className="text-xl font-semibold text-[#1a1a1a] mt-1 mb-1">
          {copy.headline}
        </h3>
        <p className="text-sm text-[#5a6b6c]">{copy.sub}</p>
      </div>
      <iframe
        src={url}
        className="w-full border-0"
        style={{ height: "580px" }}
        title="KSA Kiirtest"
        loading="lazy"
      />
    </div>
  );
}
