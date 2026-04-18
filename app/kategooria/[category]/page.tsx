import { getAllCategories, getPostsByCategory } from "@/lib/posts";
import PostCard from "@/components/PostCard";
import BlogNav from "@/components/BlogNav";
import BlogFooter from "@/components/BlogFooter";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  const categories = getAllCategories();
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const posts = getPostsByCategory(category);
  if (posts.length === 0) return {};
  return {
    title: `${category.replace(/-/g, " ")} — KSA Blog`,
    description: `${posts.length} artiklit kategoorias ${category.replace(/-/g, " ")}. KSA Silmakeskuse ekspertartiklid.`,
    alternates: { canonical: `https://blog.ksa.ee/kategooria/${category}` },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { category } = await params;
  const posts = getPostsByCategory(category);
  if (posts.length === 0) notFound();

  const displayName = category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Majority language of posts in this category → page chrome language
  const langCounts = posts.reduce<Record<string, number>>((acc, p) => {
    const l = p.lang ?? "et";
    acc[l] = (acc[l] ?? 0) + 1;
    return acc;
  }, {});
  const lang = (Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "et") as "et" | "ru" | "en";
  const articlesLabel = lang === "ru" ? "статей" : lang === "en" ? "articles" : "artiklit";

  return (
    <>
      <BlogNav lang={lang} />
      <main className="flex-1">
        <section className="bg-[#f9f9f7] border-b border-[#e6e6e6] py-12">
          <div className="max-w-[1200px] mx-auto px-6">
            <nav className="text-xs text-[#9a9a9a] mb-3">
              <Link href="https://blog.ksa.ee" className="hover:text-[#87be23] transition-colors">Blog</Link>
              <span className="mx-2">›</span>
              <span>{displayName}</span>
            </nav>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a] mb-2">
              {displayName}
            </h1>
            <p className="text-[#5a6b6c] text-sm">{posts.length} {articlesLabel}</p>
          </div>
        </section>

        <section className="max-w-[1200px] mx-auto px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      </main>
      <BlogFooter lang={lang} />
    </>
  );
}
