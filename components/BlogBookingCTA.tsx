/**
 * BlogBookingCTA — soft, value-first booking strip for the bottom of every post.
 * No hype. No pressure. Just a clear next step for readers who are ready.
 */

const PROMO_CODE = "BLOG24";

const COPY: Record<string, {
  heading: string;
  body: string;
  promo: string;
  button: string;
  url: string;
  note: string;
}> = {
  et: {
    heading: "Kas laser sobib Sulle?",
    body: "60 sekundi silmatest annab vastuse. Tasuta, kohustuseta, kohe.",
    promo: `Blogilugejatele: maini koodi ${PROMO_CODE} ja saad tasuta silmauuringu (väärtus 35 €).`,
    button: "Broneeri aeg →",
    url: "https://ksa.ee/lp/broneeri-aeg-audit-silmauuring/",
    note: "Koht vabale ajale KSA Silmakeskuses Tallinnas.",
  },
  ru: {
    heading: "Подходит ли вам лазер?",
    body: "Пройдите быстрый тест за 60 секунд. Бесплатно, без обязательств.",
    promo: `Для читателей блога: назовите код ${PROMO_CODE} при записи — и получите бесплатный осмотр (стоимость 35 €).`,
    button: "Записаться →",
    url: "https://ksa.ee/lp/broneeri-aeg-audit-silmauuring/",
    note: "Клиника KSA Silmakeskus, Таллин.",
  },
  en: {
    heading: "Is laser right for you?",
    body: "A 60-second check gives you the answer. Free, no commitment.",
    promo: `Blog reader offer: mention code ${PROMO_CODE} when booking for a free vision audit (worth €35).`,
    button: "Book a time →",
    url: "https://ksa.ee/lp/broneeri-aeg-audit-silmauuring/",
    note: "KSA Silmakeskus, Tallinn.",
  },
};

interface Props {
  lang?: string;
}

export default function BlogBookingCTA({ lang = "et" }: Props) {
  const c = COPY[lang] ?? COPY.et;

  return (
    <div className="my-10 rounded-2xl border border-[#d4e8a8] bg-[#f4fae8] px-6 py-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#6a9a1a] mb-2">
        KSA Silmakeskus
      </p>
      <h3 className="text-lg font-semibold text-[#1a1a1a] mb-1">{c.heading}</h3>
      <p className="text-sm text-[#3a4a3a] mb-4">{c.body}</p>

      <a
        href={c.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-[#87be23] hover:bg-[#76a81f] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
      >
        {c.button}
      </a>

      <p className="mt-4 text-xs text-[#5a6b6c] border-t border-[#cce09a] pt-3">
        <span className="font-medium text-[#1a1a1a]">{c.promo}</span>
        <br />
        <span className="opacity-70">{c.note}</span>
      </p>
    </div>
  );
}
