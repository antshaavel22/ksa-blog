/**
 * wp-to-mdx.ts
 * Converts WordPress XML export to MDX files for the ksa-blog Next.js project.
 *
 * Usage: npx tsx scripts/wp-to-mdx.ts <path-to-xml>
 * Example: npx tsx scripts/wp-to-mdx.ts ~/Desktop/ksasilmakeskus.WordPress.2026-04-01.xml
 */

import fs from "fs";
import path from "path";
import xml2js from "xml2js";
import TurndownService from "turndown";

const XML_FILE = process.argv[2] ?? path.join(process.env.HOME!, "Desktop/ksasilmakeskus.WordPress.2026-04-01.xml");
const OUTPUT_DIR = path.join(process.cwd(), "content/posts");

// ── CTA classification ────────────────────────────────────────────────────────

const KIIRTEST_INLINE_CATS = new Set([
  "flow protseduur",
  "flow procedure",
  "nagemise korrigeerimine",
  "nägemise korrigeerimine",
  "vision correction",
  "edulood",
  "success stories",
  "kogemuslood",
  "patient stories",
]);

const NO_CTA_CATS = new Set([
  "silmad ja tervis",
  "eyes & health",
  "silmade tervis & nipid",
  "silmade tervis &amp; nipid",
  "eye health & tips",
  "eye health &amp; tips",
]);

function determineCta(categories: string[], tags: string[]): "kiirtest-inline" | "kiirtest-soft" | "none" {
  const allLower = [...categories, ...tags].map((s) => s.toLowerCase());
  if (allLower.some((c) => NO_CTA_CATS.has(c))) return "none";
  if (allLower.some((c) => KIIRTEST_INLINE_CATS.has(c))) return "kiirtest-inline";
  // Check for keywords in categories
  if (allLower.some((c) => c.includes("laser") || c.includes("icb") || c.includes("flow") || c.includes("prilli"))) {
    return "kiirtest-inline";
  }
  return "kiirtest-soft";
}

// ── Author display names ───────────────────────────────────────────────────────

const AUTHOR_NAMES: Record<string, string> = {
  antsh: "Dr. Ants Haavel",
  silvia: "Silvia Haavel",
  yana: "Yana Grechits",
  maigret: "Maigret Moru",
  ndhaldur: "KSA Silmakeskus",
};

// ── HTML entity decode ────────────────────────────────────────────────────────

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#124;/g, "|");
}

// ── HTML → Markdown ────────────────────────────────────────────────────────────

const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
td.remove(["script", "style", "noscript"]);

// Handle WordPress figure/figcaption
td.addRule("figure", {
  filter: "figure",
  replacement(content) {
    return `\n\n${content.trim()}\n\n`;
  },
});

function htmlToMarkdown(html: string): string {
  // Strip Gutenberg block comments
  let clean = html.replace(/<!-- \/?wp:[^\n]* -->/g, "");
  // Strip Elementor wrappers (just in case)
  clean = clean.replace(/\[elementor[^\]]*\]/g, "");
  clean = clean.replace(/<div[^>]*class="[^"]*elementor[^"]*"[^>]*>/g, "");
  // Fix common WP encoding
  clean = clean.replace(/&#8217;/g, "'").replace(/&#8216;/g, "'");
  clean = clean.replace(/&#8220;/g, '"').replace(/&#8221;/g, '"');
  clean = clean.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
  clean = clean.replace(/&#124;/g, "|");
  // Convert to markdown
  let md = td.turndown(clean);
  // Clean up excessive blank lines
  md = md.replace(/\n{3,}/g, "\n\n");
  return md.trim();
}

// ── Language detection ────────────────────────────────────────────────────────

function detectLang(categories: string[]): "et" | "ru" | "en" {
  const lower = categories.map((c) => c.toLowerCase());
  if (lower.includes("russian")) return "ru";
  if (lower.includes("english")) return "en";
  return "et";
}

// ── Clean categories (remove language marker cats) ────────────────────────────

const LANG_CATS = new Set(["russian", "english"]);

function cleanCategories(cats: string[]): string[] {
  return cats.filter((c) => !LANG_CATS.has(c.toLowerCase()));
}

// ── YAML frontmatter escaping ─────────────────────────────────────────────────

function yamlStr(s: string): string {
  const escaped = s
    .replace(/\\/g, "\\\\")  // escape backslashes first
    .replace(/"/g, '\\"')    // escape quotes
    .replace(/\n/g, " ")     // flatten newlines
    .trim();
  return `"${escaped}"`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Reading XML: ${XML_FILE}`);
  const xmlRaw = fs.readFileSync(XML_FILE, "utf-8");

  const parsed = await xml2js.parseStringPromise(xmlRaw, {
    explicitArray: true,
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });

  const channel = parsed.rss.channel[0];
  const items: Record<string, unknown[]>[] = channel.item ?? [];

  // Build attachment ID → URL map
  const attachments = new Map<string, string>();
  for (const item of items) {
    const postType = (item.post_type?.[0] as string) ?? "";
    if (postType === "attachment") {
      const id = (item.post_id?.[0] as string) ?? "";
      const url = (item.attachment_url?.[0] as string) ?? "";
      if (id && url) attachments.set(id, url);
    }
  }
  console.log(`Found ${attachments.size} attachments`);

  // Ensure output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let converted = 0;
  let skipped = 0;
  const slugsSeen = new Set<string>();

  for (const item of items) {
    const postType = (item.post_type?.[0] as string) ?? "";
    const status = (item.status?.[0] as string) ?? "";

    if (postType !== "post" || status !== "publish") continue;

    const title = (item.title?.[0] as string) ?? "";
    let slug = (item.post_name?.[0] as string) ?? "";
    const date = (item.post_date?.[0] as string)?.split(" ")[0] ?? "";
    const authorLogin = (item.creator?.[0] as string) ?? "";
    const excerpt = (item.encoded?.[1] as string) ?? ""; // excerpt:encoded
    const contentRaw = (item.encoded?.[0] as string) ?? ""; // content:encoded

    // Category and tag extraction
    type CatNode = { _?: string; $?: { domain?: string; nicename?: string } };
    const catNodes: CatNode[] = (item.category as CatNode[]) ?? [];
    const categories = catNodes
      .filter((c) => c.$?.domain === "category")
      .map((c) => decodeHtmlEntities(c._ ?? c.$?.nicename ?? ""));
    const tags = catNodes
      .filter((c) => c.$?.domain === "post_tag")
      .map((c) => decodeHtmlEntities(c._ ?? ""));

    // Thumbnail
    let featuredImage = "";
    const postmeta: Record<string, unknown[]>[] = (item.postmeta as Record<string, unknown[]>[]) ?? [];
    for (const meta of postmeta) {
      const key = (meta.meta_key?.[0] as string) ?? "";
      const value = (meta.meta_value?.[0] as string) ?? "";
      if (key === "_thumbnail_id" && value) {
        featuredImage = attachments.get(value) ?? "";
      }
    }

    if (!slug || !title) {
      skipped++;
      continue;
    }

    // Handle duplicate slugs (shouldn't happen but just in case)
    let uniqueSlug = slug;
    let counter = 1;
    while (slugsSeen.has(uniqueSlug)) {
      uniqueSlug = `${slug}-${counter++}`;
    }
    slugsSeen.add(uniqueSlug);

    const lang = detectLang(categories);
    const cleanCats = cleanCategories(categories);
    const ctaType = determineCta(cleanCats, tags);
    const author = AUTHOR_NAMES[authorLogin] ?? authorLogin;

    // Convert content to markdown
    const markdownContent = contentRaw ? htmlToMarkdown(contentRaw) : "";
    const cleanExcerpt = excerpt ? htmlToMarkdown(excerpt).replace(/\n/g, " ").slice(0, 200) : "";

    // Build frontmatter
    const frontmatter = [
      "---",
      `title: ${yamlStr(title)}`,
      `slug: ${yamlStr(uniqueSlug)}`,
      `date: ${yamlStr(date)}`,
      `author: ${yamlStr(author)}`,
      `categories: [${cleanCats.map((c) => `"${c.replace(/"/g, '\\"')}"`).join(", ")}]`,
      `tags: [${tags.slice(0, 10).map((t) => `"${t.replace(/"/g, '\\"')}"`).join(", ")}]`,
      `excerpt: ${yamlStr(cleanExcerpt)}`,
      `featuredImage: ${yamlStr(featuredImage)}`,
      `lang: "${lang}"`,
      `ctaType: "${ctaType}"`,
      `medicalReview: false`,
      "---",
    ].join("\n");

    const mdxContent = `${frontmatter}\n\n${markdownContent}\n`;
    const outputPath = path.join(OUTPUT_DIR, `${uniqueSlug}.mdx`);
    fs.writeFileSync(outputPath, mdxContent, "utf-8");
    converted++;

    if (converted % 50 === 0) {
      console.log(`  Converted ${converted} posts...`);
    }
  }

  console.log(`\n✓ Done! Converted: ${converted} | Skipped: ${skipped}`);
  console.log(`Output: ${OUTPUT_DIR}`);

  // Summary by language
  const files = fs.readdirSync(OUTPUT_DIR);
  const langCount: Record<string, number> = { et: 0, ru: 0, en: 0 };
  for (const file of files) {
    const raw = fs.readFileSync(path.join(OUTPUT_DIR, file), "utf-8");
    const langMatch = raw.match(/^lang: "(\w+)"/m);
    if (langMatch) langCount[langMatch[1]] = (langCount[langMatch[1]] ?? 0) + 1;
  }
  console.log(`\nLanguage breakdown: ET=${langCount.et} RU=${langCount.ru} EN=${langCount.en}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
