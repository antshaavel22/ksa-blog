import { getAllPosts, getAllCategories } from "@/lib/posts";
import { getCategoryLabel, CATEGORY_LABELS, toSlug } from "@/lib/categories";
import PostCard from "@/components/PostCard";
import BlogNav from "@/components/BlogNav";
import BlogFooter from "@/components/BlogFooter";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KSA Blogi — Silmade tervis ja laserkorrektsiooni artiklid",
  description:
    "Selged vastused silmade kohta — üle 450 artikli silmade tervise, laserkorrektsiooni ja nägemise parandamise kohta KSA Silmakeskuse ekspertidelt.",
};

const POSTS_PER_PAGE = 12;

interface PageProps {
  searchParams: Promise<{ kategooria?: string; leht?: string; keel?: string }>;
}

export default async function BlogIndexPage({ searchParams }: PageProps) {
  const { kategooria, leht, keel } = await searchParams;
  const page = parseInt(leht ?? "1", 10);
  const lang = keel ?? "et";
  const allPosts = getAllPosts();
  const categories = getAllCategories();

  const langFiltered = allPosts.filter((p) => p.lang === lang);

  const filtered = kategooria
    ? langFiltered.filter((p) =>
        p.categories.some((c) => toSlug(c) === kategooria)
      )
    : langFiltered;

  const total = filtered.length;
  const totalPages = Math.ceil(total / POSTS_PER_PAGE);
  const posts = filtered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  return (
    <>
      <BlogNav />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-[#f9f9f7] border-b border-[#e6e6e6] py-8 sm:py-12">
          <div className="max-w-[1200px] mx-auto px-6">
            <span className="text-xs font-medium uppercase tracking-widest text-[#87be23]">
              KSA Silmakeskus
            </span>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1a1a1a] mt-2 mb-3">
              {lang === "ru" ? "Блог" : "Blogi"}
            </h1>
            <p className="text-[#5a6b6c] text-base max-w-xl">
              {lang === "ru"
                ? "Хорошее зрение — одна из сверхспособностей человека. С хорошим зрением жизнь становится красивее!"
                : lang === "en"
                ? "Good vision is one of life's superpowers. See better — live better!"
                : "Hea nägemine on üks inimese supervõimetest. Hea nägemisega on elu ilusam!"}
            </p>
          </div>
        </section>

        {/* Language tabs */}
        <section className="border-b border-[#e6e6e6] bg-white py-3">
          <div className="max-w-[1200px] mx-auto px-6 flex gap-1">
            {[
              { code: "et", label: "Eesti" },
              { code: "ru", label: "Русский" },
              { code: "en", label: "English" },
            ].map(({ code, label }) => (
              <Link
                key={code}
                href={`/?keel=${code}`}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  lang === code
                    ? "bg-[#1a1a1a] text-white"
                    : "bg-[#f5f3ee] text-[#5a6b6c] hover:bg-[#e8e3d3]"
                }`}
              >
                {label}
                <span className="ml-1.5 text-xs opacity-50">
                  {allPosts.filter((p) => p.lang === code).length}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Category filters */}
        <section className="border-b border-[#e6e6e6] bg-white py-3">
          <div className="max-w-[1200px] mx-auto px-6 flex gap-2 items-center overflow-x-auto scrollbar-hide pb-0.5">
            <Link
              href={`/?keel=${lang}`}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !kategooria
                  ? "bg-[#87be23] text-white"
                  : "bg-[#f5f3ee] text-[#5a6b6c] hover:bg-[#e8e3d3]"
              }`}
            >
              Kõik ({langFiltered.length})
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
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    kategooria === cat.slug
                      ? "bg-[#87be23] text-white"
                      : "bg-[#f5f3ee] text-[#5a6b6c] hover:bg-[#e8e3d3]"
                  }`}
                >
                  {getCategoryLabel(cat.slug, lang as "et" | "ru" | "en")}
                  <span className="ml-1.5 text-xs opacity-60">
                    {
                      langFiltered.filter((p) =>
                        p.categories.some((c) => toSlug(c) === cat.slug)
                      ).length
                    }
                  </span>
                </Link>
              ))}
          </div>
        </section>

        {/* Post grid */}
        <section className="max-w-[1200px] mx-auto px-6 py-10">
          {posts.length === 0 ? (
            <p className="text-[#9a9a9a] text-center py-20">Artikleid ei leitud.</p>
          ) : (
            <>
              <p className="text-sm text-[#9a9a9a] mb-6">
                Leitud {total} artiklit
                {kategooria ? ` kategoorias "${kategooria}"` : ""}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-12">
                  {page > 1 && (
                    <Link
                      href={`/?keel=${lang}${kategooria ? `&kategooria=${kategooria}` : ""}&leht=${page - 1}`}
                      className="px-5 py-2 rounded-full border border-[#e6e6e6] text-sm text-[#5a6b6c] hover:border-[#87be23] transition-colors"
                    >
                      ← Eelmine
                    </Link>
                  )}
                  <span className="px-4 py-2 text-sm text-[#9a9a9a]">
                    {page} / {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link
                      href={`/?keel=${lang}${kategooria ? `&kategooria=${kategooria}` : ""}&leht=${page + 1}`}
                      className="px-5 py-2 rounded-full border border-[#e6e6e6] text-sm text-[#5a6b6c] hover:border-[#87be23] transition-colors"
                    >
                      Järgmine →
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>
      <BlogFooter />
    </>
  );
}
