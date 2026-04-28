import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { toSlug } from "@/lib/categories";

const postsDirectory = path.join(process.cwd(), "content/posts");

export type PostLang = "et" | "ru" | "en";
export type CtaType = "kiirtest-inline" | "kiirtest-soft" | "none";
export type Funnel = "flow3" | "audit" | "kids" | "dryeye" | "general";

export interface FaqItem {
  q: string;
  a: string;
}

export interface PostMeta {
  title: string;
  slug: string;
  date: string;
  author: string;
  categories: string[];
  tags: string[];
  excerpt: string;
  featuredImage: string;
  lang: PostLang;
  ctaType: CtaType;
  medicalReview: boolean;
  faqItems?: FaqItem[];
  llmSearchQueries?: string[];
  seoTitle?: string;
  seoExcerpt?: string;
  hideDate?: boolean;
  hideAuthor?: boolean;
  translatedFrom?: string;
  expertReviewer?: string;
  funnel?: Funnel;
  ctaOverride?: string;
  /** Schema.org medical entity referenced by this article (displayed via `about`). */
  medicalTopic?: string;
  /** Optional type for medicalTopic; defaults to "MedicalCondition". */
  medicalTopicType?: "MedicalCondition" | "MedicalProcedure";
  /** Author key who medically reviewed this article. Falls back to author. */
  reviewedBy?: string;
  /** CSS object-position value (e.g. "50% 30%") — controls hero image crop framing. */
  imageFocalPoint?: string;
  /** When true, pin to homepage top-6 (mixed/shuffled with newest). Max 3 active per lang. */
  pinned?: boolean;
}

/**
 * Build the homepage feed for a given language. Pinned posts (max 3, newest
 * first) take 3 of the top-6 slots; the rest of the top-6 are filled by the
 * newest non-pinned posts. Those 6 are shuffled (deterministic per UTC day
 * so SSR/ISR is stable). After position 6 the order is plain date-desc.
 *
 * Falls back to plain date-desc whenever there are no pinned posts.
 */
export function getHomeFeed(posts: PostMeta[]): PostMeta[] {
  const pinned = posts.filter((p) => p.pinned === true).slice(0, 3);
  if (pinned.length === 0) return posts;
  const pinnedSlugs = new Set(pinned.map((p) => p.slug));
  const rest = posts.filter((p) => !pinnedSlugs.has(p.slug));
  const fillerCount = Math.max(0, 6 - pinned.length);
  const filler = rest.slice(0, fillerCount);
  const tail = rest.slice(fillerCount);

  // Deterministic shuffle seeded by UTC date — stable across requests within
  // the same day, refreshed automatically on the next ISR regen.
  const seed = (() => {
    const d = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    let h = 2166136261;
    for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d.charCodeAt(i), 16777619);
    return h >>> 0;
  })();
  let s = seed || 1;
  const rand = () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
  const top6 = [...pinned, ...filler];
  for (let i = top6.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [top6[i], top6[j]] = [top6[j], top6[i]];
  }
  return [...top6, ...tail];
}

export interface Post extends PostMeta {
  content: string;
}

function getAllFiles(): string[] {
  if (!fs.existsSync(postsDirectory)) return [];
  return fs
    .readdirSync(postsDirectory)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"));
}

export function getAllPosts(lang?: PostLang): PostMeta[] {
  const files = getAllFiles();

  const posts = files
    .map((filename) => {
      const filePath = path.join(postsDirectory, filename);
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data } = matter(raw);
      const post = data as PostMeta;
      // Normalise categories: gray-matter may return a string (if frontmatter
      // uses `categories: "foo"`) or an array — always coerce to string[].
      // Also drop null/empty entries — admin batch-edit can write `- ` (empty
      // YAML item) which becomes null and crashes downstream `.toLowerCase()`.
      if (!Array.isArray(post.categories)) {
        post.categories = post.categories
          ? String(post.categories).split(",").map((s: string) => s.trim()).filter(Boolean)
          : [];
      }
      post.categories = post.categories
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .map((c) => c.trim());
      if (!Array.isArray(post.tags)) {
        post.tags = [];
      }
      post.tags = post.tags.filter(
        (t): t is string => typeof t === "string" && t.trim().length > 0,
      );
      return post;
    })
    .filter((p) => (lang ? p.lang === lang : true))
    .filter((p) => !p.date || p.date <= new Date().toISOString().split("T")[0])
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return posts;
}

export function getPostBySlug(slug: string): Post | null {
  const files = getAllFiles();
  for (const filename of files) {
    const filePath = path.join(postsDirectory, filename);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);
    const post = data as PostMeta;
    if (filename.replace(/\.mdx?$/, "") === slug || post.slug === slug) {
      // Same defensive normalisation as getAllPosts — keeps single-post
      // renders safe against null/empty categories or malformed tags.
      if (!Array.isArray(post.categories)) {
        post.categories = post.categories
          ? String(post.categories).split(",").map((s: string) => s.trim()).filter(Boolean)
          : [];
      }
      post.categories = post.categories
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .map((c) => c.trim());
      if (!Array.isArray(post.tags)) {
        post.tags = [];
      }
      post.tags = post.tags.filter(
        (t): t is string => typeof t === "string" && t.trim().length > 0,
      );
      return { ...post, content };
    }
  }
  return null;
}

export function getPostsByCategory(category: string, lang?: PostLang): PostMeta[] {
  return getAllPosts(lang).filter((p) =>
    p.categories.some((c) => toSlug(c) === toSlug(category))
  );
}

export function getAllCategories(): { slug: string; name: string; count: number }[] {
  const posts = getAllPosts();
  const map = new Map<string, { name: string; count: number }>();

  for (const post of posts) {
    for (const cat of post.categories) {
      const slug = toSlug(cat);
      const existing = map.get(slug);
      if (existing) {
        existing.count++;
      } else {
        map.set(slug, { name: cat, count: 1 });
      }
    }
  }

  return Array.from(map.entries())
    .map(([slug, { name, count }]) => ({ slug, name, count }))
    .sort((a, b) => b.count - a.count);
}

export function getSisterPosts(post: PostMeta): PostMeta[] {
  const all = getAllPosts();
  let etTitle: string | undefined;

  if (post.lang === "et") {
    etTitle = post.title;
  } else if (post.translatedFrom) {
    etTitle = post.translatedFrom;
  }

  if (!etTitle) return [];

  return all.filter(
    (p) =>
      p.slug !== post.slug &&
      (p.title === etTitle || p.translatedFrom === etTitle)
  );
}

/**
 * Adjacent posts in the same language, ordered by date descending.
 * `prev` = newer (published after the current post)
 * `next` = older (published before the current post)
 * This matches the reading direction on the index page: scrolling down
 * (→ right-arrow) reveals older articles. Either may be null at the ends.
 */
export function getAdjacentPosts(post: PostMeta): { prev: PostMeta | null; next: PostMeta | null } {
  const all = getAllPosts(post.lang as PostLang);
  const idx = all.findIndex((p) => p.slug === post.slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  };
}

export function getRelatedPosts(post: PostMeta, limit = 3): PostMeta[] {
  const all = getAllPosts(post.lang as PostLang);
  return all
    .filter((p) => p.slug !== post.slug)
    .filter((p) => p.categories.some((c) => post.categories.includes(c)))
    .slice(0, limit);
}
