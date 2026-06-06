export const BLOG_PUBLIC_ORIGIN = "https://ksa.ee";
export const BLOG_BASE_PATH = "/blogi";
export const BLOG_PUBLIC_BASE_URL = `${BLOG_PUBLIC_ORIGIN}${BLOG_BASE_PATH}`;

export function publicBlogUrl(path = "") {
  const clean = path.replace(/^\/+/, "");
  return clean ? `${BLOG_PUBLIC_BASE_URL}/${clean}` : BLOG_PUBLIC_BASE_URL;
}

export function publicAssetUrl(src: string) {
  if (!src) return src;
  if (src.startsWith("http")) return src;
  if (src.startsWith("/wp-content/")) return `${BLOG_PUBLIC_ORIGIN}${src}`;
  return publicBlogUrl(src);
}
