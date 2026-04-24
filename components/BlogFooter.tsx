import Link from "next/link";
import ConsentLink from "./ConsentLink";

type Lang = "et" | "ru" | "en";

const TAGLINE: Record<Lang, string> = {
  et: "Eesti suurim erasilmakeskus. Siin jagame teadmisi, kogemusi ja uudiseid.",
  ru: "Крупнейший частный глазной центр Эстонии. Мы делимся знаниями, опытом и новостями.",
  en: "Estonia's largest private eye centre. We share knowledge, experiences and news.",
};

const COL_LABELS: Record<Lang, { cat: string; ksa: string }> = {
  et: { cat: "Kategooriad", ksa: "KSA.ee" },
  ru: { cat: "Категории", ksa: "KSA.ee" },
  en: { cat: "Categories", ksa: "KSA.ee" },
};

const CAT_LINKS: Record<Lang, Array<{ label: string; href: string }>> = {
  et: [
    { label: "Flow protseduur", href: "/?kategooria=flow-protseduur" },
    { label: "Silmad & tervis", href: "/?kategooria=silmad-ja-tervis" },
    { label: "KSA Silmakeskus", href: "/?kategooria=ksa-silmakeskus" },
    { label: "Edulood", href: "/?kategooria=edulood" },
    { label: "Elustiil", href: "/?kategooria=elustiil" },
  ],
  ru: [
    { label: "Процедура Flow", href: "/?keel=ru&kategooria=flow-protseduur" },
    { label: "Глаза и здоровье", href: "/?keel=ru&kategooria=silmad-ja-tervis" },
    { label: "Глазной центр KSA", href: "/?keel=ru&kategooria=ksa-silmakeskus" },
  ],
  en: [
    { label: "Flow Procedure", href: "/?keel=en&kategooria=flow-protseduur" },
    { label: "Eyes & Health", href: "/?keel=en&kategooria=silmad-ja-tervis" },
    { label: "KSA Vision Center", href: "/?keel=en&kategooria=ksa-silmakeskus" },
  ],
};

const KSA_LINKS: Record<Lang, Array<{ label: string; href: string }>> = {
  et: [
    { label: "Flow3", href: "https://ksa.ee/flow3" },
    { label: "Uuringud", href: "https://ksa.ee/uuringud" },
    { label: "Hinnakiri", href: "https://ksa.ee/hinnakiri" },
    { label: "Broneeri", href: "https://ksa.ee/broneeri" },
  ],
  ru: [
    { label: "Flow3", href: "https://ksa.ee/ru.html" },
    { label: "Услуги", href: "https://ksa.ee/ru.html" },
    { label: "Цены", href: "https://ksa.ee/ru.html" },
    { label: "Записаться", href: "https://ksa.ee/ru.html" },
  ],
  en: [
    { label: "Flow3", href: "https://ksa.ee/en.html" },
    { label: "Services", href: "https://ksa.ee/en.html" },
    { label: "Pricing", href: "https://ksa.ee/en.html" },
    { label: "Book", href: "https://ksa.ee/en.html" },
  ],
};

const LEGAL: Record<Lang, Array<{ label: string; href: string }>> = {
  et: [
    { label: "Privaatsus", href: "https://ksa.ee/privaatsuspoliitika" },
    { label: "Facebook", href: "https://www.facebook.com/ksasilmakeskus/" },
    { label: "Instagram", href: "https://www.instagram.com/ksa_silmakeskus" },
  ],
  ru: [
    { label: "Конфиденциальность", href: "https://ksa.ee/ru.html" },
    { label: "Facebook", href: "https://www.facebook.com/ksasilmakeskus/" },
    { label: "Instagram", href: "https://www.instagram.com/ksa_silmakeskus" },
  ],
  en: [
    { label: "Privacy", href: "https://ksa.ee/en.html" },
    { label: "Facebook", href: "https://www.facebook.com/ksasilmakeskus/" },
    { label: "Instagram", href: "https://www.instagram.com/ksa_silmakeskus" },
  ],
};

export default function BlogFooter({ lang = "et" }: { lang?: string }) {
  const l: Lang = (lang === "ru" || lang === "en" ? lang : "et") as Lang;
  const cols = COL_LABELS[l];
  const year = new Date().getFullYear();

  return (
    <footer style={{ background: "var(--ink)", color: "#fff" }} className="mt-auto">
      <div className="mx-auto" style={{ maxWidth: "var(--container)", padding: "56px var(--gutter) 32px" }}>
        <div
          className="footer-grid grid gap-10"
          style={{ marginBottom: 36 }}
        >
          <div>
            <div className="flex items-center gap-2.5">
              <svg width="28" height="28" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <circle cx="20" cy="20" r="17" stroke="#fff" strokeWidth="2.2" />
                <circle cx="20" cy="20" r="6.5" fill="#fff" />
                <circle cx="23" cy="17" r="2" fill="#1a1a1a" />
              </svg>
              <span style={{ fontWeight: 600, fontSize: 19, letterSpacing: "-0.02em" }}>ksa</span>
              <span
                style={{
                  fontWeight: 400,
                  fontSize: 14,
                  opacity: 0.5,
                  paddingLeft: 10,
                  marginLeft: 4,
                  borderLeft: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                {l === "ru" ? "Блог" : l === "en" ? "Blog" : "Blogi"}
              </span>
            </div>
            <p
              style={{
                fontSize: 13,
                opacity: 0.55,
                lineHeight: 1.6,
                maxWidth: 300,
                marginTop: 16,
              }}
            >
              {TAGLINE[l]}
            </p>
          </div>

          {[
            { title: cols.cat, items: CAT_LINKS[l] },
            { title: cols.ksa, items: KSA_LINKS[l] },
          ].map((col, j) => (
            <div key={j}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  opacity: 0.4,
                  fontWeight: 600,
                  marginBottom: 14,
                }}
              >
                {col.title}
              </div>
              <ul
                className="flex flex-col"
                style={{ listStyle: "none", margin: 0, padding: 0, gap: 8, fontSize: 13, opacity: 0.75 }}
              >
                {col.items.map((x, k) => (
                  <li key={k}>
                    <Link href={x.href} className="transition-colors hover:opacity-100" style={{ color: "#fff" }}>
                      {x.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="flex justify-between"
          style={{
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            fontSize: 12,
            opacity: 0.4,
          }}
        >
          <span>© {year} KSA Silmakeskus</span>
          <div className="flex gap-4">
            {LEGAL[l].map((x) => (
              <Link key={x.label} href={x.href} style={{ color: "#fff" }}>
                {x.label}
              </Link>
            ))}
            <ConsentLink lang={l} />
          </div>
        </div>
      </div>
    </footer>
  );
}
