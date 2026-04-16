import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Analytics from "@/components/Analytics";
import CookieBanner from "@/components/CookieBanner";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
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
    <html lang="et" className={`${geist.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <CookieBanner />
        <Analytics />
      </body>
    </html>
  );
}
