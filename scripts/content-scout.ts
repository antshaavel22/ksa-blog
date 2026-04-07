/**
 * content-scout.ts
 * Daily content pipeline: monitors top eye health blogs → generates KSA blog post → saves draft.
 *
 * Usage:
 *   npm run scout                        # Generate 1 draft from today's top article
 *   npm run scout -- --limit 3           # Generate up to 3 drafts
 *   npm run scout -- --dry-run           # Preview without saving
 *   npm run scout -- --lang ru           # Generate in Russian instead of Estonian
 *   npm run scout -- --source healio     # Only use Healio Ophthalmology
 */

import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import Parser from "rss-parser";

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const DRAFTS_DIR = path.join(process.cwd(), "content/drafts");
const SEEN_FILE = path.join(process.cwd(), ".scout-seen.json");

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => { const i = args.indexOf("--limit"); return i >= 0 ? parseInt(args[i + 1]) : 1; })();
const TRILINGUAL = args.includes("--trilingual");
const LANG = (() => {
  if (TRILINGUAL) return "et"; // base lang; all 3 will be generated
  const i = args.indexOf("--lang");
  return i >= 0 ? args[i + 1] : "et";
})();
const LANGS = TRILINGUAL ? ["et", "ru", "en"] : [LANG];
const SOURCE_FILTER = (() => { const i = args.indexOf("--source"); return i >= 0 ? args[i + 1] : null; })();

// ── RSS Sources — TOP 20 health, lifestyle, vision & eyes blogs ───────────────
// Weight 3 = eye/vision specialist; Weight 2 = health/science authority;
// Weight 1 = lifestyle/wellness (broad but trendy)

const SOURCES = [
  // ── Eye & Vision specialist (weight 3) ────────────────────────────────────
  {
    id: "healio",
    name: "Healio Ophthalmology",
    url: "https://www.healio.com/sws/feed/news/ophthalmology",
    weight: 3,
  },
  {
    id: "reviewofopt",
    name: "Review of Ophthalmology",
    url: "https://www.reviewofophthalmology.com/rss/news",
    weight: 3,
  },
  {
    id: "aao",
    name: "American Academy of Ophthalmology",
    url: "https://www.aao.org/rss/eyenet",
    weight: 3,
  },
  {
    id: "eyewire",
    name: "EyeWire News",
    url: "https://eyewire.news/feed/",
    weight: 3,
  },
  {
    id: "allaboutvision",
    name: "All About Vision",
    url: "https://www.allaboutvision.com/rss.xml",
    weight: 3,
  },
  {
    id: "optometry",
    name: "Optometry Today",
    url: "https://www.optometry.co.uk/rss/news",
    weight: 2,
  },
  // ── Science & Medical authority (weight 2) ────────────────────────────────
  {
    id: "sciencedaily_eye",
    name: "ScienceDaily Eye Care",
    url: "https://www.sciencedaily.com/rss/health_medicine/eye_care.xml",
    weight: 2,
  },
  {
    id: "sciencedaily_health",
    name: "ScienceDaily Health",
    url: "https://www.sciencedaily.com/rss/health_medicine.xml",
    weight: 2,
  },
  {
    id: "medscape",
    name: "Medscape Ophthalmology",
    url: "https://www.medscape.com/rss/ophthalmology",
    weight: 2,
  },
  {
    id: "nih",
    name: "NIH News in Health",
    url: "https://newsinhealth.nih.gov/sites/NHI/files/news-in-health.xml",
    weight: 2,
  },
  {
    id: "pubmed",
    name: "PubMed Eye Surgery",
    url: "https://pubmed.ncbi.nlm.nih.gov/rss/search/1nknZFGxGrAc-YoJVhCRvUr1TmO-nQV7NZrScOFEL3VVMdRbF4/?limit=20&utm_campaign=pubmed-2&fc=20240101000000",
    weight: 2,
  },
  // ── Health & Lifestyle authority (weight 1) ───────────────────────────────
  {
    id: "healthline",
    name: "Healthline",
    url: "https://www.healthline.com/rss/health-news",
    weight: 1,
  },
  {
    id: "webmd",
    name: "WebMD Health News",
    url: "https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC",
    weight: 1,
  },
  {
    id: "mayoclinic",
    name: "Mayo Clinic News",
    url: "https://newsnetwork.mayoclinic.org/feed/",
    weight: 1,
  },
  {
    id: "bbc_health",
    name: "BBC Health",
    url: "https://feeds.bbci.co.uk/news/health/rss.xml",
    weight: 1,
  },
  {
    id: "guardian_health",
    name: "The Guardian Health",
    url: "https://www.theguardian.com/society/health/rss",
    weight: 1,
  },
  {
    id: "prevention",
    name: "Prevention Magazine",
    url: "https://www.prevention.com/feed/",
    weight: 1,
  },
  {
    id: "mindbodygreen",
    name: "mindbodygreen",
    url: "https://www.mindbodygreen.com/rss.xml",
    weight: 1,
  },
  {
    id: "wellandgood",
    name: "Well+Good",
    url: "https://www.wellandgood.com/feed/",
    weight: 1,
  },
  {
    id: "self",
    name: "SELF Magazine Health",
    url: "https://www.self.com/feed/rss",
    weight: 1,
  },
  {
    id: "everydayhealth",
    name: "Everyday Health",
    url: "https://www.everydayhealth.com/rss/all-news.aspx",
    weight: 1,
  },
];

// ── KSA-relevant keywords for article scoring ─────────────────────────────────
// Weight: eye/vision specialist topics score higher than lifestyle topics

const HIGH_VALUE_KEYWORDS = [
  // Eye & vision procedures (highest relevance)
  "laser eye surgery", "LASIK", "PRK", "LASEK", "laser vision correction",
  "refractive surgery", "myopia correction", "vision correction",
  "intraocular lens", "ICL", "phakic lens", "cataract surgery",
  "Flow3", "surface ablation", "flapless laser",
  // Eye health conditions
  "myopia", "nearsightedness", "astigmatism", "presbyopia", "hyperopia",
  "dry eye", "dry eye syndrome", "eye drops", "conjunctivitis",
  "macular degeneration", "glaucoma", "retinal", "cornea",
  "eye floaters", "eye strain", "blurry vision",
  // Eyewear & alternatives
  "glasses", "spectacles", "contact lenses", "contact lens",
  "reading glasses", "progressive lenses", "bifocals",
  // Lifestyle & vision (lifestyle blog angle)
  "screen time", "digital eye strain", "blue light", "computer vision",
  "eye health", "vision", "ophthalmology", "optometry", "eye exam",
  "children's vision", "kids eye", "sport vision", "driving vision",
  "nutrition for eyes", "eye vitamins", "omega-3 vision",
  "sleep and eyes", "UV protection", "sunglasses", "eye ageing",
  // Estonian keywords
  "nägemine", "silmad", "laser", "prillid", "kontaktläätsed",
];

// ── Seen article tracking ─────────────────────────────────────────────────────

function loadSeen(): Set<string> {
  if (fs.existsSync(SEEN_FILE)) {
    const data = JSON.parse(fs.readFileSync(SEEN_FILE, "utf-8")) as string[];
    return new Set(data);
  }
  return new Set();
}

function saveSeen(seen: Set<string>) {
  // Keep last 500 seen URLs to avoid unbounded growth
  const arr = [...seen].slice(-500);
  fs.writeFileSync(SEEN_FILE, JSON.stringify(arr, null, 2));
}

// ── Score article relevance ───────────────────────────────────────────────────

function scoreArticle(title: string, summary: string): number {
  const text = `${title} ${summary}`.toLowerCase();
  let score = 0;
  for (const kw of HIGH_VALUE_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) score++;
  }
  return score;
}

// ── Fetch RSS feeds ───────────────────────────────────────────────────────────

interface Article {
  title: string;
  url: string;
  summary: string;
  source: string;
  pubDate: Date;
  score: number;
}

async function fetchArticles(): Promise<Article[]> {
  const parser = new Parser({ timeout: 10000 });
  const articles: Article[] = [];
  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5-day window

  const sources = SOURCE_FILTER
    ? SOURCES.filter((s) => s.id === SOURCE_FILTER)
    : SOURCES;

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);
      for (const item of feed.items ?? []) {
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
        if (pubDate < cutoff) continue;

        const title = item.title ?? "";
        const summary = item.contentSnippet ?? item.summary ?? "";
        const url = item.link ?? "";

        if (!title || !url) continue;

        const score = scoreArticle(title, summary) * source.weight;
        articles.push({ title, url, summary, source: source.name, pubDate, score });
      }
    } catch (err) {
      console.warn(`  ⚠ ${source.name}: ${(err as Error).message}`);
    }
  }

  // Sort by score desc, then by date desc
  return articles.sort((a, b) => b.score - a.score || b.pubDate.getTime() - a.pubDate.getTime());
}

// ── Load master prompt ────────────────────────────────────────────────────────

function loadMasterPrompt(): string {
  const masterPath = path.join(process.cwd(), "content/system/master-prompt.md");
  if (fs.existsSync(masterPath)) {
    return fs.readFileSync(masterPath, "utf-8");
  }
  return "";
}

// ── Build Claude prompt ───────────────────────────────────────────────────────

function buildPrompt(article: Article, lang: string, masterPrompt: string): string {
  const langLabel = lang === "et" ? "Estonian" : lang === "ru" ? "Russian" : "English";

  return `${masterPrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TODAY'S WRITING TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This article caught our eye today. Use it as a spark — not a source.
Write something original in ${langLabel}. Your own angle. Your own story.

SOURCE:
${article.title}
${article.source}
${article.summary.slice(0, 400)}

Write the article. Then apply James Clear's three-question edit:
  1. Can it be shorter?
  2. Is it more appealing than when you started?
  3. Could it matter to someone who has never heard of KSA?

Return ONLY valid JSON — no markdown fences, no explanation:
{
  "title": "The headline. Max 65 chars. A fact, a question, or something surprising.",
  "slug": "kebab-case-url-slug",
  "excerpt": "One sentence that makes someone want to read. 150–170 chars.",
  "categories": ["One or two categories"],
  "tags": ["up to five tags"],
  "ctaType": "kiirtest-inline if the article connects naturally to laser/ICB/Flow3 — otherwise kiirtest-soft — or none",
  "medicalReview": false,
  "seoTitle": "SEO title, max 60 chars",
  "seoExcerpt": "Meta description, 120–155 chars",
  "llmSearchQueries": [
    "A real question someone might type to find this article (in ${langLabel})",
    "Question 2", "Question 3", "Question 4", "Question 5"
  ],
  "faqItems": [
    {"q": "A question readers genuinely ask", "a": "A clear, honest 2-sentence answer"},
    {"q": "Question 2", "a": "Answer 2"},
    {"q": "Question 3", "a": "Answer 3"}
  ],
  "content": "The article body in markdown. 500–600 words. Start with a strong first sentence — no warming up. Short paragraphs. One idea at a time, fully, then move on. ## headings when the topic shifts. End with a thought that stays with the reader. No marketing language. No repeated ideas."
}`;
}

// ── Generate draft post via Claude ────────────────────────────────────────────

interface GeneratedPost {
  title: string;
  slug: string;
  excerpt: string;
  categories: string[];
  tags: string[];
  ctaType: string;
  medicalReview: boolean;
  seoTitle: string;
  seoExcerpt: string;
  llmSearchQueries: string[];
  faqItems: { q: string; a: string }[];
  content: string;
}

async function generateDraft(article: Article, lang: string, client: Anthropic, masterPrompt: string): Promise<GeneratedPost | null> {
  const prompt = buildPrompt(article, lang, masterPrompt);

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",   // upgraded: Sonnet for higher quality drafts
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (response.content[0] as { text: string }).text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]) as GeneratedPost;
  } catch {
    return null;
  }
}

// ── Build MDX file content ────────────────────────────────────────────────────

function buildMdxFile(post: GeneratedPost, article: Article, lang: string): string {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  // Build FAQ section as markdown if items exist
  const faqSection = post.faqItems?.length > 0
    ? `\n\n## Korduma kippuvad küsimused\n\n` +
      post.faqItems.map((f) => `**${f.q}**\n\n${f.a}`).join("\n\n")
    : "";

  // YAML-safe string
  const y = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").trim()}"`;
  const yamlList = (arr: string[]) => arr.map((s) => `  - ${y(s)}`).join("\n");

  return `---
title: ${y(post.title)}
slug: ${y(post.slug)}
date: ${y(today)}
author: "KSA Silmakeskus"
categories: [${post.categories.map((c) => `"${c.replace(/"/g, '\\"')}"`).join(", ")}]
tags: [${post.tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(", ")}]
excerpt: ${y(post.excerpt)}
featuredImage: ""
lang: "${lang}"
ctaType: "${post.ctaType}"
medicalReview: ${post.medicalReview}
status: "draft"
seoTitle: ${y(post.seoTitle)}
seoExcerpt: ${y(post.seoExcerpt)}
llmSearchQueries:
${yamlList(post.llmSearchQueries ?? [])}
sourceUrl: ${y(article.url)}
sourceTitle: ${y(article.title)}
generatedAt: "${now}"
---

${post.content.trim()}${faqSection}
`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const client = new Anthropic();
  fs.mkdirSync(path.join(DRAFTS_DIR, "et"), { recursive: true });
  fs.mkdirSync(path.join(DRAFTS_DIR, "ru"), { recursive: true });
  fs.mkdirSync(path.join(DRAFTS_DIR, "en"), { recursive: true });

  // Load master prompt — gives Claude the full KSA voice, quality benchmark, scope
  const masterPrompt = loadMasterPrompt();

  console.log(`\nKSA Content Scout v2 — Top 20 Sources`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Fetching RSS feeds from ${SOURCES.length} sources...`);

  const articles = await fetchArticles();
  const seen = loadSeen();

  const fresh = articles.filter((a) => !seen.has(a.url));

  console.log(`Found ${articles.length} articles across all sources (${fresh.length} new)`);

  if (fresh.length === 0) {
    console.log(`\nNothing new today — all articles already seen. Extending window or try --source.`);
    return;
  }

  const toProcess = fresh.slice(0, LIMIT);

  console.log(`\nTop picks:`);
  for (const a of toProcess) {
    console.log(`  [score:${a.score}] ${a.title.slice(0, 65)} (${a.source})`);
  }
  console.log();

  let generated = 0;
  const savedFiles: string[] = [];

  for (const article of toProcess) {
    process.stdout.write(`Generating: "${article.title.slice(0, 50)}..."  `);

    if (DRY_RUN) {
      console.log(`[dry-run, skip]`);
      continue;
    }

    let anySuccess = false;
    for (const lang of LANGS) {
      const post = await generateDraft(article, lang, client, masterPrompt);
      if (!post) {
        console.log(`  ✗ [${lang}] parse failed`);
        continue;
      }

      const today = new Date().toISOString().split("T")[0];
      const langDir = lang === "ru"
        ? path.join(DRAFTS_DIR, "ru")
        : lang === "en"
        ? path.join(DRAFTS_DIR, "en")
        : path.join(DRAFTS_DIR, "et");
      fs.mkdirSync(langDir, { recursive: true });

      let filename = `${today}-${post.slug}.mdx`;
      let uniquePath = path.join(langDir, filename);
      let counter = 1;
      while (fs.existsSync(uniquePath)) {
        filename = `${today}-${post.slug}-${counter++}.mdx`;
        uniquePath = path.join(langDir, filename);
      }

      const mdxContent = buildMdxFile(post, article, lang);
      fs.writeFileSync(uniquePath, mdxContent, "utf-8");
      savedFiles.push(`${lang}/${filename}`);
      console.log(`  ✓ [${lang}] → ${lang}/${filename}`);
      anySuccess = true;
    }

    if (anySuccess) {
      seen.add(article.url);
      generated++;
    }
  }

  saveSeen(seen);

  console.log(`\n✓ Done! ${generated} draft(s) saved to content/drafts/`);
  if (savedFiles.length > 0) {
    console.log(`\nReview queue:`);
    savedFiles.forEach((f) => console.log(`  content/drafts/${f}`));
    console.log(`\nTo publish: move file to content/posts/ and remove 'status: "draft"' line, then redeploy.`);
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
