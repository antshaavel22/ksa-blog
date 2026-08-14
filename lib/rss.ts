import { getAllPosts, PostLang, PostMeta } from "@/lib/posts";
import { publicBlogUrl, publicAssetUrl } from "@/lib/url";

const CHANNEL_META: Record<PostLang, { title: string; description: string; locale: string }> = {
  et: {
    title: "KSA Silmakeskus Blogi",
    description: "Silmade tervis, laserkorrektsioon ja nägemise parandamine — KSA Silmakeskuse blogi.",
    locale: "et",
  },
  ru: {
    title: "Блог KSA Silmakeskus",
    description: "Здоровье глаз, лазерная коррекция и улучшение зрения — блог KSA Silmakeskus.",
    locale: "ru",
  },
  en: {
    title: "KSA Silmakeskus Blog",
    description: "Eye health, laser vision correction, and vision improvement — the KSA Silmakeskus blog.",
    locale: "en",
  },
};

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function itemXml(post: PostMeta): string {
  const url = publicBlogUrl(post.slug);
  const pubDate = new Date(post.date).toUTCString();
  const image = post.featuredImage ? publicAssetUrl(post.featuredImage) : "";
  return `  <item>
    <title>${xmlEscape(post.title)}</title>
    <link>${xmlEscape(url)}</link>
    <guid isPermaLink="true">${xmlEscape(url)}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${xmlEscape(post.excerpt || "")}</description>
    ${image ? `<enclosure url="${xmlEscape(image)}" type="image/webp" />` : ""}
  </item>`;
}

/**
 * Builds an RSS 2.0 feed. `lang` filters to one language (matching how the
 * three published feeds — ET/RU/EN — are already fully independent article
 * sets, see feedback_ksa_blog_languages_independent); omit it for the
 * combined all-language feed served at /rss.xml. Reuses getAllPosts(), which
 * already sorts newest-first and drops future-dated posts, so feed order and
 * scheduling match the site exactly.
 */
export function buildRssFeed(lang?: PostLang): string {
  const posts = getAllPosts(lang).slice(0, 50);
  const meta = lang ? CHANNEL_META[lang] : {
    title: "KSA Silmakeskus Blogi",
    description: "KSA Silmakeskuse blogi kõigis keeltes — eesti, vene ja inglise.",
    locale: "et",
  };
  const selfUrl = publicBlogUrl(lang ? `rss/${lang}.xml` : "rss.xml");
  const items = posts.map(itemXml).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${xmlEscape(meta.title)}</title>
  <link>${xmlEscape(publicBlogUrl())}</link>
  <description>${xmlEscape(meta.description)}</description>
  <language>${meta.locale}</language>
  <atom:link href="${xmlEscape(selfUrl)}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>`;
}
