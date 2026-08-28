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
const LANG_LABEL: Record<string, string> = {
  et: "Vali keel",
  en: "Choose language",
  ru: "Выбрать язык",
};
const NAV_LANGS = ["et", "en", "ru"] as const;

export default function BlogNav({ lang = "et" }: { lang?: string }) {
  const blogLabel = BLOG_LABEL[lang] ?? BLOG_LABEL.et;
  const back = BACK_LABEL[lang] ?? BACK_LABEL.et;
  const homeHref = lang === "et" ? "/" : `/?keel=${lang}`;
  const langLabel = LANG_LABEL[lang] ?? LANG_LABEL.et;

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
          {/* Language switcher. Previously it lived only in the homepage body,
              so article pages offered no way to change language at all.
              Collapsed to the current language to stay compact in the header.
              Uses <details> so it needs no client JS on an otherwise static nav.
              Blog languages are independent article sets (not translations —
              see CLAUDE.md), so each entry goes to that language's index. */}
          <details className="blog-lang relative">
            <summary
              aria-label={langLabel}
              className="flex cursor-pointer list-none items-center gap-1 transition-colors hover:text-black"
              style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-60)" }}
            >
              {lang.toUpperCase()}
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div
              className="absolute right-0"
              style={{
                top: "calc(100% + 6px)",
                minWidth: 88,
                background: "#fff",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: 4,
                boxShadow: "0 14px 34px rgba(0,0,0,0.14)",
              }}
            >
              {NAV_LANGS.map((code) => {
                const active = code === lang;
                return (
                  <Link
                    key={code}
                    href={code === "et" ? "/" : `/?keel=${code}`}
                    aria-current={active ? "true" : undefined}
                    className="block transition-colors"
                    style={{
                      padding: "9px 12px",
                      borderRadius: 9,
                      fontSize: 13,
                      fontWeight: active ? 500 : 400,
                      background: active ? "var(--ink-05)" : "transparent",
                      color: active ? "var(--ink)" : "var(--ink-60)",
                    }}
                  >
                    {code.toUpperCase()}
                  </Link>
                );
              })}
            </div>
          </details>

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
