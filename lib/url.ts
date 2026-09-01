export const BLOG_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_BLOG_PUBLIC_ORIGIN?.replace(/\/$/, "") ?? "https://blog.ksa.ee";
export const BLOG_BASE_PATH = (process.env.NEXT_PUBLIC_BLOG_BASE_PATH ?? "").replace(/\/$/, "");
export const BLOG_PUBLIC_BASE_URL = `${BLOG_PUBLIC_ORIGIN}${BLOG_BASE_PATH}`;

export function publicBlogUrl(path = "") {
  const clean = path.replace(/^\/+/, "");
  return clean ? `${BLOG_PUBLIC_BASE_URL}/${clean}` : BLOG_PUBLIC_BASE_URL;
}

// The blog's canonical home is now ksa.ee/blogi/<slug> (the main site), decided
// 2026-09-02. blog.ksa.ee stays fully live for every existing link, but each
// post points its canonical here so ranking + analytics consolidate onto the
// main domain. Every published post has a 1:1 twin at ksa.ee/blogi/<slug>
// (verified — 39/40 sampled; the one miss was a category page, not a post).
export const BLOG_CANONICAL_ORIGIN =
  process.env.NEXT_PUBLIC_BLOG_CANONICAL_ORIGIN?.replace(/\/$/, "") ?? "https://ksa.ee/blogi";

export function canonicalPostUrl(slug = "") {
  const clean = slug.replace(/^\/+/, "");
  return clean ? `${BLOG_CANONICAL_ORIGIN}/${clean}` : BLOG_CANONICAL_ORIGIN;
}

export function publicAssetUrl(src: string) {
  if (!src) return src;
  if (src.startsWith("http")) return src;
  if (src.startsWith("/wp-content/")) return `${BLOG_PUBLIC_ORIGIN}${src}`;
  return publicBlogUrl(src);
}
