export const dynamic = "force-dynamic";

import { getAllPosts } from "@/lib/posts";
import BlogNav from "@/components/BlogNav";
import BlogFooter from "@/components/BlogFooter";
import PostCard from "@/components/PostCard";
import SearchPageInput from "@/components/SearchPageInput";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Otsing — KSA Blog",
  robots: { index: false },
};

interface PageProps {
  searchParams: Promise<{ q?: string; lang?: string }>;
}

const T = {
  et: {
    heading: "Otsi artikleid",
    results: (n: number, q: string) => `${n} tulemust otsingule "${q}"`,
    noResults: (q: string) => `Otsing "${q}" ei andnud tulemusi.`,
    hint: "Proovi lühemat otsingusõna.",
    allLangs: "Kõik keeled",
  },
  ru: {
    heading: "Поиск статей",
    results: (n: number, q: string) => `${n} результатов по запросу «${q}»`,
    noResults: (q: string) => `По запросу «${q}» ничего не найдено.`,
    hint: "Попробуйте более короткое слово.",
    allLangs: "Все языки",
  },
  en: {
    heading: "Search articles",
    results: (n: number, q: string) => `${n} results for "${q}"`,
    noResults: (q: string) => `No results for "${q}".`,
    hint: "Try a shorter keyword.",
    allLangs: "All languages",
  },
};

const LANG_LABELS: Record<string, string> = {
  et: "Eesti",
  ru: "Русский",
  en: "English",
};

export default async function SearchPage({ searchParams }: PageProps) {
  const { q, lang: langParam } = await searchParams;
  const query = (q ?? "").trim();
  const lang = (langParam as "et" | "ru" | "en") ?? "et";
  const t = T[lang] ?? T.et;

  const allPosts = getAllPosts();

  const results =
    query.length >= 2
      ? allPosts.filter((post) => {
          const ql = query.toLowerCase();
          return (
            post.title.toLowerCase().includes(ql) ||
            (post.excerpt ?? "").toLowerCase().includes(ql) ||
            post.categories?.some((c) => c.toLowerCase().includes(ql)) ||
            post.tags?.some((t) => t.toLowerCase().includes(ql))
          );
        })
      : [];

  return (
    <>
      <BlogNav lang={lang} />
      <main className="flex-1">
        {/* Search hero */}
        <section className="bg-[#E8E3D3] border-b border-[#D8D3C8] py-10 sm:py-14">
          <div className="max-w-[1140px] mx-auto px-6">
            <h1 className="text-[1.5rem] sm:text-[1.75rem] font-semibold tracking-[-0.03em] text-[#000000] mb-5">
              {t.heading}
            </h1>
            <Suspense>
              <SearchPageInput lang={lang} initialQuery={query} />
            </Suspense>

            {/* Language filter */}
            <div className="flex gap-2 mt-4 flex-wrap">
              {["et", "ru", "en"].map((code) => (
                <Link
                  key={code}
                  href={`/otsing?lang=${code}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                  className={`px-4 py-1.5 rounded-[32px] text-[13px] font-medium transition-colors ${
                    lang === code
                      ? "bg-[#000000] text-white"
                      : "bg-white/60 text-[#5A6B6C] hover:bg-white hover:text-[#000000]"
                  }`}
                >
                  {LANG_LABELS[code]}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="max-w-[1140px] mx-auto px-6 py-10">
          {query.length >= 2 ? (
            results.length > 0 ? (
              <>
                <p className="text-[12px] font-light text-[#9A9A9A] mb-7 tracking-wide">
                  {t.results(results.length, query)}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {results.map((post) => (
                    <PostCard key={post.slug} post={post} />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-24">
                <p className="text-[#1a1a1a] font-medium mb-2">{t.noResults(query)}</p>
                <p className="text-[#9a9a9a] text-sm font-light">{t.hint}</p>
              </div>
            )
          ) : (
            <div className="text-center py-24 text-[#9a9a9a] font-light text-sm">
              {lang === "ru" ? "Введите слово для поиска." : lang === "en" ? "Type a word to search." : "Sisesta otsingusõna."}
            </div>
          )}
        </section>
      </main>
      <BlogFooter lang={lang} />
    </>
  );
}
