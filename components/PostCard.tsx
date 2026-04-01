import Link from "next/link";
import Image from "next/image";
import { PostMeta } from "@/lib/posts";
import { getCategoryLabel, toSlug } from "@/lib/categories";
import { format } from "date-fns";
import { et, ru, enUS } from "date-fns/locale";

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

  return (
    <Link
      href={`/${post.slug}`}
      className="group flex flex-col bg-white rounded-xl border border-[#e6e6e6] overflow-hidden hover:border-[#87be23] hover:shadow-sm transition-all duration-200"
    >
      {post.featuredImage && (
        <div className="aspect-[16/9] relative overflow-hidden bg-[#f5f3ee]">
          <Image
            src={post.featuredImage}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="flex flex-col flex-1 p-5">
        {primaryCategory && (
          <span className="text-xs font-medium uppercase tracking-wide text-[#87be23] mb-2">
            {primaryCategory}
          </span>
        )}
        <h2 className="text-base font-semibold leading-snug text-[#1a1a1a] mb-2 group-hover:text-[#87be23] transition-colors line-clamp-3">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-sm text-[#5a6b6c] line-clamp-2 mb-4 flex-1">
            {post.excerpt}
          </p>
        )}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#f0eeea]">
          <span className="text-xs text-[#9a9a9a]">{dateFormatted}</span>
          {post.author && (
            <span className="text-xs text-[#9a9a9a]">{post.author}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
