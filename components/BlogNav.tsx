import Link from "next/link";

const CTA: Record<string, { label: string; href: string }> = {
  et: { label: "Broneeri", href: "https://ksa.ee/broneeri?source=blog" },
  en: { label: "Book",     href: "https://ksa.ee/en.html" },
  ru: { label: "Записаться", href: "https://ksa.ee/ru.html" },
};

const BLOG_LABEL: Record<string, string> = { et: "Blogi", en: "Blog", ru: "Блог" };
const BACK_LABEL: Record<string, string> = { et: "ksa.ee", en: "ksa.ee", ru: "ksa.ee" };

function KsaMark({ size = 28, color = "#5A8518" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="17" stroke={color} strokeWidth="2.2" />
      <circle cx="20" cy="20" r="6.5" fill={color} />
      <circle cx="23" cy="17" r="2" fill="#fff" />
    </svg>
  );
}

export default function BlogNav({ lang = "et" }: { lang?: string }) {
  const cta = CTA[lang] ?? CTA.et;
  const blogLabel = BLOG_LABEL[lang] ?? BLOG_LABEL.et;
  const back = BACK_LABEL[lang] ?? BACK_LABEL.et;
  const homeHref = lang === "et" ? "/" : `/?keel=${lang}`;

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderColor: "var(--line)",
      }}
    >
      <div
        className="mx-auto flex items-center justify-between"
        style={{ maxWidth: "var(--container)", height: 72, padding: "0 40px" }}
      >
        <div className="flex items-center gap-5">
          <Link
            href="https://ksa.ee"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-black"
            style={{ fontSize: 13, color: "var(--ink-40)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {back}
          </Link>

          <Link href={homeHref} className="flex items-center gap-2.5" style={{ color: "#5A8518" }}>
            <KsaMark size={28} />
            <span style={{ fontWeight: 600, fontSize: 19, letterSpacing: "-0.02em" }}>ksa</span>
            <span
              style={{
                fontWeight: 400,
                fontSize: 14,
                color: "var(--ink-40)",
                marginLeft: 4,
                paddingLeft: 10,
                borderLeft: "1px solid var(--ink-10)",
              }}
            >
              {blogLabel}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-5">
          <Link
            href={`/otsing?lang=${lang}`}
            aria-label="Otsi"
            className="inline-flex items-center justify-center rounded-full transition-colors hover:bg-[color:var(--ink-05)]"
            style={{ width: 36, height: 36, color: "var(--ink-60)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </Link>

          <Link
            href={cta.href}
            className="inline-flex items-center gap-2 transition-colors"
            style={{
              background: "var(--lime)",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: "-0.005em",
              whiteSpace: "nowrap",
            }}
          >
            {cta.label}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </nav>
  );
}
