import { getAllPosts, getPostBySlug, getRelatedPosts, getSisterPosts } from "@/lib/posts";
import BlogNav from "@/components/BlogNav";
import BlogFooter from "@/components/BlogFooter";
import KiirtestCTA from "@/components/KiirtestCTA";
import BlogBookingCTA from "@/components/BlogBookingCTA";
import RelatedPosts from "@/components/RelatedPosts";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import ShareButton from "@/components/ShareButton";
import AuthorBio from "@/components/AuthorBio";
import PageLang from "@/components/PageLang";
import { BLOG_CONFIG } from "@/lib/config";
import { getAuthorByKey } from "@/lib/authors";
import { getCategoryLabel, toSlug } from "@/lib/categories";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { format } from "date-fns";
import { et, ru, enUS } from "date-fns/locale";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ISR: pre-build all existing posts, but also render new ones on-demand.
// A freshly published post is served within seconds of the first visit —
// no need to wait for a full Vercel rebuild.
export const dynamicParams = true;
export const revalidate = 120; // rebuild cached pages every 2 min in background

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  // Make featuredImage URL absolute for OG tags
  const ogImage = post.featuredImage
    ? post.featuredImage.startsWith("http")
      ? post.featuredImage
      : `https://blog.ksa.ee${post.featuredImage}`
    : "https://ksa.ee/wp-content/uploads/2024/09/ksa-silmanipid.png";

  return {
    title: post.seoTitle ?? post.title,
    description: post.seoExcerpt ?? post.excerpt,
    openGraph: {
      title: post.seoTitle ?? post.title,
      description: post.seoExcerpt ?? post.excerpt,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "article",
      publishedTime: post.date,
      locale: post.lang === "ru" ? "ru_RU" : post.lang === "en" ? "en_GB" : "et_EE",
    },
    alternates: {
      canonical: `https://blog.ksa.ee/${slug}`,
      languages: Object.fromEntries([
        [post.lang ?? "et", `https://blog.ksa.ee/${slug}`],
        ...getSisterPosts(post).map((s) => [s.lang, `https://blog.ksa.ee/${s.slug}`]),
      ]),
    },
    other: {
      "content-language": post.lang ?? "et",
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(post, 3);
  const dateLocale = post.lang === "ru" ? ru : post.lang === "en" ? enUS : et;
  const dateFormatted = post.date
    ? format(new Date(post.date), "d. MMMM yyyy", { locale: dateLocale })
    : "";

  const canonicalUrl = `https://blog.ksa.ee/${slug}`;
  const authorProfile = post.author ? getAuthorByKey(post.author) : undefined;
  const authorName = authorProfile?.displayName ?? post.author ?? "KSA Silmakeskus";
  const reviewerProfile = post.expertReviewer ? getAuthorByKey(post.expertReviewer) : undefined;

  // ── Schema JSON-LD ──────────────────────────────────────────────────────────
  const schemaGraph: object[] = [
    {
      "@type": "BlogPosting",
      "@id": canonicalUrl,
      headline: post.seoTitle ?? post.title,
      description: post.seoExcerpt ?? post.excerpt,
      datePublished: post.date,
      dateModified: post.date,
      inLanguage: post.lang,
      url: canonicalUrl,
      author: {
        "@type": "Person",
        name: authorName,
      },
      publisher: {
        "@type": "Organization",
        name: "KSA Silmakeskus",
        url: "https://ksa.ee",
        logo: {
          "@type": "ImageObject",
          url: "https://ksa.ee/wp-content/themes/ksa/images/ksa-logo.svg",
        },
      },
      ...(post.featuredImage
        ? { image: { "@type": "ImageObject", url: post.featuredImage } }
        : {}),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "KSA Blog",
          item: "https://blog.ksa.ee",
        },
        ...(post.categories[0]
          ? [
              {
                "@type": "ListItem",
                position: 2,
                name: post.categories[0],
                item: `https://blog.ksa.ee/kategooria/${post.categories[0]
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: post.title,
              },
            ]
          : [
              {
                "@type": "ListItem",
                position: 2,
                name: post.title,
              },
            ]),
      ],
    },
  ];

  // FAQPage schema — only when post has faqItems
  if (post.faqItems && post.faqItems.length > 0) {
    schemaGraph.push({
      "@type": "FAQPage",
      mainEntity: post.faqItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    });
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": schemaGraph,
  };

  return (
    <>
      {/* Schema JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Tell the browser the page language so CookieBanner localizes correctly */}
      <PageLang lang={post.lang} />

      <BlogNav lang={post.lang} />
      <main className="flex-1">
        <article className="max-w-[680px] mx-auto px-6 py-10">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-[#9a9a9a] mb-8">
            <Link href="https://blog.ksa.ee" className="hover:text-[#87be23] transition-colors">Blog</Link>
            {post.categories[0] && (
              <>
                <span>›</span>
                <Link
                  href={`/kategooria/${toSlug(post.categories[0])}`}
                  className="hover:text-[#87be23] transition-colors"
                >
                  {getCategoryLabel(toSlug(post.categories[0]), (post.lang as "et" | "ru" | "en") ?? "et")}
                </Link>
              </>
            )}
          </nav>

          {/* Header */}
          <header className="mb-8">
            {post.categories[0] && (
              <span className="text-xs font-medium uppercase tracking-wide text-[#87be23] block mb-3">
                {getCategoryLabel(toSlug(post.categories[0]), (post.lang as "et" | "ru" | "en") ?? "et")}
              </span>
            )}
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1a1a1a] leading-tight mb-4">
              {post.title}
            </h1>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 text-sm text-[#9a9a9a]">
                {BLOG_CONFIG.showDate && !post.hideDate && dateFormatted && (
                  <span>{dateFormatted}</span>
                )}
                {BLOG_CONFIG.showAuthor && !post.hideAuthor && post.author && (
                  <>
                    <span>·</span>
                    {authorProfile ? (
                      <Link
                        href={`/autor/${authorProfile.slug}`}
                        className="hover:text-[#87be23] transition-colors"
                      >
                        {authorName}
                      </Link>
                    ) : (
                      <span>{authorName}</span>
                    )}
                  </>
                )}
                {post.content && (
                  <>
                    <span>·</span>
                    <span>{Math.max(1, Math.round(post.content.trim().split(/\s+/).length / 200))} min</span>
                  </>
                )}
              </div>
              <ShareButton title={post.title} url={canonicalUrl} lang={post.lang} />
            </div>
          </header>

          {/* Featured image */}
          {post.featuredImage && (
            <div className="aspect-[16/9] relative rounded-xl overflow-hidden mb-8 bg-[#f5f3ee]">
              <Image
                src={post.featuredImage}
                alt={post.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 680px) 100vw, 680px"
              />
            </div>
          )}

          {/* Inline CTA before content (Rule 1 — laser/ICB/Flow posts) */}
          {post.ctaType === "kiirtest-inline" && (
            <KiirtestCTA ctaType="kiirtest-inline" lang={post.lang} />
          )}

          {/* Post content */}
          <div className="prose-ksa">
            <MDXRemote source={post.content} components={{ YouTubeEmbed }} />
          </div>

          {/* LLM search queries — hidden visually, readable by crawlers & AI agents */}
          {post.llmSearchQueries && post.llmSearchQueries.length > 0 && (
            <div className="sr-only" aria-hidden="true">
              {post.llmSearchQueries.map((q, i) => (
                <span key={i}>{q}</span>
              ))}
            </div>
          )}

          {/* Author bio card */}
          {authorProfile && (
            <AuthorBio
              author={authorProfile}
              lang={(post.lang as "et" | "ru" | "en") ?? "et"}
              variant="author"
            />
          )}

          {/* Expert reviewer bio card (optometrist or guest expert) */}
          {reviewerProfile && (
            <AuthorBio
              author={reviewerProfile}
              lang={(post.lang as "et" | "ru" | "en") ?? "et"}
              variant="reviewer"
            />
          )}

          {/* Flow3 footer CTA — shown on all posts */}
          <BlogBookingCTA lang={post.lang} />

          {/* Medical review notice */}
          {post.medicalReview && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              {post.lang === "ru"
                ? "Содержание этой статьи проверено специалистами глазного центра KSA."
                : post.lang === "en"
                ? "The content of this article has been medically reviewed by KSA Vision Clinic specialists."
                : "Selle artikli sisu on meditsiiniliselt kontrollitud KSA Silmakeskuse spetsialistide poolt."}
            </div>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-xs bg-[#f5f3ee] text-[#5a6b6c] rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </article>

        {/* Related posts */}
        <div className="max-w-[1200px] mx-auto px-6 pb-16">
          <RelatedPosts posts={related} lang={post.lang} />
        </div>
      </main>
      <BlogFooter lang={post.lang} />
    </>
  );
}
