import type { Metadata } from "next";
import { Geist, Fraunces } from "next/font/google";
import "./globals.css";
import Analytics from "@/components/Analytics";
import CookieBanner from "@/components/CookieBanner";

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
  metadataBase: new URL("https://blog.ksa.ee"),
  openGraph: {
    siteName: "KSA Silmakeskus",
    locale: "et_EE",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="et" className={`${geist.variable} ${fraunces.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <CookieBanner />
        <Analytics />
      </body>
    </html>
  );
}
