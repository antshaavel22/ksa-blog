import { MetadataRoute } from "next";
import { getAllPosts, getAllCategories } from "@/lib/posts";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const categories = getAllCategories();
  const base = "https://blog.ksa.ee";

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${base}/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${base}/kategooria/${cat.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [
    { url: base, changeFrequency: "daily", priority: 1.0 },
    ...postEntries,
    ...categoryEntries,
  ];
}
