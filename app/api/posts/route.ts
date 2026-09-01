import { NextRequest, NextResponse } from "next/server";
import { getAllPosts, getAllCategories, getHomeFeed, PostLang } from "@/lib/posts";
import { getCategoryLabel, resolveCategorySlug } from "@/lib/categories";
import { publicAssetUrl } from "@/lib/url";

/**
 * Public, read-only post listing for other KSA properties (currently
 * ksa-web's /blogi index). Reuses the same data/filter/pagination logic as
 * the blog's own homepage (app/page.tsx) — no new data layer, no admin
 * access, no write paths.
 */

const PAGE_SIZE = 12;
const FIRST_PAGE_SIZE = 13;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lang = (searchParams.get("lang") ?? "et") as PostLang;
  const category = searchParams.get("category")?.trim() || undefined;
  const query = searchParams.get("q")?.trim().toLowerCase() || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const allPosts = getAllPosts();
  const langFiltered = allPosts.filter((p) => p.lang === lang);

  const categoryFiltered = category
    ? langFiltered.filter((p) =>
        p.categories.some((c) => resolveCategorySlug(c) === resolveCategorySlug(category))
      )
    : langFiltered;

  const queryFiltered = query
    ? categoryFiltered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.excerpt?.toLowerCase().includes(query) ||
          p.categories.some((c) => c.toLowerCase().includes(query))
      )
    : categoryFiltered;

  const hasFilter = !!(category || query);
  // Apply the pin/shuffle reorder unconditionally (not just on page 1) so
  // every page slices from the SAME ordering — computing it only for page 1
  // let a pinned/shuffled-to-the-front post also appear at its original
  // chronological position on a later page (found via testing 2026-08-27;
  // same latent bug exists on blog.ksa.ee's own homepage, which has this
  // same page===1-only condition).
  const filtered = !hasFilter ? getHomeFeed(queryFiltered) : queryFiltered;

  const total = filtered.length;
  const totalPages = hasFilter
    ? Math.max(1, Math.ceil(total / PAGE_SIZE))
    : total <= FIRST_PAGE_SIZE
      ? 1
      : 1 + Math.ceil((total - FIRST_PAGE_SIZE) / PAGE_SIZE);

  const offset = hasFilter
    ? (page - 1) * PAGE_SIZE
    : page === 1
      ? 0
      : FIRST_PAGE_SIZE + (page - 2) * PAGE_SIZE;
  const take = !hasFilter && page === 1 ? FIRST_PAGE_SIZE : PAGE_SIZE;
  const pageSlice = filtered.slice(offset, offset + take);

  const featuredRaw = page === 1 && !hasFilter ? pageSlice[0] : undefined;
  const gridRaw = featuredRaw ? pageSlice.slice(1) : pageSlice;

  const toPublic = (p: (typeof pageSlice)[number]) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    date: p.date,
    categories: p.categories,
    categoryLabel: p.categories[0]
      ? getCategoryLabel(resolveCategorySlug(p.categories[0]), lang)
      : "",
    featuredImage: p.featuredImage ? publicAssetUrl(p.featuredImage) : "",
    url: `https://blog.ksa.ee/${p.slug}`,
    pinned: p.pinned === true,
  });

  const categoryCounts = getAllCategories()
    .map((c) => ({
      slug: c.slug,
      name: getCategoryLabel(c.slug, lang),
      count: langFiltered.filter((p) => p.categories.some((pc) => resolveCategorySlug(pc) === c.slug)).length,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return NextResponse.json(
    {
      featured: featuredRaw ? toPublic(featuredRaw) : null,
      posts: gridRaw.map(toPublic),
      total,
      page,
      totalPages,
      categories: categoryCounts,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        "Access-Control-Allow-Origin": "https://ksa.ee",
      },
    }
  );
}
