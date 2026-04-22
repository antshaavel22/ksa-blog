import Link from "next/link";
import Image from "next/image";

const CTA: Record<string, { label: string; href: string }> = {
  et: { label: "Broneeri aeg", href: "https://ksa.ee/broneeri" },
  en: { label: "Book now",     href: "https://ksa.ee/en.html" },
  ru: { label: "Записаться",   href: "https://ksa.ee/ru.html" },
};

const BLOG_LABEL: Record<string, string> = {
  et: "Blog",
  en: "Blog",
  ru: "Блог",
};

interface BlogNavProps {
  lang?: string;
}

export default function BlogNav({ lang = "et" }: BlogNavProps) {
  const cta = CTA[lang] ?? CTA.et;
  const blogLabel = BLOG_LABEL[lang] ?? BLOG_LABEL.et;
  const homeHref = lang === "et" ? "/" : `/?keel=${lang}`;

  return (
    <header className="border-b border-[#E6E4DF] bg-[#FEFEFE]/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-[1140px] mx-auto px-6 h-[60px] flex items-center justify-between gap-6">

        {/* Back to main site */}
        <Link
          href="https://ksa.ee"
          className="flex items-center gap-1.5 text-[13px] font-medium text-[#5A6B6C] hover:text-[#000000] transition-colors group"
        >
          <svg className="w-3 h-3 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          ksa.ee
        </Link>

        {/* Wordmark: ksa mark + thin divider + "Blog" */}
        <Link href={homeHref} className="flex items-center gap-2.5 group">
          {/* ksa lettermark only (no SILMAKESKUS) */}
          <Image
            src="/ksa-mark.svg"
            alt="KSA Silmakeskus"
            width={38}
            height={24}
            priority
            className="shrink-0"
          />
          {/* Vertical divider */}
          <span className="w-px h-[18px] bg-[#D8D5CE] shrink-0" aria-hidden="true" />
          {/* Blog label */}
          <span className="text-[13px] font-semibold tracking-[0.06em] text-[#5a6b6c] group-hover:text-[#87be23] transition-colors">
            {blogLabel}
          </span>
        </Link>

        {/* Search icon */}
        <Link
          href={`/otsing?lang=${lang}`}
          aria-label="Otsi"
          className="flex items-center justify-center w-9 h-9 rounded-full text-[#5A6B6C] hover:text-[#000000] hover:bg-[#F0EDE8] transition-colors"
        >
          <svg className="w-4.5 h-4.5" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="m21 21-4.35-4.35" />
          </svg>
        </Link>

        {/* Primary CTA */}
        <Link
          href={cta.href}
          className="text-[13px] font-semibold px-5 py-[9px] rounded-[32px] bg-[#87BE23] text-white hover:bg-[#74A31E] transition-all duration-150 shadow-[0_4px_16px_rgba(135,190,35,0.22)] hover:shadow-[0_6px_20px_rgba(135,190,35,0.32)] hover:-translate-y-px active:scale-[0.97] whitespace-nowrap"
        >
          {cta.label}
        </Link>

      </div>
    </header>
  );
}
