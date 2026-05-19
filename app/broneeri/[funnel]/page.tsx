import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BOOKING_FUNNELS, getBookingFunnel, type BookingFunnel } from "@/lib/booking-funnels";
import BookingForm from "@/components/BookingForm";
import BlogNav from "@/components/BlogNav";
import BlogFooter from "@/components/BlogFooter";

interface PageProps {
  params: Promise<{ funnel: string }>;
}

export function generateStaticParams(): { funnel: BookingFunnel }[] {
  return Object.keys(BOOKING_FUNNELS).map((f) => ({ funnel: f as BookingFunnel }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { funnel } = await params;
  const cfg = getBookingFunnel(funnel);
  if (!cfg) return {};
  return {
    title: `${cfg.headline} — KSA Silmakeskus`,
    description: cfg.sub,
    alternates: { canonical: `https://blog.ksa.ee/broneeri/${cfg.slug}` },
    robots: { index: false, follow: true },
  };
}

export default async function BroneeriPage({ params }: PageProps) {
  const { funnel } = await params;
  const cfg = getBookingFunnel(funnel);
  if (!cfg) notFound();

  return (
    <>
      <BlogNav lang="et" />
      <main className="flex-1" style={{ background: "#fff" }}>
        <section style={{ padding: "56px 0 32px", borderBottom: "1px solid #e6e6e6" }}>
          <div className="mx-auto" style={{ maxWidth: 720, padding: "0 24px" }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                fontWeight: 600,
                color: cfg.accent,
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              {cfg.eyebrow}
            </div>
            <h1
              style={{
                fontSize: "clamp(32px, 4.5vw, 48px)",
                lineHeight: 1.08,
                letterSpacing: "-0.03em",
                fontWeight: 400,
                margin: "0 0 18px",
              }}
            >
              {cfg.headline}
            </h1>
            <p style={{ fontSize: 17, color: "#5a6b6c", lineHeight: 1.55, margin: "0 0 28px", maxWidth: 600 }}>
              {cfg.sub}
            </p>

            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", paddingTop: 8, fontSize: 14 }}>
              <Stat label="Hind" value={cfg.priceLabel} strike={cfg.priceStrike} />
              <Stat label="Kestus" value={cfg.durationLabel} />
              <Stat label="Asukoht" value="Tallinn · Tartu" />
            </div>
          </div>
        </section>

        <section style={{ padding: "40px 0 72px" }}>
          <div className="mx-auto" style={{ maxWidth: 600, padding: "0 24px" }}>
            <BookingForm funnel={cfg} />

            <div style={{ marginTop: 28, fontSize: 13, color: "#9a9a9a", lineHeight: 1.6, textAlign: "center" }}>
              See on ajutine broneerimisvorm. Vastame 1 tööpäeva jooksul.<br />
              Kiire ühenduse korral helista <a href="tel:+3726616868" style={{ color: "#5a6b6c" }}>661 6868</a> või
              kirjuta <a href="mailto:info@ksa.ee" style={{ color: "#5a6b6c" }}>info@ksa.ee</a>.
            </div>
          </div>
        </section>
      </main>
      <BlogFooter lang="et" />
    </>
  );
}

function Stat({ label, value, strike }: { label: string; value: string; strike?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "#9a9a9a", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 500, color: "#1a1a1a" }}>
        {value}
        {strike && (
          <span style={{ fontSize: 14, color: "#9a9a9a", textDecoration: "line-through", marginLeft: 8, fontWeight: 400 }}>
            {strike}
          </span>
        )}
      </div>
    </div>
  );
}
