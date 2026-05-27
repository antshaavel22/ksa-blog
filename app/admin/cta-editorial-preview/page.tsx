/**
 * Preview page for the new editorial SmartCTA variant.
 * Renders all 5 funnels stacked so Ants + Keiju can see them side-by-side
 * against the silmatervis refraktiivkirurgia-juhend reference.
 *
 * URL: /admin/cta-editorial-preview?lang=et   (default)
 *      /admin/cta-editorial-preview?lang=ru
 *      /admin/cta-editorial-preview?lang=en
 *
 * After visual sign-off, we'll wire the form to a real email-send service
 * and roll out as the new SmartCTA default across all 1,051 articles.
 */

import SmartCTAEditorial from "@/components/SmartCTAEditorial";
import type { Funnel } from "@/lib/posts";

type SearchParams = Promise<{ lang?: string }>;

const FUNNELS: Funnel[] = ["flow3", "audit", "kids", "dryeye", "general"];

export default async function CtaEditorialPreviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const lang = sp.lang === "ru" || sp.lang === "en" ? sp.lang : "et";

  return (
    <main style={{ background: "#faf7f0", minHeight: "100vh", padding: "60px 0" }}>
      {/* Page intro */}
      <div style={{ maxWidth: 760, margin: "0 auto 40px", padding: "0 24px" }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#6f7f80",
            marginBottom: 8,
            fontWeight: 600,
          }}
        >
          Internal preview · CTA editorial variant
        </p>
        <h1
          style={{
            fontSize: 28,
            fontFamily: 'var(--font-serif-v2, "Fraunces", Georgia, serif)',
            color: "#1a1a1a",
            lineHeight: 1.2,
            marginBottom: 12,
            letterSpacing: "-0.012em",
          }}
        >
          New SmartCTA pattern — all 5 funnels in editorial style
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "#4a5a5b",
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          Each block below replaces the current dark-green pill-button SmartCTA
          at the end of blog articles. Pattern mirrors{" "}
          <a
            href="https://silmatervis.ksa.ee/refraktiivkirurgia-juhend"
            style={{ color: "#86bc25", textDecoration: "underline" }}
          >
            silmatervis.ksa.ee/refraktiivkirurgia-juhend
          </a>{" "}
          — black top border, tiny eyebrow, Fraunces serif headline, plain body,
          underline-only form, text-only button.
        </p>
        <p style={{ fontSize: 13, color: "#6f7f80", lineHeight: 1.5 }}>
          Language switcher:{" "}
          <a href="?lang=et" style={{ color: "#1a1a1a", textDecoration: "underline" }}>
            ET
          </a>{" "}
          ·{" "}
          <a href="?lang=ru" style={{ color: "#1a1a1a", textDecoration: "underline" }}>
            RU
          </a>{" "}
          ·{" "}
          <a href="?lang=en" style={{ color: "#1a1a1a", textDecoration: "underline" }}>
            EN
          </a>
          {"  ·  "}Current: <strong>{lang.toUpperCase()}</strong>
        </p>
      </div>

      {/* All 5 funnels stacked */}
      {FUNNELS.map((funnel) => (
        <div key={funnel} style={{ borderTop: "1px dashed #d8d0c0", marginTop: 32 }}>
          <div
            style={{
              maxWidth: 760,
              margin: "0 auto",
              padding: "24px 24px 0",
              fontSize: 11,
              color: "#92a0a1",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Funnel: <strong style={{ color: "#1a1a1a" }}>{funnel}</strong>
          </div>
          <SmartCTAEditorial
            funnel={funnel}
            slug={`preview-${funnel}`}
            lang={lang}
          />
        </div>
      ))}

      {/* Footer note */}
      <div
        style={{
          maxWidth: 760,
          margin: "60px auto 0",
          padding: "30px 24px 40px",
          borderTop: "1px dashed #d8d0c0",
          fontSize: 13,
          color: "#6f7f80",
          lineHeight: 1.6,
        }}
      >
        <strong>Notes:</strong> Form submission is a stub (POSTs to
        /api/cta-editorial-send which doesn't exist yet). After Ants approves
        the visual, we wire the form to a real email-send service that emails
        the booking link + promo code to the address provided. Each funnel
        keeps its existing discount logic (BLOG39, BLOG139, BLOGKIDS, BLOGDRY,
        FLOW19) — they just arrive in the user's inbox instead of being
        clicked directly from the article.
      </div>
    </main>
  );
}
