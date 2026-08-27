import { NextRequest, NextResponse } from "next/server";
import { getPostBySlug, getRelatedPosts, getAdjacentPosts, PostMeta } from "@/lib/posts";
import { getCategoryLabel, toSlug } from "@/lib/categories";
import { resolveFunnel } from "@/lib/funnel-classifier";
import { getAuthorByKey } from "@/lib/authors";
import { RAW_CONFIG, resolveCtaEntry, normalizeLang } from "@/lib/cta-config";
import { publicAssetUrl, publicBlogUrl } from "@/lib/url";

/**
 * Public, read-only single-post fetch for other KSA properties (ksa-web's
 * /blogi/[slug] article template). Same posture as /api/posts: reuses
 * existing lib/posts.ts, lib/authors.ts, lib/funnel-classifier.ts,
 * lib/cta-config.ts server-side so the consuming app never needs its own
 * copy of that logic/data — no new data layer, no admin/write paths.
 */

function toPublicSummary(p: PostMeta, lang: "et" | "ru" | "en") {
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    date: p.date,
    categoryLabel: p.categories[0] ? getCategoryLabel(toSlug(p.categories[0]), lang) : "",
    featuredImage: p.featuredImage ? publicAssetUrl(p.featuredImage) : "",
    imageFocalPoint: p.imageFocalPoint ?? null,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const lang = (post.lang ?? "et") as "et" | "ru" | "en";
  const primaryCategoryRaw = post.categories[0] ?? "";
  const authorProfile = post.author ? getAuthorByKey(post.author) : undefined;
  const reviewerProfile = post.reviewedBy ? getAuthorByKey(post.reviewedBy) : authorProfile;

  const frontmatterFunnel =
    post.funnel ?? (post.ctaType === "kiirtest-inline" || post.ctaType === "kiirtest-soft" ? "flow3" : "general");
  const resolvedFunnel = resolveFunnel({
    title: post.title,
    slug: post.slug,
    categories: post.categories,
    body: post.content,
    funnel: frontmatterFunnel,
    funnelOverride: (post as { funnelOverride?: boolean }).funnelOverride === true,
  });

  const ctaLang = normalizeLang(lang);
  const ctaRaw = RAW_CONFIG[resolvedFunnel] ?? RAW_CONFIG.general;
  const ctaLive = !!resolveCtaEntry(ctaRaw, ctaLang)?.live;

  const related = getRelatedPosts(post, 3).map((p) => toPublicSummary(p, lang));
  const { prev, next } = getAdjacentPosts(post);

  return NextResponse.json(
    {
      slug: post.slug,
      title: post.title,
      seoTitle: post.seoTitle ?? post.title,
      excerpt: post.excerpt,
      seoExcerpt: post.seoExcerpt ?? post.excerpt,
      date: post.date,
      lang,
      content: post.content,
      categories: post.categories,
      categoryLabel: primaryCategoryRaw ? getCategoryLabel(toSlug(primaryCategoryRaw), lang) : "",
      categorySlug: primaryCategoryRaw ? toSlug(primaryCategoryRaw) : "",
      featuredImage: post.featuredImage ? publicAssetUrl(post.featuredImage) : "",
      imageFocalPoint: post.imageFocalPoint ?? null,
      faqItems: post.faqItems ?? [],
      llmSearchQueries: post.llmSearchQueries ?? [],
      medicalReview: !!post.medicalReview,
      medicalTopic: post.medicalTopic ?? null,
      medicalTopicType: post.medicalTopicType ?? null,
      canonicalUrl: publicBlogUrl(slug),
      author: authorProfile
        ? {
            name: authorProfile.displayName,
            role: authorProfile.role[lang],
            bio: authorProfile.bio[lang],
            avatarUrl: authorProfile.avatarUrl ? publicAssetUrl(authorProfile.avatarUrl) : "",
            profileUrl: `${publicBlogUrl(`autor/${authorProfile.slug}`)}`,
          }
        : { name: post.author ?? "KSA Silmakeskus", role: "", bio: "", avatarUrl: "", profileUrl: null },
      reviewer: reviewerProfile
        ? {
            name: reviewerProfile.displayName,
            role: reviewerProfile.role[lang],
            credentials: reviewerProfile.credentials?.[lang] ?? null,
          }
        : null,
      resolvedFunnel,
      ctaLive,
      related,
      prevSlug: prev?.slug ?? null,
      nextSlug: next?.slug ?? null,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=120, s-maxage=120, stale-while-revalidate=600",
        "Access-Control-Allow-Origin": "https://ksa.ee",
      },
    }
  );
}
