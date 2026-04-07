import { PostMeta } from "@/lib/posts";
import { getCategoryLabel, toSlug } from "@/lib/categories";
import Image from "next/image";
import Link from "next/link";

interface RelatedPostsProps {
  posts: PostMeta[];
  lang?: "et" | "ru" | "en";
}

const HEADING: Record<string, string> = {
  et: "Loe edasi",
  ru: "Читайте также",
  en: "Keep reading",
};

const READ_MORE: Record<string, string> = {
  et: "Loe →",
  ru: "Читать →",
  en: "Read →",
};

export default function RelatedPosts({ posts, lang = "et" }: RelatedPostsProps) {
  if (posts.length === 0) return null;

  return (
    <section className="mt-14 pt-10 border-t border-[#e6e6e6]">
      {/* Heading with decorative line */}
      <div className="flex items-baseline gap-3 mb-6">
        <h2 className="text-[1.05rem] font-bold text-[#1a1a1a] m-0 tracking-tight shrink-0">
          {HEADING[lang] ?? HEADING.et}
        </h2>
        <div className="flex-1 h-px bg-[#f0f0ec]" />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => (
          <RelatedCard key={post.slug} post={post} lang={lang} />
        ))}
      </div>
    </section>
  );
}

function RelatedCard({ post, lang }: { post: PostMeta; lang: string }) {
  const categoryLabel = post.categories?.[0]
    ? getCategoryLabel(toSlug(post.categories[0]), (lang as "et" | "ru" | "en"))
    : null;

  const readingTime = post.excerpt
    ? Math.max(1, Math.round(post.excerpt.split(/\s+/).length / 40))
    : 2;

  return (
    <Link href={`/${post.slug}`} className="group block no-underline">
      <article className="
        flex flex-col h-full rounded-2xl border border-[#ebebeb] bg-white overflow-hidden
        transition-all duration-200
        group-hover:border-[#d4e8a8] group-hover:shadow-[0_8px_28px_rgba(0,0,0,0.08)] group-hover:-translate-y-0.5
      ">
        {/* Thumbnail — 3:2 ratio */}
        <div className="relative w-full shrink-0 bg-[#f5f2ec] overflow-hidden" style={{ aspectRatio: "3/2" }}>
          {post.featuredImage ? (
            <Image
              src={post.featuredImage}
              alt={post.title}
              fill
              sizes="(max-width: 640px) 100vw, 280px"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#f0fce8] to-[#e8f5d4]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c5e58a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M20.188 10.934c.388.472.612.989.612 1.566s-.224 1.094-.612 1.566C18.768 15.693 15.636 18 12 18s-6.768-2.307-8.188-3.934A2.862 2.862 0 0 1 3.2 12.5c0-.577.224-1.094.612-1.566C5.232 8.307 8.364 6 12 6s6.768 2.307 8.188 3.934z" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 px-4 pt-3.5 pb-4">
          {/* Category */}
          {categoryLabel && (
            <span className="text-[0.65rem] font-bold tracking-[0.08em] uppercase text-[#87be23] mb-1 block">
              {categoryLabel}
            </span>
          )}

          {/* Title */}
          <h3 className="text-[0.875rem] font-bold leading-snug text-[#1a1a1a] mb-auto line-clamp-3 m-0">
            {post.title}
          </h3>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3">
            <span className="text-[0.7rem] text-[#c0bdb8]">{readingTime} min</span>
            <span className="text-[0.75rem] font-bold text-[#87be23] group-hover:underline">
              {READ_MORE[lang] ?? READ_MORE.et}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
