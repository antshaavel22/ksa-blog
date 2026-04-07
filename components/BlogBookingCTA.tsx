/**
 * Flow3FooterCTA — full-width, visually striking bottom-of-post CTA.
 * Replaces the old BookingCTA + ContactForm.
 * Links to language-specific kiirtest landing pages.
 */

const URLS: Record<string, string> = {
  et: "https://ksa-kiirtest.vercel.app/",
  ru: "https://ksa-kiirtest.vercel.app/ru.html",
  en: "https://ksa-kiirtest.vercel.app/en.html",
};

const COPY: Record<string, {
  eyebrow: string;
  headline: string;
  sub: string;
  duration: string;
  button: string;
  note: string;
}> = {
  et: {
    eyebrow: "Flow3 · KSA Silmakeskus",
    headline: "Kas prillid võiksid jääda minevikku?",
    sub: "Selgita välja, kas Flow3 laseroperatsioon sobib just Sinu silmadele — enne arsti juurde minekut. Kiirtest annab ausa vastuse 2 minutiga.",
    duration: "2 min · tasuta · ilma kohustuseta",
    button: "Tee kiirtest →",
    note: "55 000+ edukat operatsiooni. KSA Silmakeskus, Tallinn.",
  },
  ru: {
    eyebrow: "Flow3 · KSA Silmakeskus",
    headline: "А вдруг жизнь без очков — это реально?",
    sub: "Узнайте, подходит ли лазерная операция Flow3 именно вашим глазам — ещё до записи к врачу. Быстрый тест даст честный ответ за 2 минуты.",
    duration: "2 мин · бесплатно · без обязательств",
    button: "Пройти тест →",
    note: "55 000+ успешных операций. KSA Silmakeskus, Таллин.",
  },
  en: {
    eyebrow: "Flow3 · KSA Silmakeskus",
    headline: "What if glasses were a thing of the past?",
    sub: "Find out if Flow3 laser eye surgery could work for your eyes — before seeing a doctor. Our quick test gives you an honest answer in 2 minutes.",
    duration: "2 min · free · no commitment",
    button: "Take the test →",
    note: "55,000+ successful procedures. KSA Silmakeskus, Tallinn.",
  },
};

interface Props {
  lang?: string;
}

export default function BlogBookingCTA({ lang = "et" }: Props) {
  const c = COPY[lang] ?? COPY.et;
  const url = URLS[lang] ?? URLS.et;

  return (
    <section
      aria-label="Flow3 kiirtest"
      style={{
        margin: "3rem 0 0",
        borderRadius: "1.5rem",
        overflow: "hidden",
        background: "linear-gradient(135deg, #0f1f00 0%, #1a3600 50%, #0d2200 100%)",
        position: "relative",
      }}
    >
      {/* Decorative rings */}
      <div aria-hidden="true" style={{
        position: "absolute", top: "-60px", right: "-60px",
        width: 300, height: 300, borderRadius: "50%",
        border: "1px solid rgba(135,190,35,0.15)",
        pointerEvents: "none",
      }} />
      <div aria-hidden="true" style={{
        position: "absolute", top: "-20px", right: "-20px",
        width: 200, height: 200, borderRadius: "50%",
        border: "1px solid rgba(135,190,35,0.22)",
        pointerEvents: "none",
      }} />
      <div aria-hidden="true" style={{
        position: "absolute", bottom: "-80px", left: "-80px",
        width: 260, height: 260, borderRadius: "50%",
        border: "1px solid rgba(135,190,35,0.10)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", padding: "2.5rem 2rem 2.25rem", zIndex: 1 }}>
        {/* Eyebrow */}
        <p style={{
          fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "#87be23", margin: "0 0 1rem",
        }}>
          {c.eyebrow}
        </p>

        {/* Headline */}
        <h2 style={{
          fontSize: "clamp(1.4rem, 4vw, 2rem)",
          fontWeight: 800, lineHeight: 1.2,
          color: "#ffffff", margin: "0 0 0.85rem",
          letterSpacing: "-0.02em",
          maxWidth: "24ch",
        }}>
          {c.headline}
        </h2>

        {/* Sub */}
        <p style={{
          fontSize: "0.925rem", lineHeight: 1.65,
          color: "rgba(255,255,255,0.72)",
          margin: "0 0 1.75rem",
          maxWidth: "48ch",
        }}>
          {c.sub}
        </p>

        {/* CTA + duration */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem" }}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.45rem",
              padding: "0.85rem 1.75rem",
              borderRadius: "3rem",
              background: "#87be23",
              color: "#fff",
              fontWeight: 700, fontSize: "0.975rem",
              textDecoration: "none",
              letterSpacing: "-0.01em",
              boxShadow: "0 4px 20px rgba(135,190,35,0.40)",
            }}
          >
            {c.button}
          </a>

          <span style={{
            fontSize: "0.78rem", color: "rgba(255,255,255,0.45)",
            fontWeight: 500,
          }}>
            {c.duration}
          </span>
        </div>

        {/* Social proof */}
        <p style={{
          marginTop: "1.5rem",
          paddingTop: "1.25rem",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          fontSize: "0.75rem",
          color: "rgba(255,255,255,0.38)",
          letterSpacing: "0.01em",
          margin: "1.5rem 0 0",
        }}>
          {c.note}
        </p>
      </div>
    </section>
  );
}
