import { getAllPosts, getPostBySlug, getRelatedPosts } from "@/lib/posts";
import BlogNav from "@/components/BlogNav";
import BlogFooter from "@/components/BlogFooter";
import KiirtestCTA from "@/components/KiirtestCTA";
import BlogBookingCTA from "@/components/BlogBookingCTA";
import BlogContactForm from "@/components/BlogContactForm";
import RelatedPosts from "@/components/RelatedPosts";
import YouTubeEmbed from "@/components/YouTubeEmbed";
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

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.seoTitle ?? post.title,
    description: post.seoExcerpt ?? post.excerpt,
    openGraph: {
      title: post.seoTitle ?? post.title,
      description: post.seoExcerpt ?? post.excerpt,
      images: post.featuredImage ? [{ url: post.featuredImage }] : [],
      type: "article",
      publishedTime: post.date,
    },
    alternates: {
      canonical: `https://blog.ksa.ee/${slug}`,
    },
  };
}

// Map internal author keys → display names for Schema
const AUTHOR_NAMES: Record<string, string> = {
  antsh: "Dr. Ants Haavel",
  silvia: "Silvia Haavel",
  yana: "Yana Grechits",
  maigret: "Maigret Moru",
  ndhaldur: "KSA Silmakeskus",
};

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
  const authorName = AUTHOR_NAMES[post.author] ?? post.author ?? "KSA Silmakeskus";

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
          name: "KSA Blogi",
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

      <BlogNav />
      <main className="flex-1">
        <article className="max-w-[680px] mx-auto px-6 py-10">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-[#9a9a9a] mb-8">
            <Link href="/" className="hover:text-[#87be23] transition-colors">Blogi</Link>
            {post.categories[0] && (
              <>
                <span>›</span>
                <Link
                  href={`/kategooria/${post.categories[0].toLowerCase().replace(/\s+/g, "-")}`}
                  className="hover:text-[#87be23] transition-colors"
                >
                  {post.categories[0]}
                </Link>
              </>
            )}
          </nav>

          {/* Header */}
          <header className="mb-8">
            {post.categories[0] && (
              <span className="text-xs font-medium uppercase tracking-wide text-[#87be23] block mb-3">
                {post.categories[0]}
              </span>
            )}
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1a1a1a] leading-tight mb-4">
              {post.title}
            </h1>
            <div className="flex items-center gap-3 text-sm text-[#9a9a9a]">
              {dateFormatted && <span>{dateFormatted}</span>}
              {post.author && (
                <>
                  <span>·</span>
                  <span>{authorName}</span>
                </>
              )}
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

          {/* Soft booking CTA with promo code — shown on all posts */}
          <BlogBookingCTA lang={post.lang} />

          {/* Contact form */}
          <BlogContactForm lang={post.lang} />

          {/* Medical review notice */}
          {post.medicalReview && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              Selle artikli sisu on meditsiiniliselt kontrollitud KSA Silmakeskuse spetsialistide poolt.
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
      <BlogFooter />
    </>
  );
}
