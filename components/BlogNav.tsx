import Link from "next/link";
import Image from "next/image";

// Sticky-Nav Broneeri CTA removed 2026-05-26 — blog already has 4 other CTA
// surfaces (SmartCTA at article end, ContextualInlineCTA in-body, footer
// Broneeri, RelatedPathLinks). A 5th sticky CTA up top made the blog feel
// pushy and undercut the editorial trust voice (rule #9 in CLAUDE.md).
// To re-add later, restore the CTA Record + the rendered <Link> in the JSX
// below and point href at booking.ksa.ee.

const BLOG_LABEL: Record<string, string> = { et: "Blogi", en: "Blog", ru: "Блог" };
const BACK_LABEL: Record<string, string> = { et: "ksa.ee", en: "ksa.ee", ru: "ksa.ee" };

export default function BlogNav({ lang = "et" }: { lang?: string }) {
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
        style={{ maxWidth: "var(--container)", height: 72, padding: "0 var(--gutter)" }}
      >
        <div className="flex items-center gap-5">
          <Link
            href="https://ksa.ee"
            className="hidden sm:inline-flex items-center gap-1.5 transition-colors hover:text-black"
            style={{ fontSize: 13, color: "var(--ink-40)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {back}
          </Link>

          <Link
            href={homeHref}
            className="flex items-center gap-3"
            aria-label="KSA Silmakeskus blogi"
          >
            <Image
              src="/ksa-mark.svg"
              alt="KSA Silmakeskus"
              width={64}
              height={40}
              priority
              style={{ height: 36, width: "auto" }}
            />
            <span
              style={{
                fontWeight: 400,
                fontSize: 14,
                color: "var(--ink-40)",
                paddingLeft: 12,
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
        </div>
      </div>
    </nav>
  );
}
