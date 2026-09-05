import type { Metadata } from "next";
import SiteAnalytics from "@/components/SiteAnalytics";
import { Geist, Fraunces } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import Analytics from "@/components/Analytics";
import ConsentBanner from "@/components/ConsentBanner";
import { getPostBySlug } from "@/lib/posts";
import { BLOG_PUBLIC_ORIGIN } from "@/lib/url";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | KSA Silmakeskus",
    default: "KSA Blogi — Silmade tervis, laserkorrektsiooni ja nägemise nipid",
  },
  description:
    "Hea nägemine on üks inimese supervõimetest. KSA Silmakeskuse blogi: üle 450 artikli silmade tervise, laserkorrektsiooni ja nägemise parandamise kohta.",
  metadataBase: new URL(BLOG_PUBLIC_ORIGIN),
  openGraph: {
    siteName: "KSA Silmakeskus",
    locale: "et_EE",
    type: "website",
  },
  alternates: {
    types: {
      "application/rss+xml": [
        { url: "/rss.xml", title: "KSA Silmakeskus Blogi — kõik keeled" },
        { url: "/rss/et.xml", title: "KSA Silmakeskus Blogi — eesti" },
        { url: "/rss/ru.xml", title: "Блог KSA Silmakeskus — русский" },
        { url: "/rss/en.xml", title: "KSA Silmakeskus Blog — English" },
      ],
    },
  },
};

async function detectLang(): Promise<"et" | "ru" | "en"> {
  try {
    const h = await headers();
    const pathname = h.get("x-pathname") ?? "/";
    const m = pathname.match(/^\/([^/]+)\/?$/);
    if (!m) return "et";
    const slug = m[1];
    if (slug === "admin" || slug === "api" || slug === "kategooria" || slug === "autor" || slug === "otsing") return "et";
    const post = getPostBySlug(slug);
    const lang = post?.lang;
    if (lang === "ru" || lang === "en") return lang;
  } catch {
    // fall through
  }
  return "et";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await detectLang();
  return (
    <html lang={lang} className={`${geist.variable} ${fraunces.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <ConsentBanner />
        <Analytics />
        {/* Vercel Web Analytics — cookieless, no personal data, GDPR-exempt,
            so it runs for ALL visitors (GA4 + blog_events stay consent-gated
            and undercount ~2×). Plain script tag instead of the npm component:
            Cookiebot auto-blocking strips dynamically injected scripts when
            statistics-consent is declined; data-cookieconsent="ignore" is the
            documented exemption for consent-free scripts. script.js tracks
            page views + SPA route changes on its own. */}
        <script
          defer
          src="/_vercel/insights/script.js"
          data-cookieconsent="ignore"
        />
        {/* First-party counting, shared with ksa.ee so blog traffic appears in
            the same dashboard. Cookieless — see ksa-web app/api/track. */}
        <SiteAnalytics />
      </body>
    </html>
  );
}
