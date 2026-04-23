import { PostMeta } from "@/lib/posts";
import { getCategoryLabel, toSlug } from "@/lib/categories";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { et, ru, enUS } from "date-fns/locale";

interface RelatedPostsProps {
  posts: PostMeta[];
  lang?: "et" | "ru" | "en";
}

const EYEBROW: Record<string, string> = { et: "Loe edasi", ru: "Читайте далее", en: "Keep reading" };
const HEADING: Record<string, string> = { et: "Seotud artiklid", ru: "Похожие статьи", en: "Related articles" };
const ALL_LINK: Record<string, string> = { et: "Kõik artiklid", ru: "Все статьи", en: "All articles" };

export default function RelatedPosts({ posts, lang = "et" }: RelatedPostsProps) {
  if (posts.length === 0) return null;

  return (
    <section style={{ padding: "72px 0 96px" }}>
      <div className="mx-auto" style={{ maxWidth: "var(--container)", padding: "0 40px" }}>
        <div className="flex items-baseline justify-between" style={{ marginBottom: 32 }}>
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                color: "var(--lime-dark)",
                fontWeight: 600,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              {EYEBROW[lang] ?? EYEBROW.et}
            </div>
            <h2
              style={{
                fontSize: 36,
                letterSpacing: "-0.025em",
                fontWeight: 400,
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              {HEADING[lang] ?? HEADING.et}
            </h2>
          </div>
          <Link
            href={lang === "et" ? "/" : `/?keel=${lang}`}
            className="inline-flex items-center gap-1.5"
            style={{ fontSize: 14, color: "var(--ink-60)" }}
          >
            {ALL_LINK[lang] ?? ALL_LINK.et}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}
        >
          {posts.map((post) => (
            <RelatedCard key={post.slug} post={post} lang={lang} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RelatedCard({ post, lang }: { post: PostMeta; lang: string }) {
  const primaryCategoryRaw = post.categories?.[0] ?? "";
  const categoryLabel = primaryCategoryRaw
    ? getCategoryLabel(toSlug(primaryCategoryRaw), lang as "et" | "ru" | "en")
    : null;
  const dateLocale = lang === "ru" ? ru : lang === "en" ? enUS : et;
  const dateFormatted = post.date
    ? format(new Date(post.date), "d. MMMM yyyy", { locale: dateLocale })
    : "";

  return (
    <Link href={`/${post.slug}`} className="group block h-full" style={{ color: "inherit" }}>
      <div
        className="flex h-full flex-col overflow-hidden transition-[border-color] duration-200"
        style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16 }}
      >
        <div className="overflow-hidden" style={{ aspectRatio: "4/3", background: "var(--beige-light)" }}>
          {post.featuredImage ? (
            <Image
              src={post.featuredImage}
              alt={post.title}
              width={480}
              height={360}
              sizes="(max-width: 900px) 50vw, 400px"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              style={{ display: "block" }}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: "linear-gradient(135deg, var(--lime-wash) 0%, var(--beige-light) 100%)",
              }}
            />
          )}
        </div>
        <div
          className="flex flex-1 flex-col"
          style={{ padding: "20px 22px 24px", gap: 10 }}
        >
          {categoryLabel && (
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                color: "var(--lime-dark)",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              {categoryLabel}
            </div>
          )}
          <h3
            style={{
              fontSize: 18,
              fontWeight: 500,
              lineHeight: 1.28,
              letterSpacing: "-0.015em",
              margin: 0,
            }}
          >
            {post.title}
          </h3>
          {post.excerpt && (
            <p style={{ fontSize: 13, color: "var(--ink-60)", lineHeight: 1.55, margin: 0 }}>
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
            <span>{dateFormatted}</span>
            <span />
          </div>
        </div>
      </div>
    </Link>
  );
}
