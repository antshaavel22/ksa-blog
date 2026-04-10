import Link from "next/link";

const BLOG_HOME = "https://blog.ksa.ee";

const CTA: Record<string, { label: string; href: string }> = {
  et: { label: "Broneeri aeg", href: "https://ksa.ee/broneeri" },
  en: { label: "Book now",     href: "https://ksa.ee/en.html" },
  ru: { label: "Записаться",   href: "https://ksa.ee/ru.html" },
};

interface BlogNavProps {
  lang?: string;
}

export default function BlogNav({ lang = "et" }: BlogNavProps) {
  const cta = CTA[lang] ?? CTA.et;

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

        {/* Wordmark — always links to blog homepage */}
        <Link href={BLOG_HOME} className="flex items-center">
          <span className="text-[15px] font-semibold tracking-[-0.03em] text-[#000000]">KSA</span>
          <span className="text-[15px] font-semibold tracking-[-0.03em] text-[#87BE23]">&nbsp;Blog</span>
        </Link>

        {/* Primary CTA — language-aware */}
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
