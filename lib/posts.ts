import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { toSlug } from "@/lib/categories";

const postsDirectory = path.join(process.cwd(), "content/posts");

export type PostLang = "et" | "ru" | "en";
export type CtaType = "kiirtest-inline" | "kiirtest-soft" | "none";

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
      return data as PostMeta;
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

export function getRelatedPosts(post: PostMeta, limit = 3): PostMeta[] {
  const all = getAllPosts(post.lang as PostLang);
  return all
    .filter((p) => p.slug !== post.slug)
    .filter((p) => p.categories.some((c) => post.categories.includes(c)))
    .slice(0, limit);
}
