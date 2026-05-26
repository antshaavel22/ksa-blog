// Temporary booking-form funnel config. Used by /broneeri/[funnel] until Mai's
// new booking system goes live; CTAs from cta-config.json point here in the
// meantime. After cutover, primaryHref swaps to my.ksa.ee/... and these pages
// can be deleted (or kept as fallback).

export type BookingFunnel = "audit" | "flow3" | "lapsed" | "kuivsilm";

export interface BookingFunnelConfig {
  slug: BookingFunnel;
  service: string;       // What appears in email subject / Slack
  eyebrow: string;       // Top label on page
  headline: string;
  sub: string;
  priceLabel: string;    // "139 €"
  priceStrike?: string;  // "149 €"
  durationLabel: string; // "60 min"
  promoCode: string;     // Prefilled in form
  promoCodeLabel: string; // "Sooduskood: BLOG139"
  accent: string;        // Brand colour
  showAgeCheck?: boolean; // Flow3 only: 18-45 confirm
}

export const BOOKING_FUNNELS: Record<BookingFunnel, BookingFunnelConfig> = {
  audit: {
    slug: "audit",
    service: "Nägemise Audit",
    eyebrow: "NÄGEMISE AUDIT",
    headline: "Broneeri Nägemise Audit",
    sub: "60-minutiline põhjalik silmauuring, mille käigus mõõdame 500+ parameetrit. Tagasi anname kirjaliku kokkuvõtte ja arsti soovitused.",
    priceLabel: "139 €",
    priceStrike: "149 €",
    durationLabel: "60 min",
    promoCode: "BLOG139",
    promoCodeLabel: "Sooduskood BLOG139 (tavahind 149 €)",
    accent: "#86BC25",
  },
  flow3: {
    slug: "flow3",
    service: "Flow3 silmauuring",
    eyebrow: "FLOW3 – VABANE PRILLIDEST",
    headline: "Broneeri Flow3 silmauuring",
    sub: "90-minutiline Flow3 sobivuse uuring lühinägelikele 18–45 aastastele. Pärast uuringut tead, kas Flow3 laser sobib sulle.",
    priceLabel: "39 €",
    priceStrike: "69 €",
    durationLabel: "90 min",
    promoCode: "BLOG39",
    promoCodeLabel: "Sooduskood BLOG39 (tavahind 69 €)",
    accent: "#86BC25",
    showAgeCheck: true,
  },
  lapsed: {
    slug: "lapsed",
    service: "Laste silmauuring",
    eyebrow: "LASTE SILMAUURING",
    headline: "Broneeri laste silmauuring",
    sub: "Põhjalik laste silmauuring alates 3. eluaastast. Sisaldab kooli vormi täitmist, online-kokkuvõtet ja silmaarsti soovitusi.",
    priceLabel: "79 €",
    durationLabel: "30 min",
    promoCode: "BLOGKIDS",
    promoCodeLabel: "Sooduskood BLOGKIDS",
    accent: "#D97757",
  },
  kuivsilm: {
    slug: "kuivsilm",
    service: "Kuiva silma uuring",
    eyebrow: "KUIVA SILMA UURING",
    headline: "Broneeri kuiva silma uuring",
    sub: "Sirius-diagnostika kuiva silma sündroomi tuvastamiseks. Hinnas sees ka tasuta OMR-raviseanss, mis leevendab kuivuse sümptomeid.",
    priceLabel: "89 €",
    durationLabel: "30 min",
    promoCode: "BLOGDRY",
    promoCodeLabel: "Sooduskood BLOGDRY · sisaldab tasuta OMR-raviseanssi",
    accent: "#5B9AC9",
  },
};

export function getBookingFunnel(slug: string): BookingFunnelConfig | null {
  return BOOKING_FUNNELS[slug as BookingFunnel] ?? null;
}

export const BOOKING_RECIPIENT = "registreerumised@ksa.ee";
