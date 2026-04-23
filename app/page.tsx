import { getAllPosts, getAllCategories } from "@/lib/posts";
import { getCategoryLabel, CATEGORY_LABELS, toSlug } from "@/lib/categories";
import PostCard from "@/components/PostCard";
import BlogNav from "@/components/BlogNav";
import BlogFooter from "@/components/BlogFooter";
import PageLang from "@/components/PageLang";
import SearchInput from "@/components/SearchInput";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KSA Blog — Silmade tervis ja laserkorrektsiooni artiklid",
  description:
    "Selged vastused silmade kohta — üle 450 artikli silmade tervise, laserkorrektsiooni ja nägemise parandamise kohta KSA Silmakeskuse ekspertidelt.",
  alternates: { canonical: "https://blog.ksa.ee" },
  openGraph: {
    title: "KSA Blog — Silmade tervis ja laserkorrektsiooni artiklid",
    description: "Üle 450 artikli silmade tervise ja nägemise parandamise kohta.",
    url: "https://blog.ksa.ee",
    siteName: "KSA Silmakeskus",
    locale: "et_EE",
    type: "website",
  },
};

const POSTS_PER_PAGE = 13; // 1 featured + 12 in grid

interface PageProps {
  searchParams: Promise<{ kategooria?: string; leht?: string; keel?: string; otsing?: string }>;
}

const T = {
  et: {
    label: "KSA Silmakeskus · Blogi",
    title: "Blogi",
    sub: "Iga lugu algab silmadest. Siin jagame teadmisi, kogemusi ja uudiseid nägemise tervisest ja vabadusest.",
    langHeader: "Keel",
    all: "Kõik",
    articles: "artiklit",
    notFound: "Artikleid ei leitud.",
  },
  ru: {
    label: "KSA Vision Center · Блог",
    title: "Блог",
    sub: "Каждая история начинается со зрения. Здесь мы делимся знаниями, опытом и новостями о здоровье глаз и свободе видеть.",
    langHeader: "Язык",
    all: "Все",
    articles: "статей",
    notFound: "Статьи не найдены.",
  },
  en: {
    label: "KSA Vision Center · Blog",
    title: "Blog",
    sub: "Every story begins with the eyes. Here we share knowledge, experiences and news about vision health and freedom.",
    langHeader: "Language",
    all: "All",
    articles: "articles",
    notFound: "No articles found.",
  },
} as const;

const LANGS = [
  { code: "et", label: "Eesti" },
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
] as const;

export default async function BlogIndexPage({ searchParams }: PageProps) {
  const { kategooria, leht, keel, otsing } = await searchParams;
  const page = parseInt(leht ?? "1", 10);
  const lang = (keel ?? "et") as "et" | "ru" | "en";
  const query = otsing?.trim().toLowerCase() ?? "";
  const allPosts = getAllPosts();
  const categories = getAllCategories();
  const t = T[lang] ?? T.et;

  const langFiltered = allPosts.filter((p) => p.lang === lang);
  const categoryFiltered = kategooria
    ? langFiltered.filter((p) => p.categories.some((c) => toSlug(c) === kategooria))
    : langFiltered;
  const filtered = query
    ? categoryFiltered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.excerpt?.toLowerCase().includes(query) ||
          p.categories.some((c) => c.toLowerCase().includes(query)) ||
          p.tags?.some((x) => x.toLowerCase().includes(query))
      )
    : categoryFiltered;

  const total = filtered.length;
  const totalPages = Math.ceil(total / POSTS_PER_PAGE);
  const pageSlice = filtered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  const featured = page === 1 && !kategooria && !query ? pageSlice[0] : undefined;
  const grid = featured ? pageSlice.slice(1) : pageSlice;

  return (
    <>
      <PageLang lang={lang} />
      <BlogNav lang={lang} />
      <main className="flex-1">
        {/* ── Hero ── */}
        <section
          style={{
            background: "var(--beige-light)",
            padding: "72px 0 56px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div className="mx-auto" style={{ maxWidth: "var(--container)", padding: "0 var(--gutter)" }}>
            <div className="hero-grid grid items-end">
              <div>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--lime-dark)",
                    fontWeight: 600,
                  }}
                >
                  {t.label}
                </div>
                <h1
                  style={{
                    fontSize: "clamp(56px, 9vw, 112px)",
                    lineHeight: 0.9,
                    letterSpacing: "-0.04em",
                    margin: "18px 0 20px",
                    fontWeight: 300,
                  }}
                >
                  {t.title}
                  <span style={{ color: "var(--lime-dark)", fontWeight: 500 }}>.</span>
                </h1>
                <p
                  style={{
                    fontSize: 17,
                    color: "var(--ink-60)",
                    maxWidth: 560,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {t.sub}
                </p>
              </div>

              <div className="flex flex-col items-start" style={{ gap: 10 }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--ink-40)",
                    fontWeight: 600,
                  }}
                >
                  {t.langHeader}
                </div>
                <div
                  className="inline-flex"
                  style={{
                    gap: 3,
                    background: "#fff",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    padding: 4,
                  }}
                >
                  {LANGS.map(({ code, label }) => {
                    const active = lang === code;
                    const count = allPosts.filter((p) => p.lang === code).length;
                    return (
                      <Link
                        key={code}
                        href={code === "et" ? "/" : `/?keel=${code}`}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 9,
                          fontSize: 13,
                          fontWeight: 500,
                          letterSpacing: "-0.005em",
                          background: active ? "var(--ink)" : "transparent",
                          color: active ? "#fff" : "var(--ink-60)",
                          transition: "all 0.2s",
                        }}
                      >
                        {label}{" "}
                        <span style={{ fontSize: 11, opacity: 0.55, marginLeft: 4, fontWeight: 400 }}>
                          {count}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Category filter ── */}
        <div className="cat-filter-bar">
          <div className="mx-auto" style={{ maxWidth: "var(--container)", padding: "0 var(--gutter)" }}>
            <div className="cat-filter-row">
              <div className="cat-pills">
                <CategoryPill
                  href={lang === "et" ? "/" : `/?keel=${lang}`}
                  active={!kategooria}
                  label={t.all}
                  count={langFiltered.length}
                />
                {categories
                  .filter(
                    (cat) =>
                      cat.slug !== "uncategorized" &&
                      cat.slug in CATEGORY_LABELS &&
                      langFiltered.some((p) => p.categories.some((c) => toSlug(c) === cat.slug))
                  )
                  .slice(0, 10)
                  .map((cat) => {
                    const count = langFiltered.filter((p) =>
                      p.categories.some((c) => toSlug(c) === cat.slug)
                    ).length;
                    return (
                      <CategoryPill
                        key={cat.slug}
                        href={`/?keel=${lang}&kategooria=${cat.slug}`}
                        active={kategooria === cat.slug}
                        label={getCategoryLabel(cat.slug, lang)}
                        count={count}
                      />
                    );
                  })}
              </div>

              <div className="cat-search">
                <Suspense>
                  <SearchInput lang={lang} kategooria={kategooria} />
                </Suspense>
              </div>
            </div>
          </div>
        </div>

        {/* ── Post grid ── */}
        <section style={{ padding: "56px 0 96px" }}>
          <div className="mx-auto" style={{ maxWidth: "var(--container)", padding: "0 var(--gutter)" }}>
            {pageSlice.length === 0 ? (
              <p
                style={{
                  color: "var(--ink-40)",
                  textAlign: "center",
                  padding: "96px 0",
                  fontWeight: 300,
                }}
              >
                {t.notFound}
              </p>
            ) : (
              <>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--ink-40)",
                    marginBottom: 28,
                    letterSpacing: 0.02,
                  }}
                >
                  {total} {t.articles}
                  {kategooria ? ` · ${getCategoryLabel(kategooria, lang)}` : ""}
                </p>

                {featured && (
                  <div style={{ marginBottom: 32 }}>
                    <PostCard post={featured} large />
                  </div>
                )}

                <div className="post-grid grid">
                  {grid.map((post) => (
                    <PostCard key={post.slug} post={post} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    buildHref={(p) =>
                      `/?keel=${lang}${kategooria ? `&kategooria=${kategooria}` : ""}${p > 1 ? `&leht=${p}` : ""}`
                    }
                  />
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <BlogFooter lang={lang} />
    </>
  );
}

function CategoryPill({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center whitespace-nowrap"
      style={{
        padding: "9px 16px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: "-0.005em",
        border: active ? "1px solid var(--lime)" : "1px solid var(--line)",
        background: active ? "var(--lime)" : "#fff",
        color: active ? "#fff" : "var(--ink)",
        gap: 8,
        transition: "all 0.15s",
      }}
    >
      {label}
      <span style={{ fontSize: 11, opacity: active ? 0.75 : 0.4, fontWeight: 400 }}>
        {count}
      </span>
    </Link>
  );
}

function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (p: number) => string;
}) {
  // Build page list: prev, 1..4, ..., last, next (condensed)
  const nums = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) nums.add(i);
  }
  const sorted = Array.from(nums)
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);
  const items: Array<number | "…"> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) items.push("…");
    items.push(sorted[i]);
  }

  return (
    <div className="flex items-center justify-center" style={{ gap: 8, marginTop: 56 }}>
      {page > 1 && (
        <PageBtn href={buildHref(page - 1)} label="‹" />
      )}
      {items.map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} style={{ color: "var(--ink-40)", padding: "0 6px" }}>
            …
          </span>
        ) : (
          <PageBtn key={n} href={buildHref(n)} label={String(n)} active={n === page} />
        )
      )}
      {page < totalPages && <PageBtn href={buildHref(page + 1)} label="›" />}
    </div>
  );
}

function PageBtn({ href, label, active = false }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      style={{
        minWidth: 40,
        height: 40,
        border: "1px solid var(--line)",
        background: active ? "var(--ink)" : "#fff",
        color: active ? "#fff" : "var(--ink)",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 500,
        padding: "0 14px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: active ? "none" : "auto",
      }}
    >
      {label}
    </Link>
  );
}
