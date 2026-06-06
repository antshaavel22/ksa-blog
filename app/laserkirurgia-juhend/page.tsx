import BlogNav from "@/components/BlogNav";
import BlogFooter from "@/components/BlogFooter";
import Link from "next/link";
import type { Metadata } from "next";
import { publicBlogUrl } from "@/lib/url";

export const metadata: Metadata = {
  title: "Silmade Laserkirurgia Tarbijajuhend 2026 — KSA Silmakeskus",
  description:
    "Dr. Ants Haaveli põhjalik tarbijajuhend laserkirurgia kaalumiseks: 14 peatükki, 35 viidet teaduskirjandusele, KSA 21-aastased andmed (55 000+ protseduuri, 0 ektaasiat). Sõltumatu ja patsiendi huvi keskmes.",
  alternates: { canonical: publicBlogUrl("laserkirurgia-juhend") },
  openGraph: {
    title: "Silmade Laserkirurgia Tarbijajuhend 2026",
    description:
      "14 peatükki, 35 teaduslikku viidet, 21 aasta KSA andmed. Sõltumatu juhend laserkirurgia kaalumiseks.",
    url: publicBlogUrl("laserkirurgia-juhend"),
    siteName: "KSA Silmakeskus",
    locale: "et_EE",
    type: "website",
  },
};

interface Chapter {
  num: number;
  title: string;
  slug: string;
  readingTime: string;
  emphasis?: boolean;
  blurb: string;
}

const CHAPTERS: Chapter[] = [
  {
    num: 0,
    title: "Eessõna — miks ma selle juhendi kirjutasin",
    slug: "laserkirurgia-juhend-00-eessona",
    readingTime: "4 min",
    blurb: "Autori avasõna ja kuidas seda juhendit lugeda.",
  },
  {
    num: 1,
    title: "Kuidas silm töötab: anatoomia 5 minutiga",
    slug: "laserkirurgia-juhend-01-kuidas-silm-tootab",
    readingTime: "5 min",
    blurb: "Silma 6 võtmeosa ja valguse tee silma sisse.",
  },
  {
    num: 2,
    title: "Nägemise vead: müoopia, hüperoopia, astigmaatia",
    slug: "laserkirurgia-juhend-02-nagemise-vead",
    readingTime: "6 min",
    blurb: "Põhilised refraktiivsed vead ja maailma müoopia epideemia.",
  },
  {
    num: 3,
    title: "Refraktiivkirurgia ajalugu",
    slug: "laserkirurgia-juhend-03-refraktiivkirurgia-ajalugu",
    readingTime: "8 min",
    blurb: "Radial keratotomy → Camellini LASEK → modernsete pinna-meetoditeni.",
  },
  {
    num: 4,
    title: "Kuidas modernne laserkirurgia töötab",
    slug: "laserkirurgia-juhend-03-kuidas-laserkirurgia-tootab",
    readingTime: "12 min",
    blurb: "Klapi-meetodid vs pinna-meetodid. SmartSurface, C-Ten, Flow3.",
  },
  {
    num: 5,
    title: "Sarvkesta biomehaanika",
    slug: "laserkirurgia-juhend-05-sarvkesta-biomehaanika",
    readingTime: "10 min",
    emphasis: true,
    blurb: "KSA tugevaim teaduslik USP. LASIK kaotab 20-25%, pinna-meetod 10-15%.",
  },
  {
    num: 6,
    title: "Levinud müüdid laserkirurgiast",
    slug: "laserkirurgia-juhend-04-levinud-muudid-laserkirurgiast",
    readingTime: "9 min",
    blurb: "7 sagedaste väärarusaamade aus käsitlus.",
  },
  {
    num: 7,
    title: "Turvalisus ja ektaasia",
    slug: "laserkirurgia-juhend-07-turvalisus-ja-ektaasia",
    readingTime: "10 min",
    emphasis: true,
    blurb: "0 ektaasia juhtumit, 55 000+ operatsiooni, 21 aastat järelkontrolli.",
  },
  {
    num: 8,
    title: "Võrkkest ja vaakum",
    slug: "laserkirurgia-juhend-08-vorkkest-ja-vaakum",
    readingTime: "9 min",
    emphasis: true,
    blurb: "Miks pinna-meetod ei pane silmasisest rõhku tõusma. Kõrgmüoopia eelis.",
  },
  {
    num: 9,
    title: "Diagnostika tehnoloogia",
    slug: "laserkirurgia-juhend-09-diagnostika-tehnoloogia",
    readingTime: "9 min",
    blurb: "7 võtmemõõdistust: Pentacam, OCT, ORA, pakhümeetria.",
  },
  {
    num: 10,
    title: "Kas Sa oled kandidaat?",
    slug: "laserkirurgia-juhend-10-kas-sa-oled-kandidaat",
    readingTime: "7 min",
    blurb: "Täpsed Flow3 kriteeriumid + erandid + vastunäidustused.",
  },
  {
    num: 11,
    title: "Presbüoopia (dedicated)",
    slug: "laserkirurgia-juhend-11-presbuoopia",
    readingTime: "8 min",
    blurb: "Lugemisvanus + miks see ei ole laseroperatsiooni regressioon.",
  },
  {
    num: 12,
    title: "Kuidas valida silmakirurgi ja kliinikut",
    slug: "laserkirurgia-juhend-08-kuidas-valida-silmakirurgi-ja-kliinikut",
    readingTime: "11 min",
    emphasis: true,
    blurb: "KSA mudel kui läbipaistvuse standard. Punakad lipud.",
  },
  {
    num: 13,
    title: "Alternatiivid (ICL, RLE, kontaktläätsed, prillid)",
    slug: "laserkirurgia-juhend-13-alternatiivid",
    readingTime: "8 min",
    blurb: "Aus alternatiivide võrdlus — sh meetodid, mida ise ei tee.",
  },
  {
    num: 14,
    title: "Kokkuvõte + 20 küsimust silmaarstile",
    slug: "laserkirurgia-juhend-14-kokkuvote",
    readingTime: "6 min",
    blurb: "13 peatüki kokkuvõte + trükivalmis küsimuste leht.",
  },
];

const TOTAL_MIN = CHAPTERS.reduce((sum, c) => {
  const m = c.readingTime.match(/\d+/);
  return sum + (m ? parseInt(m[0]) : 0);
}, 0);

export default function LaserkirurgiaJuhendHub() {
  return (
    <main className="min-h-screen bg-[#f9f9f7]">
      <BlogNav />

      {/* Hero */}
      <section className="border-b border-[#e6e6e6] bg-white">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
          <div className="mb-3 text-sm font-medium uppercase tracking-wider text-[#87be23]">
            KSA Silmakeskus · Tarbijajuhend 2026
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold leading-tight text-[#1a1a1a]">
            Silmade laserkirurgia tarbijajuhend
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#5a6b6c]">
            Dr. Ants Haaveli põhjalik teejuht laserkirurgia kaalumiseks.
            <strong className="text-[#1a1a1a]">
              {" "}
              14 peatükki, 35 viidet teaduskirjandusele,
            </strong>{" "}
            ja KSA Silmakeskuse 21 aasta järelkontrolli andmed —{" "}
            <strong className="text-[#1a1a1a]">
              55 000+ operatsiooni, 0 ektaasia juhtumit
            </strong>
            .
          </p>
          <div className="mt-8 flex flex-wrap gap-4 text-sm text-[#5a6b6c]">
            <span className="rounded-full border border-[#e6e6e6] bg-[#f9f9f7] px-4 py-2">
              📖 {CHAPTERS.length} peatükki
            </span>
            <span className="rounded-full border border-[#e6e6e6] bg-[#f9f9f7] px-4 py-2">
              ⏱ ~{TOTAL_MIN} min täislugemiseks
            </span>
            <span className="rounded-full border border-[#e6e6e6] bg-[#f9f9f7] px-4 py-2">
              📚 35 teaduslikku viidet
            </span>
            <span className="rounded-full border border-[#e6e6e6] bg-[#f9f9f7] px-4 py-2">
              🔬 21 aasta KSA andmed
            </span>
          </div>
        </div>
      </section>

      {/* Why this guide */}
      <section className="border-b border-[#e6e6e6] bg-[#f9f9f7]">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <h2 className="text-2xl font-semibold text-[#1a1a1a]">
            Miks see juhend on erinev
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <div>
              <div className="text-3xl font-semibold text-[#87be23]">Aus</div>
              <p className="mt-2 text-sm leading-relaxed text-[#5a6b6c]">
                Räägime ka meetoditest, mida ise ei tee (ICL, RLE). Patsiendi
                huvi keskel, mitte müük.
              </p>
            </div>
            <div>
              <div className="text-3xl font-semibold text-[#87be23]">Tehniline</div>
              <p className="mt-2 text-sm leading-relaxed text-[#5a6b6c]">
                Biomehaanika, võrkkesta-vaakumi seos, korraliku sõelumise
                sisemiku. Mitte pinnapealne ülevaade.
              </p>
            </div>
            <div>
              <div className="text-3xl font-semibold text-[#87be23]">Aastate andmed</div>
              <p className="mt-2 text-sm leading-relaxed text-[#5a6b6c]">
                KSA 21 aasta järelkontroll, anonüümitult auditeeritav. Mitte
                turundus-numbrid.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Chapter list */}
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <h2 className="mb-8 text-2xl font-semibold text-[#1a1a1a]">
            Sisukord
          </h2>
          <ol className="space-y-3">
            {CHAPTERS.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/${c.slug}`}
                  className={`flex items-start gap-5 rounded-lg border p-5 transition-colors hover:border-[#87be23] hover:bg-[#f9f9f7] ${
                    c.emphasis
                      ? "border-[#87be23] bg-[#f9fef0]"
                      : "border-[#e6e6e6]"
                  }`}
                >
                  <div className="shrink-0 text-2xl font-semibold text-[#5a6b6c] tabular-nums w-10 text-right">
                    {c.num}.
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-lg font-semibold text-[#1a1a1a]">
                        {c.title}
                      </h3>
                      <span className="text-xs text-[#9a9a9a] whitespace-nowrap">
                        {c.readingTime}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-[#5a6b6c]">
                      {c.blurb}
                    </p>
                  </div>
                  <div className="shrink-0 self-center text-[#87be23]">→</div>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Author + CTA */}
      <section className="border-t border-[#e6e6e6] bg-[#f9f9f7]">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <div className="text-sm font-medium uppercase tracking-wider text-[#87be23]">
                Autor
              </div>
              <h3 className="mt-2 text-xl font-semibold text-[#1a1a1a]">
                Dr. Ants Haavel
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#5a6b6c]">
                KSA Silmakeskuse asutaja ja meditsiinijuht. 21+ aastat
                refraktiivkirurgia praktikat Eestis. Üle 55 000 operatsiooni,
                0 ektaasia juhtumit. Tallinn ja Tartu.
              </p>
            </div>
            <div>
              <div className="text-sm font-medium uppercase tracking-wider text-[#87be23]">
                Järgmine samm
              </div>
              <h3 className="mt-2 text-xl font-semibold text-[#1a1a1a]">
                Tee tasuta 90-sekundiline sobivustest
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#5a6b6c]">
                Pärast juhendi lugemist — kontrolli kas Flow3 sinu silmadele
                sobib. Esmane vastus 2 minutiga.
              </p>
              <a
                href="https://kiirtest.ksa.ee/"
                className="mt-5 inline-flex items-center rounded-md bg-[#87be23] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#76a81e]"
              >
                Alusta kiirtesti →
              </a>
            </div>
          </div>
        </div>
      </section>

      <BlogFooter />
    </main>
  );
}
