import Link from "next/link";
import Image from "next/image";
import { PostMeta } from "@/lib/posts";
import { getCategoryLabel, toSlug } from "@/lib/categories";
import { BLOG_CONFIG } from "@/lib/config";
import { format } from "date-fns";
import { et, ru, enUS } from "date-fns/locale";

interface PostCardProps {
  post: PostMeta;
  /** Featured posts get the 16:9 wide card with larger type. */
  large?: boolean;
}

export default function PostCard({ post, large = false }: PostCardProps) {
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
      className="group block h-full"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        className="flex h-full flex-col overflow-hidden transition-[border-color] duration-200"
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 18,
        }}
      >
        <div
          className="overflow-hidden"
          style={{
            aspectRatio: large ? "16/9" : "4/3",
            background: "var(--beige-light)",
          }}
        >
          {post.featuredImage ? (
            <Image
              src={post.featuredImage}
              alt={post.title}
              width={large ? 1280 : 640}
              height={large ? 720 : 480}
              sizes={large ? "(max-width: 1280px) 100vw, 1280px" : "(max-width: 900px) 50vw, 400px"}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              style={{ display: "block", objectPosition: post.imageFocalPoint || "50% 30%" }}
              priority={large}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              aria-hidden="true"
              style={{
                background:
                  "linear-gradient(135deg, var(--lime-wash) 0%, var(--beige-light) 100%)",
              }}
            >
              <svg
                viewBox="0 0 120 120"
                width={large ? 96 : 64}
                height={large ? 96 : 64}
                fill="var(--lime)"
                style={{ opacity: 0.55 }}
              >
                <path d="M60 10 C30 35, 25 70, 60 110 C95 70, 90 35, 60 10 Z M60 30 C78 50, 78 75, 60 95 C42 75, 42 50, 60 30 Z" />
              </svg>
            </div>
          )}
        </div>

        <div
          className="flex flex-1 flex-col"
          style={{
            padding: large ? "28px 32px 32px" : "22px 24px 26px",
            gap: 12,
          }}
        >
          {primaryCategory && (
            <div
              style={{
                fontSize: large ? 11 : 10,
                letterSpacing: "0.14em",
                color: "var(--lime-dark)",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              {primaryCategory}
            </div>
          )}

          <h3
            style={{
              fontSize: large ? 28 : 19,
              fontWeight: 500,
              lineHeight: large ? 1.15 : 1.28,
              letterSpacing: "-0.018em",
              margin: 0,
              color: "var(--ink)",
            }}
          >
            {post.title}
          </h3>

          {post.excerpt && (
            <p
              style={{
                fontSize: large ? 16 : 14,
                color: "var(--ink-60)",
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              {post.excerpt}
            </p>
          )}

          <div
            className="flex items-center justify-between"
            style={{
              marginTop: "auto",
              paddingTop: 8,
              fontSize: 12,
              color: "var(--ink-40)",
            }}
          >
            {BLOG_CONFIG.showDate && !post.hideDate && dateFormatted ? (
              <span>{dateFormatted}</span>
            ) : (
              <span />
            )}
            <span />
          </div>
        </div>
      </div>
    </Link>
  );
}
