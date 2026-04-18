import { getAllPosts, getAllCategories } from "@/lib/posts";
import { getCategoryLabel, CATEGORY_LABELS, toSlug } from "@/lib/categories";
import PostCard from "@/components/PostCard";
import BlogNav from "@/components/BlogNav";
import BlogFooter from "@/components/BlogFooter";
import SearchInput from "@/components/SearchInput";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KSA Blog — Silmade tervis ja laserkorrektsiooni artiklid",
  description:
    "Selged vastused silmade kohta — üle 450 artikli silmade tervise, laserkorrektsiooni ja nägemise parandamise kohta KSA Silmakeskuse ekspertidelt.",
  alternates: {
    canonical: "https://blog.ksa.ee",
  },
  openGraph: {
    title: "KSA Blog — Silmade tervis ja laserkorrektsiooni artiklid",
    description: "Selged vastused silmade kohta — üle 450 artikli silmade tervise, laserkorrektsiooni ja nägemise parandamise kohta KSA Silmakeskuse ekspertidelt.",
    url: "https://blog.ksa.ee",
    siteName: "KSA Silmakeskus",
    images: [{ url: "https://ksa.ee/wp-content/themes/ksa/images/ksa-logo.svg", width: 1200, height: 630, alt: "KSA Blog" }],
    locale: "et_EE",
    type: "website",
  },
};

const POSTS_PER_PAGE = 12;

interface PageProps {
  searchParams: Promise<{ kategooria?: string; leht?: string; keel?: string; otsing?: string }>;
}

export default async function BlogIndexPage({ searchParams }: PageProps) {
  const { kategooria, leht, keel, otsing } = await searchParams;
  const page = parseInt(leht ?? "1", 10);
  const lang = keel ?? "et";
  const query = otsing?.trim().toLowerCase() ?? "";
  const allPosts = getAllPosts();
  const categories = getAllCategories();

  const langFiltered = allPosts.filter((p) => p.lang === lang);

  const categoryFiltered = kategooria
    ? langFiltered.filter((p) =>
        p.categories.some((c) => toSlug(c) === kategooria)
      )
    : langFiltered;

  const filtered = query
    ? categoryFiltered.filter((p) =>
        p.title.toLowerCase().includes(query) ||
        p.excerpt?.toLowerCase().includes(query) ||
        p.categories.some((c) => c.toLowerCase().includes(query)) ||
        p.tags?.some((t) => t.toLowerCase().includes(query))
      )
    : categoryFiltered;

  const total = filtered.length;
  const totalPages = Math.ceil(total / POSTS_PER_PAGE);
  const posts = filtered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  const t = {
    all: lang === "ru" ? "Все" : lang === "en" ? "All" : "Kõik",
    articles: lang === "ru" ? "статей" : lang === "en" ? "articles" : "artiklit",
    notFound: lang === "ru" ? "Статьи не найдены." : lang === "en" ? "No articles found." : "Artikleid ei leitud.",
    prev: lang === "ru" ? "← Предыдущая" : lang === "en" ? "← Previous" : "← Eelmine",
    next: lang === "ru" ? "Следующая →" : lang === "en" ? "Next →" : "Järgmine →",
  };

  return (
    <>
      <BlogNav lang={lang} />
      <main className="flex-1">
        {/* Hero — wide, warm, confident */}
        <section className="bg-[#E8E3D3] border-b border-[#D8D3C8] py-12 sm:py-16">
          <div className="max-w-[1140px] mx-auto px-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#87BE23]">
              KSA Silmakeskus
            </span>
            <h1 className="text-[2.25rem] sm:text-[2.75rem] font-semibold tracking-[-0.035em] leading-[1.1] text-[#000000] mt-3 mb-4">
              {lang === "ru" ? "Блог" : lang === "en" ? "Blog" : "Blogi"}
            </h1>
            <p className="text-[#5A6B6C] text-base font-light max-w-[520px] leading-[1.65]">
              {lang === "ru"
                ? "Хорошее зрение — одна из сверхспособностей человека. С хорошим зрением жизнь становится красивее!"
                : lang === "en"
                ? "Good vision is one of life's superpowers. See better — live better!"
                : "Hea nägemine on üks inimese supervõimetest. Hea nägemisega on elu ilusam!"}
            </p>
          </div>
        </section>

        {/* Language tabs */}
        <section className="border-b border-[#E6E4DF] bg-[#FEFEFE] py-3">
          <div className="max-w-[1140px] mx-auto px-6 flex gap-1.5">
            {[
              { code: "et", label: "Eesti" },
              { code: "ru", label: "Русский" },
              { code: "en", label: "English" },
            ].map(({ code, label }) => (
              <Link
                key={code}
                href={`/?keel=${code}`}
                className={`px-4 py-1.5 rounded-[32px] text-[13px] font-medium transition-colors ${
                  lang === code
                    ? "bg-[#000000] text-white"
                    : "bg-[#F0EDE8] text-[#5A6B6C] hover:bg-[#E8E3D3] hover:text-[#000000]"
                }`}
              >
                {label}
                <span className="ml-1.5 text-[11px] opacity-50">
                  {allPosts.filter((p) => p.lang === code).length}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Category filters + Search */}
        <section className="border-b border-[#E6E4DF] bg-[#FEFEFE] py-3">
          <div className="max-w-[1140px] mx-auto px-6 flex gap-2 items-center overflow-x-auto scrollbar-hide pb-0.5">
            <Link
              href={`/?keel=${lang}`}
              className={`flex-shrink-0 px-4 py-1.5 rounded-[32px] text-[13px] font-medium transition-colors ${
                !kategooria
                  ? "bg-[#87BE23] text-white shadow-[0_2px_8px_rgba(135,190,35,0.25)]"
                  : "bg-[#F0EDE8] text-[#5A6B6C] hover:bg-[#E8E3D3] hover:text-[#000000]"
              }`}
            >
              {t.all} <span className="opacity-60">({langFiltered.length})</span>
            </Link>
            {categories
              .filter((cat) =>
                cat.slug !== "uncategorized" &&
                cat.slug in CATEGORY_LABELS &&
                langFiltered.some((p) =>
                  p.categories.some((c) => toSlug(c) === cat.slug)
                )
              )
              .slice(0, 10)
              .map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/?keel=${lang}&kategooria=${cat.slug}`}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-[32px] text-[13px] font-medium transition-colors ${
                    kategooria === cat.slug
                      ? "bg-[#87BE23] text-white shadow-[0_2px_8px_rgba(135,190,35,0.25)]"
                      : "bg-[#F0EDE8] text-[#5A6B6C] hover:bg-[#E8E3D3] hover:text-[#000000]"
                  }`}
                >
                  {getCategoryLabel(cat.slug, lang as "et" | "ru" | "en")}
                  <span className="ml-1.5 opacity-50">
                    {langFiltered.filter((p) => p.categories.some((c) => toSlug(c) === cat.slug)).length}
                  </span>
                </Link>
              ))}

            <div className="flex-shrink-0 ml-auto">
              <Suspense>
                <SearchInput lang={lang} kategooria={kategooria} />
              </Suspense>
            </div>
          </div>
        </section>

        {/* Post grid */}
        <section className="max-w-[1140px] mx-auto px-6 py-10">
          {posts.length === 0 ? (
            <p className="text-[#9A9A9A] text-center py-24 font-light">{t.notFound}</p>
          ) : (
            <>
              <p className="text-[12px] font-light text-[#9A9A9A] mb-7 tracking-wide">
                {total} {t.articles}{kategooria ? ` · ${getCategoryLabel(kategooria, lang as "et" | "ru" | "en")}` : ""}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {posts.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-14">
                  {page > 1 && (
                    <Link
                      href={`/?keel=${lang}${kategooria ? `&kategooria=${kategooria}` : ""}&leht=${page - 1}`}
                      className="px-5 py-2 rounded-[32px] border border-[#E6E4DF] text-[13px] font-medium text-[#5A6B6C] hover:border-[#87BE23] hover:text-[#000000] transition-all"
                    >
                      {t.prev}
                    </Link>
                  )}
                  <span className="px-4 py-2 text-[13px] font-light text-[#9A9A9A]">
                    {page} / {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link
                      href={`/?keel=${lang}${kategooria ? `&kategooria=${kategooria}` : ""}&leht=${page + 1}`}
                      className="px-5 py-2 rounded-[32px] border border-[#E6E4DF] text-[13px] font-medium text-[#5A6B6C] hover:border-[#87BE23] hover:text-[#000000] transition-all"
                    >
                      {t.next}
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>
      <BlogFooter lang={lang} />
    </>
  );
}
