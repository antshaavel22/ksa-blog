import Link from "next/link";
import Image from "next/image";
import { PostMeta } from "@/lib/posts";
import { getCategoryLabel, toSlug } from "@/lib/categories";
import { BLOG_CONFIG } from "@/lib/config";
import { getAuthorByKey } from "@/lib/authors";
import { format } from "date-fns";
import { et, ru, enUS } from "date-fns/locale";

function readingTime(excerpt: string): string {
  const words = excerpt.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min`;
}

interface PostCardProps {
  post: PostMeta;
}

export default function PostCard({ post }: PostCardProps) {
  const dateLocale = post.lang === "ru" ? ru : post.lang === "en" ? enUS : et;
  const dateFormatted = post.date
    ? format(new Date(post.date), "d. MMMM yyyy", { locale: dateLocale })
    : "";
  const primaryCategoryRaw = post.categories?.[0] ?? "";
  const primaryCategory = primaryCategoryRaw
    ? getCategoryLabel(toSlug(primaryCategoryRaw), (post.lang as "et" | "ru" | "en") ?? "et")
    : "";
  const authorProfile = post.author ? getAuthorByKey(post.author) : undefined;
  const authorDisplayName = authorProfile?.displayName ?? post.author ?? "";

  return (
    <Link
      href={`/${post.slug}`}
      className="group flex flex-col bg-white rounded-[20px] border border-[#E6E4DF] overflow-hidden hover:border-[#87BE23] hover:shadow-[0_8px_32px_rgba(0,0,0,0.10)] hover:-translate-y-[3px] transition-all duration-200"
    >
      {/* Image — 3:2 ratio, warmer crop. Fallback tile when no featuredImage. */}
      {post.featuredImage ? (
        <div className="aspect-[3/2] relative overflow-hidden bg-[#F5F2EC]">
          <Image
            src={post.featuredImage}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1140px) 50vw, 380px"
            className="object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
          />
        </div>
      ) : (
        <div
          className="aspect-[3/2] relative overflow-hidden flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, #F5F2EC 0%, #E8E3D3 60%, #DCD5C0 100%)",
          }}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 120 120"
            className="w-16 h-16 opacity-60 group-hover:scale-[1.06] transition-transform duration-500"
            fill="#87BE23"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* KSA leaf motif */}
            <path d="M60 10 C30 35, 25 70, 60 110 C95 70, 90 35, 60 10 Z M60 30 C78 50, 78 75, 60 95 C42 75, 42 50, 60 30 Z" />
          </svg>
        </div>
      )}

      <div className="flex flex-col flex-1 p-6">
        {/* Category label */}
        {primaryCategory && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#87BE23] mb-2.5">
            {primaryCategory}
          </span>
        )}

        {/* Title */}
        <h2 className="text-[15px] font-semibold leading-[1.4] tracking-[-0.01em] text-[#000000] mb-2.5 group-hover:text-[#87BE23] transition-colors line-clamp-3">
          {post.title}
        </h2>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-[13px] font-light text-[#5A6B6C] leading-[1.6] line-clamp-2 mb-4 flex-1">
            {post.excerpt}
          </p>
        )}

        {/* Meta footer */}
        <div className="flex items-center justify-between mt-auto pt-3.5 border-t border-[#F0EDE8]">
          {BLOG_CONFIG.showDate && !post.hideDate && dateFormatted
            ? <span className="text-[11px] text-[#9A9A9A] font-light">{dateFormatted}</span>
            : <span />}
          <div className="flex items-center gap-3">
            {post.excerpt && (
              <span className="text-[11px] text-[#9A9A9A] font-light">{readingTime(post.excerpt)}</span>
            )}
            {BLOG_CONFIG.showAuthor && !post.hideAuthor && post.author && (
              <span className="text-[11px] text-[#9A9A9A] font-light">{authorDisplayName}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
