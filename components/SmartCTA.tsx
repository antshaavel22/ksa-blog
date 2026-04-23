"use client";

import { useEffect, useRef } from "react";
import type { Funnel } from "@/lib/posts";
import { sendEvent, buildCtaUrl } from "@/lib/analytics";
import { RAW_CONFIG, resolveCtaEntry, normalizeLang, type CtaEntry } from "@/lib/cta-config";

interface SmartCTAProps {
  funnel?: Funnel;
  slug: string;
  lang?: string;
  /** Optional inline config (used by admin live preview). Defaults to bundled RAW_CONFIG. */
  configOverride?: Record<Funnel, CtaEntry>;
}

export default function SmartCTA({ funnel = "flow3", slug, lang, configOverride }: SmartCTAProps) {
  const source = configOverride ?? RAW_CONFIG;
  const raw = source[funnel] ?? source.general;
  const c = resolveCtaEntry(raw, normalizeLang(lang));
  const ref = useRef<HTMLElement | null>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (!c?.live || !ref.current || viewed.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !viewed.current) {
            viewed.current = true;
            sendEvent("cta_view", { slug, funnel, lang }, { variant: c.ladder ? "ladder" : "single" });
            io.disconnect();
          }
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [c, slug, funnel, lang]);

  if (!c?.live) return null;

  const darkText = funnel !== "kids" && funnel !== "dryeye";
  const campaign = c.campaign?.trim() || funnel;
  const primaryHref = buildCtaUrl(c.primaryHref, funnel, slug, campaign);
  const secondaryHref = c.secondaryHref ? buildCtaUrl(c.secondaryHref, funnel, slug, campaign) : "#";

  const handleClick = (target: string, href: string) => () => {
    sendEvent("cta_click", { slug, funnel, lang }, { target });
    try {
      const hostname = new URL(href, typeof window !== "undefined" ? window.location.href : "https://blog.ksa.ee").hostname;
      const currentHost = typeof window !== "undefined" ? window.location.hostname : "";
      if (hostname && hostname !== currentHost) {
        sendEvent("funnel_outbound", { slug, funnel, lang }, { destination: hostname });
      }
    } catch {}
  };

  const primaryTarget = c.ladder ? "flow3_web" : funnel;
  const secondaryTarget = c.ladder ? "kiirtest_fast" : `${funnel}_secondary`;

  return (
    <section
      ref={ref}
      style={{
        padding: "64px 0",
        background: "var(--ink)",
        color: "#fff",
        position: "relative",
        overflow: "hidden",
        margin: "56px 0 0",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: c.accent }} />
      <div className="mx-auto" style={{ maxWidth: "var(--container)", padding: "0 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 11, letterSpacing: "0.14em", color: c.accent, fontWeight: 600 }}>
            {c.eyebrow}
          </span>
          <span style={{ width: 40, height: 1, background: "rgba(255,255,255,.15)" }} />
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              color: "rgba(255,255,255,.4)",
              textTransform: "uppercase",
            }}
          >
            Soovitatud sulle
          </span>
        </div>

        <h3
          style={{
            fontSize: "clamp(30px, 4vw, 48px)",
            lineHeight: 1.08,
            letterSpacing: "-0.028em",
            fontWeight: 400,
            margin: "0 0 18px",
            maxWidth: 780,
          }}
        >
          {c.headline}
        </h3>
        <p style={{ fontSize: 17, opacity: 0.72, margin: "0 0 32px", maxWidth: 620, lineHeight: 1.6 }}>
          {c.sub}
        </p>

        <div
          style={{
            display: "flex",
            gap: 40,
            paddingBottom: 28,
            marginBottom: 28,
            borderBottom: "1px solid rgba(255,255,255,.1)",
            flexWrap: "wrap",
          }}
        >
          {c.stats.map(([v, l], i) => (
            <div key={i}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  color: c.accent,
                  fontFamily: "var(--font-serif-v2)",
                }}
              >
                {v}
              </div>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.5,
                  marginTop: 4,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {l}
              </div>
            </div>
          ))}
        </div>

        {c.ladder ? (
          <div className="cta-ladder" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <a
              href={primaryHref}
              onClick={handleClick(primaryTarget, primaryHref)}
              style={{
                display: "block",
                padding: "26px 28px",
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 16,
                textDecoration: "none",
                color: "#fff",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,.5)",
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                STANDARD · VEEBIS
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 30, fontWeight: 400, letterSpacing: "-0.02em" }}>Flow3 uuring</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 28, color: c.accent, fontFamily: "var(--font-serif-v2)" }}>39 €</span>
                {c.primaryStrike && (
                  <span style={{ fontSize: 14, textDecoration: "line-through", opacity: 0.4 }}>
                    {c.primaryStrike}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, opacity: 0.55, lineHeight: 1.5 }}>{c.primarySub}</div>
              <div
                style={{
                  marginTop: 16,
                  fontSize: 13,
                  color: c.accent,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 500,
                }}
              >
                Broneeri veebis
                <Arrow />
              </div>
            </a>

            <a
              href={secondaryHref}
              onClick={handleClick(secondaryTarget, secondaryHref)}
              style={{
                display: "block",
                padding: "26px 28px",
                background: c.accent,
                borderRadius: 16,
                textDecoration: "none",
                color: "var(--ink)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: "rgba(0,0,0,.6)",
                  fontWeight: 700,
                  background: "rgba(255,255,255,.3)",
                  padding: "4px 10px",
                  borderRadius: 999,
                }}
              >
                FAST-TRACK
              </div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: "rgba(0,0,0,.55)",
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                TÄNA · ONLINE
              </div>
              <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 6 }}>
                Kiirtest
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 28, fontFamily: "var(--font-serif-v2)", fontWeight: 500 }}>19 €</span>
                <span style={{ fontSize: 13, opacity: 0.55 }}>20 minutit</span>
              </div>
              <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>{c.secondarySub}</div>
              <div
                style={{
                  marginTop: 16,
                  fontSize: 13,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                kiirtest.ksa.ee
                <Arrow strokeWidth={2.2} />
              </div>
            </a>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a
                href={primaryHref}
                onClick={handleClick(primaryTarget, primaryHref)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "16px 28px",
                  fontSize: 15,
                  background: c.accent,
                  color: darkText ? "var(--ink)" : "#fff",
                  fontWeight: 600,
                  borderRadius: 999,
                  textDecoration: "none",
                }}
              >
                {c.primaryLabel}
                <Arrow />
              </a>
              {c.secondaryLabel && (
                <a
                  href={secondaryHref}
                  onClick={handleClick(secondaryTarget, secondaryHref)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "14px 24px",
                    fontSize: 14,
                    border: "1px solid rgba(255,255,255,.25)",
                    color: "#fff",
                    borderRadius: 999,
                    textDecoration: "none",
                  }}
                >
                  {c.secondaryLabel}
                </a>
              )}
            </div>
            {c.primarySub && (
              <div style={{ fontSize: 13, opacity: 0.5, marginTop: 14 }}>{c.primarySub}</div>
            )}
          </>
        )}
      </div>
      <style>{`@media (max-width: 720px) { .cta-ladder { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

function Arrow({ strokeWidth = 2 }: { strokeWidth?: number }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
