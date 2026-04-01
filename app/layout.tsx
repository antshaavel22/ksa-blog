import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Script from "next/script";

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
      <head>
        <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-KCZVRJ8');`}</Script>
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KCZVRJ8" height="0" width="0" style={{display:"none",visibility:"hidden"}} /></noscript>
        {children}
      </body>
    </html>
  );
}
