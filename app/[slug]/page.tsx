import { getAdjacentPosts, getAllPosts, getPostBySlug, getRelatedPosts, getSisterPosts } from "@/lib/posts";
import KeyboardNav from "@/components/KeyboardNav";
import BlogNav from "@/components/BlogNav";
import BlogFooter from "@/components/BlogFooter";
import SmartCTA from "@/components/SmartCTA";
import BlogAnalytics from "@/components/BlogAnalytics";
import RelatedPosts from "@/components/RelatedPosts";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import VimeoEmbed from "@/components/VimeoEmbed";
import RendiaEmbed from "@/components/RendiaEmbed";
import ShareButton from "@/components/ShareButton";
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

export const dynamicParams = true;
export const revalidate = 120;

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  const ogImage = post.featuredImage
    ? post.featuredImage.startsWith("http")
      ? post.featuredImage
      : `https://blog.ksa.ee${post.featuredImage}`
    : "https://ksa.ee/wp-content/uploads/2024/09/ksa-silmanipid.png";

  const title = post.seoTitle ?? post.title;
  const description = post.seoExcerpt ?? post.excerpt;

  // Build hreflang map: only include existing language versions + x-default (et).
  const currentUrl = `https://blog.ksa.ee/${slug}`;
  const langMap: Record<string, string> = {
    [post.lang ?? "et"]: currentUrl,
  };
  for (const s of getSisterPosts(post)) {
    if (s.lang && !langMap[s.lang]) {
      langMap[s.lang] = `https://blog.ksa.ee/${s.slug}`;
    }
  }
  // x-default points to ET version (use current if post is ET, else the ET sister).
  langMap["x-default"] = langMap.et ?? currentUrl;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
      type: "article",
      publishedTime: post.date,
      locale: post.lang === "ru" ? "ru_RU" : post.lang === "en" ? "en_GB" : "et_EE",
      url: currentUrl,
      siteName: "KSA Blogi",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: currentUrl,
      languages: langMap,
    },
    other: { "content-language": post.lang ?? "et" },
  };
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "KSA";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const AUTHOR_EYEBROW: Record<string, string> = { et: "Autor", ru: "Автор", en: "Author" };
const READ_MORE_CTA: Record<string, string> = { et: "Vaata kõiki artikleid →", ru: "Все статьи автора →", en: "See all articles →" };
const READ_MIN: Record<string, string> = { et: "min lugemist", ru: "мин чтения", en: "min read" };

function readMinutes(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
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
  const lang = (post.lang ?? "et") as "et" | "ru" | "en";
  const canonicalUrl = `https://blog.ksa.ee/${slug}`;
  const authorProfile = post.author ? getAuthorByKey(post.author) : undefined;
  const authorName = authorProfile?.displayName ?? post.author ?? "KSA Silmakeskus";
  const authorInitials = initialsFrom(authorName);
  const authorRole = authorProfile?.role?.[lang] ?? "KSA Silmakeskus";
  const authorBio = authorProfile?.bio?.[lang] ?? "";
  const authorUrl = authorProfile ? `/autor/${authorProfile.slug}` : null;
  const primaryCategoryRaw = post.categories[0] ?? "";
  const primaryCategoryLabel = primaryCategoryRaw
    ? getCategoryLabel(toSlug(primaryCategoryRaw), lang)
    : "";
  const readMin = readMinutes(post.content);
  const resolvedFunnel =
    post.funnel ??
    (post.ctaType === "kiirtest-inline" || post.ctaType === "kiirtest-soft"
      ? "flow3"
      : "general");

  // Reviewer: explicit `reviewedBy` key, else fall back to author.
  const reviewerProfile = post.reviewedBy
    ? getAuthorByKey(post.reviewedBy)
    : authorProfile;
  const reviewerName = reviewerProfile?.displayName ?? authorName;
  const reviewerRole = reviewerProfile?.role?.[lang];
  const reviewerCreds = reviewerProfile?.credentials?.[lang];

  function personNode(profile: typeof authorProfile, name: string): object {
    const node: Record<string, unknown> = { "@type": "Person", name };
    if (profile?.profileUrl) node.url = profile.profileUrl;
    if (profile?.role?.[lang]) node.jobTitle = profile.role[lang];
    if (profile?.credentials?.[lang]) {
      node.hasCredential = {
        "@type": "EducationalOccupationalCredential",
        credentialCategory: profile.credentials[lang],
      };
    }
    return node;
  }

  const schemaGraph: object[] = [
    {
      "@type": ["BlogPosting", "MedicalWebPage"],
      "@id": canonicalUrl,
      headline: post.seoTitle ?? post.title,
      description: post.seoExcerpt ?? post.excerpt,
      datePublished: post.date,
      dateModified: post.date,
      inLanguage: post.lang,
      url: canonicalUrl,
      author: personNode(authorProfile, authorName),
      reviewedBy: personNode(reviewerProfile, reviewerName),
      lastReviewed: post.date,
      publisher: {
        "@type": "MedicalOrganization",
        name: "KSA Silmakeskus",
        url: "https://ksa.ee",
        logo: { "@type": "ImageObject", url: "https://ksa.ee/wp-content/themes/ksa/images/ksa-logo.svg" },
      },
      ...(post.featuredImage ? { image: { "@type": "ImageObject", url: post.featuredImage } } : {}),
      ...(post.medicalTopic
        ? {
            about: {
              "@type": post.medicalTopicType ?? "MedicalCondition",
              name: post.medicalTopic,
            },
          }
        : {}),
      ...(reviewerRole || reviewerCreds
        ? {
            reviewedByAffiliation: {
              "@type": "MedicalOrganization",
              name: "KSA Silmakeskus",
            },
          }
        : {}),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "KSA Blog", item: "https://blog.ksa.ee" },
        ...(primaryCategoryRaw
          ? [
              { "@type": "ListItem", position: 2, name: primaryCategoryRaw, item: `https://blog.ksa.ee/kategooria/${toSlug(primaryCategoryRaw)}` },
              { "@type": "ListItem", position: 3, name: post.title },
            ]
          : [{ "@type": "ListItem", position: 2, name: post.title }]),
      ],
    },
  ];
  if (post.faqItems && post.faqItems.length > 0) {
    schemaGraph.push({
      "@type": "FAQPage",
      mainEntity: post.faqItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
  }
  const jsonLd = { "@context": "https://schema.org", "@graph": schemaGraph };

  const { prev, next } = getAdjacentPosts(post);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageLang lang={post.lang} />
      <KeyboardNav prevSlug={prev?.slug ?? null} nextSlug={next?.slug ?? null} />
      <BlogNav lang={post.lang} />

      <main className="flex-1">
        {/* ── Article header ── */}
        <header style={{ padding: "72px 0 48px", borderBottom: "1px solid var(--line)" }}>
          <div className="mx-auto" style={{ maxWidth: 720, padding: "0 24px" }}>
            <div
              className="flex items-center"
              style={{ gap: 12, fontSize: 12, color: "var(--ink-40)", marginBottom: 20 }}
            >
              <Link href={lang === "et" ? "/" : `/?keel=${lang}`} style={{ color: "var(--ink-40)" }}>
                {lang === "ru" ? "Блог" : lang === "en" ? "Blog" : "Blogi"}
              </Link>
              {primaryCategoryLabel && (
                <>
                  <span>›</span>
                  <Link
                    href={`/kategooria/${toSlug(primaryCategoryRaw)}`}
                    style={{
                      color: "var(--lime-dark)",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    {primaryCategoryLabel}
                  </Link>
                </>
              )}
            </div>

            <h1
              style={{
                fontSize: "clamp(40px, 5.5vw, 64px)",
                lineHeight: 1.04,
                letterSpacing: "-0.035em",
                fontWeight: 400,
                margin: "0 0 28px",
              }}
            >
              {post.title}
            </h1>

            {post.excerpt && (
              <p
                style={{
                  fontSize: 19,
                  color: "var(--ink-60)",
                  lineHeight: 1.55,
                  margin: "0 0 36px",
                  maxWidth: 640,
                  letterSpacing: "-0.005em",
                }}
              >
                {post.excerpt}
              </p>
            )}

            <div
              className="flex items-center"
              style={{
                gap: 16,
                paddingTop: 24,
                borderTop: "1px solid var(--line)",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, var(--lime-wash) 0%, var(--beige-light) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 500,
                  color: "var(--ink-60)",
                  border: "1px solid var(--line)",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {authorProfile?.avatarUrl ? (
                  <Image
                    src={authorProfile.avatarUrl}
                    alt={authorName}
                    width={48}
                    height={48}
                    style={{ objectFit: "cover", width: "100%", height: "100%" }}
                  />
                ) : (
                  authorInitials
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
                  {authorUrl ? (
                    <Link href={authorUrl} style={{ color: "inherit" }}>
                      {authorName}
                    </Link>
                  ) : (
                    authorName
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-40)", marginTop: 2 }}>
                  {authorRole}
                </div>
              </div>
              <div
                className="flex flex-col items-end"
                style={{ fontSize: 12, color: "var(--ink-40)", gap: 3 }}
              >
                {BLOG_CONFIG.showDate && !post.hideDate && dateFormatted && (
                  <span>{dateFormatted}</span>
                )}
                <span>
                  {readMin} {READ_MIN[lang]}
                </span>
              </div>
              <div style={{ marginLeft: 4 }}>
                <ShareButton title={post.title} url={canonicalUrl} lang={post.lang} />
              </div>
            </div>
          </div>
        </header>

        {/* ── Featured image ── */}
        {post.featuredImage && (
          <figure style={{ margin: 0, padding: "56px 0 16px" }}>
            <div
              className="mx-auto"
              style={{ maxWidth: "var(--container)", padding: "0 var(--gutter)" }}
            >
              <div
                style={{
                  overflow: "hidden",
                  borderRadius: 20,
                  background: "var(--beige-light)",
                }}
              >
                <Image
                  src={post.featuredImage}
                  alt={post.title}
                  width={1280}
                  height={720}
                  priority
                  sizes="(max-width: 1280px) 100vw, 1280px"
                  style={{
                    width: "100%",
                    height: "clamp(340px, 60vh, 620px)",
                    objectFit: "cover",
                    objectPosition: post.imageFocalPoint || "50% 30%",
                    display: "block",
                  }}
                />
              </div>
            </div>
          </figure>
        )}

        {/* ── Body ── */}
        <article className="prose-v2" style={{ padding: "40px 0 72px" }}>
          <div className="mx-auto" style={{ maxWidth: 720, padding: "0 24px" }}>
            <MDXRemote
              source={post.content}
              components={{ YouTubeEmbed, VimeoEmbed, RendiaEmbed }}
            />

            {post.llmSearchQueries && post.llmSearchQueries.length > 0 && (
              <div className="sr-only" aria-hidden="true">
                {post.llmSearchQueries.map((q, i) => (
                  <span key={i}>{q}</span>
                ))}
              </div>
            )}

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap" style={{ marginTop: 32, gap: 8 }}>
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: "5px 12px",
                      fontSize: 12,
                      background: "var(--beige-light)",
                      color: "var(--ink-60)",
                      borderRadius: 999,
                      border: "1px solid var(--line)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </article>

        {/* ── Author card ── */}
        {authorProfile && authorBio && (
          <section
            style={{
              padding: "48px 0",
              borderTop: "1px solid var(--line)",
              borderBottom: "1px solid var(--line)",
              background: "var(--beige-light)",
            }}
          >
            <div className="mx-auto" style={{ maxWidth: 720, padding: "0 24px" }}>
              <div
                className="grid items-start"
                style={{ gridTemplateColumns: "80px 1fr", gap: 20 }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, var(--lime-wash) 0%, var(--beige) 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    fontWeight: 400,
                    color: "var(--lime-darker)",
                    fontFamily: "var(--font-serif-v2)",
                    border: "1px solid var(--line)",
                    overflow: "hidden",
                  }}
                >
                  {authorProfile.avatarUrl ? (
                    <Image
                      src={authorProfile.avatarUrl}
                      alt={authorName}
                      width={80}
                      height={80}
                      style={{ objectFit: "cover", width: "100%", height: "100%" }}
                    />
                  ) : (
                    authorInitials
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      color: "var(--ink-40)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    {AUTHOR_EYEBROW[lang]}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 500,
                      letterSpacing: "-0.015em",
                      margin: "0 0 4px",
                    }}
                  >
                    {authorName}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-60)", marginBottom: 12 }}>
                    {authorRole}
                  </div>
                  <p
                    style={{
                      fontSize: 14,
                      color: "var(--ink-60)",
                      lineHeight: 1.65,
                      margin: "0 0 16px",
                    }}
                  >
                    {authorBio}
                  </p>
                  {authorUrl && (
                    <Link
                      href={authorUrl}
                      style={{
                        fontSize: 13,
                        color: "var(--lime-dark)",
                        fontWeight: 500,
                        borderBottom: "1px solid var(--lime-light)",
                        paddingBottom: 1,
                      }}
                    >
                      {READ_MORE_CTA[lang]}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Smart CTA (funnel-driven; ET fallback copy until Phase 8 trilingual editor) ── */}
        <SmartCTA funnel={resolvedFunnel} slug={slug} lang={lang} />
        <BlogAnalytics
          slug={slug}
          funnel={resolvedFunnel}
          lang={lang}
          author={post.author}
          medicalTopic={post.medicalTopic}
        />

        {post.medicalReview && (
          <div className="mx-auto" style={{ maxWidth: 720, padding: "16px 24px 0" }}>
            <div
              style={{
                padding: 16,
                background: "var(--beige-light)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                fontSize: 13,
                color: "var(--ink-60)",
              }}
            >
              {lang === "ru"
                ? "Содержание этой статьи проверено специалистами KSA Silmakeskus."
                : lang === "en"
                ? "The content of this article has been medically reviewed by KSA Vision Clinic specialists."
                : "Selle artikli sisu on meditsiiniliselt kontrollitud KSA Silmakeskuse spetsialistide poolt."}
            </div>
          </div>
        )}

        {/* ── Related posts ── */}
        <RelatedPosts posts={related} lang={lang} />
      </main>
      <BlogFooter lang={post.lang} />
    </>
  );
}
