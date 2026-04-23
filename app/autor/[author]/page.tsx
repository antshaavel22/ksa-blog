import { getAllPosts } from "@/lib/posts";
import { getAuthorBySlug, AUTHORS, authorToSlug } from "@/lib/authors";
import BlogNav from "@/components/BlogNav";
import BlogFooter from "@/components/BlogFooter";
import PageLang from "@/components/PageLang";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ author: string }>;
  searchParams: Promise<{ keel?: string; leht?: string }>;
}

const POSTS_PER_PAGE = 12;

export async function generateStaticParams() {
  return AUTHORS.map((a) => ({ author: a.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { author: slug } = await params;
  const author = getAuthorBySlug(slug);
  if (!author) return {};
  return {
    title: `${author.displayName} — KSA Blog`,
    description: author.bio.et,
  };
}

export default async function AuthorPage({ params, searchParams }: PageProps) {
  const { author: slug } = await params;
  const { keel, leht } = await searchParams;

  const author = getAuthorBySlug(slug);
  if (!author) notFound();

  const lang = (keel ?? "et") as "et" | "ru" | "en";
  const page = parseInt(leht ?? "1", 10);

  const allPosts = getAllPosts();
  // Match posts where the author field matches any of the author's known keys
  const authorPosts = allPosts.filter((p) =>
    author.keys.some((k) => k === p.author || k === `"${p.author}"`)
  );

  const langPosts = lang
    ? authorPosts.filter((p) => p.lang === lang)
    : authorPosts;

  const total = langPosts.length;
  const totalPages = Math.ceil(total / POSTS_PER_PAGE);
  const posts = langPosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  // Post counts per language for the lang switcher
  const countEt = authorPosts.filter((p) => p.lang === "et").length;
  const countRu = authorPosts.filter((p) => p.lang === "ru").length;
  const countEn = authorPosts.filter((p) => p.lang === "en").length;

  const roleLabel = author.role[lang];
  const bioText = author.bio[lang];

  const t = {
    author: lang === "ru" ? "Автор" : lang === "en" ? "Author" : "Autor",
    articles: lang === "ru" ? "статей" : lang === "en" ? "articles" : "artiklit",
    notFound: lang === "ru" ? "Статьи не найдены." : lang === "en" ? "No articles found." : "Artikleid ei leitud.",
    prev: lang === "ru" ? "← Предыдущая" : lang === "en" ? "← Previous" : "← Eelmine",
    next: lang === "ru" ? "Следующая →" : lang === "en" ? "Next →" : "Järgmine →",
  };

  return (
    <>
      <PageLang lang={lang} />
      <BlogNav lang={lang} />
      <main className="flex-1">
        {/* Author hero */}
        <section className="bg-[#f9f9f7] border-b border-[#e6e6e6] py-10 sm:py-14">
          <div className="max-w-[1200px] mx-auto px-6">
            {/* Breadcrumb */}
            <nav className="text-xs text-[#9a9a9a] mb-6">
              <Link href="https://blog.ksa.ee" className="hover:text-[#87be23] transition-colors">Blog</Link>
              <span className="mx-2">›</span>
              <span>{t.author}</span>
            </nav>

            <div className="flex items-start gap-5">
              {/* Avatar placeholder */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#87be23]/20 flex items-center justify-center flex-shrink-0 text-2xl font-semibold text-[#87be23]">
                {author.displayName.charAt(0)}
              </div>

              <div>
                <span className="text-xs font-medium uppercase tracking-widest text-[#87be23]">
                  {t.author}
                </span>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1a1a1a] mt-1 mb-1">
                  {author.displayName}
                </h1>
                <p className="text-sm text-[#87be23] font-medium mb-3">{roleLabel}</p>
                <p className="text-sm text-[#5a6b6c] max-w-lg leading-relaxed">{bioText}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Language filter */}
        <section className="border-b border-[#e6e6e6] bg-white py-3">
          <div className="max-w-[1200px] mx-auto px-6 flex gap-1">
            {[
              { code: "et", label: "Eesti", count: countEt },
              { code: "ru", label: "Русский", count: countRu },
              { code: "en", label: "English", count: countEn },
            ]
              .filter(({ count }) => count > 0)
              .map(({ code, label, count }) => (
                <Link
                  key={code}
                  href={`/autor/${slug}?keel=${code}`}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    lang === code
                      ? "bg-[#1a1a1a] text-white"
                      : "bg-[#f5f3ee] text-[#5a6b6c] hover:bg-[#e8e3d3]"
                  }`}
                >
                  {label}
                  <span className="ml-1.5 text-xs opacity-50">{count}</span>
                </Link>
              ))}
          </div>
        </section>

        {/* Post grid */}
        <section className="max-w-[1200px] mx-auto px-6 py-10">
          {posts.length === 0 ? (
            <p className="text-[#9a9a9a] text-center py-20">{t.notFound}</p>
          ) : (
            <>
              <p className="text-sm text-[#9a9a9a] mb-6">
                {total} {t.articles}
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
                      href={`/autor/${slug}?keel=${lang}&leht=${page - 1}`}
                      className="px-5 py-2 rounded-full border border-[#e6e6e6] text-sm text-[#5a6b6c] hover:border-[#87be23] transition-colors"
                    >
                      {t.prev}
                    </Link>
                  )}
                  <span className="px-4 py-2 text-sm text-[#9a9a9a]">
                    {page} / {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link
                      href={`/autor/${slug}?keel=${lang}&leht=${page + 1}`}
                      className="px-5 py-2 rounded-full border border-[#e6e6e6] text-sm text-[#5a6b6c] hover:border-[#87be23] transition-colors"
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
