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

// ── RSS Sources ───────────────────────────────────────────────────────────────

const SOURCES = [
  {
    id: "healio",
    name: "Healio Ophthalmology",
    url: "https://www.healio.com/sws/feed/news/ophthalmology",
    weight: 3,  // highest priority
  },
  {
    id: "sciencedaily",
    name: "ScienceDaily Eye Care",
    url: "https://www.sciencedaily.com/rss/health_medicine/eye_care.xml",
    weight: 2,
  },
  {
    id: "reviewofopt",
    name: "Review of Ophthalmology",
    url: "https://www.reviewofophthalmology.com/rss/news",
    weight: 2,
  },
  {
    id: "pubmed",
    name: "PubMed Eye Surgery",
    url: "https://pubmed.ncbi.nlm.nih.gov/rss/search/1nknZFGxGrAc-YoJVhCRvUr1TmO-nQV7NZrScOFEL3VVMdRbF4/?limit=20&utm_campaign=pubmed-2&fc=20240101000000",
    weight: 1,
  },
];

// ── KSA-relevant keywords for article scoring ─────────────────────────────────

const HIGH_VALUE_KEYWORDS = [
  "laser eye surgery", "LASIK", "PRK", "laser vision correction",
  "refractive surgery", "myopia", "nearsightedness", "contact lenses",
  "glasses", "vision correction", "dry eye", "eye drops",
  "intraocular lens", "cataract", "ICL", "phakic lens",
  "screen time", "digital eye strain", "blue light",
  "eye health", "vision", "ophthalmology", "optometry",
  "nägemine", "silmad", "laser", "prillid",
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
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72h window

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

// ── Build Claude prompt ───────────────────────────────────────────────────────

function buildPrompt(article: Article, lang: string): string {
  const langLabel = lang === "et" ? "Estonian" : lang === "ru" ? "Russian" : "English";
  const langInstructions = {
    et: `Estonian. Use warm, expert but accessible Estonian. Natural everyday language, not overly formal.
Search terms to naturally include: "laserkorrektsiooni hind", "silmade laseroperatsioon", "ICB operatsioon", "Flow3 Tallinnas", "KSA Silmakeskus"`,
    ru: `Russian. Warm, professional Russian. Natural and accessible.
Search terms: "лазерная коррекция зрения Таллин", "операция ICB", "Flow3 процедура", "KSA Silmakeskus"`,
    en: `English. Clear, expert tone aimed at expats in Tallinn or medical tourists.
Search terms: "laser eye surgery Tallinn", "ICB lens replacement Estonia", "Flow3 procedure KSA"`,
  };

  return `You are a senior content editor for KSA Silmakeskus, an eye clinic in Tallinn, Estonia, specialists in the Flow3 laser procedure (pinnapealne laserkorrektsiooni meetod — flapless, safer for sports) and ICB lens replacement (for those unsuitable for laser). KSA has 55,000+ procedures performed. Recovery after Flow3 is approximately 1 week.

A new article was published in the eye health space. Your job: write a FRESH, original KSA blog post INSPIRED BY this article, adapted for a ${langLabel}-speaking audience in Estonia. Do NOT copy or translate. Use the article as a topic spark only.

SOURCE ARTICLE:
Title: ${article.title}
Source: ${article.source}
URL: ${article.url}
Summary: ${article.summary.slice(0, 600)}

Write in ${langInstructions[lang as keyof typeof langInstructions] ?? langInstructions.en}

Return ONLY a JSON object (no markdown fences, no explanation):
{
  "title": "Engaging title max 60 chars with primary keyword",
  "slug": "url-friendly-slug-kebab-case",
  "excerpt": "Compelling 150-180 char meta description with benefit and keyword",
  "categories": ["Primary Category", "Secondary Category"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "ctaType": "kiirtest-inline or kiirtest-soft or none",
  "medicalReview": true or false,
  "seoTitle": "SEO title max 60 chars",
  "seoExcerpt": "Meta description 120-155 chars",
  "llmSearchQueries": [
    "Conversational question 1 this post answers (in ${langLabel})",
    "Conversational question 2",
    "Conversational question 3",
    "Conversational question 4",
    "Conversational question 5"
  ],
  "faqItems": [
    {"q": "FAQ question 1 in ${langLabel}", "a": "Answer 1 (2-3 sentences)"},
    {"q": "FAQ question 2", "a": "Answer 2"},
    {"q": "FAQ question 3", "a": "Answer 3"}
  ],
  "content": "Full markdown blog post body (600-900 words). Include:\\n- Natural H2 headings (##) every 200-300 words\\n- 1 internal KSA link where relevant (use [text](https://ksa.ee/hinnakiri/) or [text](https://ksa.ee/icb-time) or [text](https://ksa.ee/flow3/))\\n- Conversational tone\\n- End with a natural CTA sentence pointing to KSA\\n- Do NOT include the title as H1 (it is in frontmatter)\\n- Do NOT include a FAQ section (that is handled separately)"
}

CTA type rules:
- kiirtest-inline: post is about laser correction, ICB, Flow3, getting rid of glasses
- kiirtest-soft: general eye health education
- none: children's eye health, general health unrelated to procedures

medicalReview = true only if post makes specific clinical claims (contraindications, drug interactions, exact dosages, specific complication rates).`;
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

async function generateDraft(article: Article, lang: string, client: Anthropic): Promise<GeneratedPost | null> {
  const prompt = buildPrompt(article, lang);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
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
  fs.mkdirSync(DRAFTS_DIR, { recursive: true });

  console.log(`\nKSA Content Scout`);
  console.log(`━━━━━━━━━━━━━━━━━`);
  console.log(`Fetching RSS feeds...`);

  const articles = await fetchArticles();
  const seen = loadSeen();

  const fresh = articles.filter((a) => !seen.has(a.url));

  console.log(`Found ${articles.length} articles (${fresh.length} new, ${articles.length - fresh.length} already seen)`);

  if (fresh.length === 0) {
    console.log(`\nNothing new today. Try again tomorrow or run with --source to force a specific source.`);
    return;
  }

  const toProcess = fresh.slice(0, LIMIT);

  console.log(`\nTop picks:`);
  for (const a of toProcess) {
    console.log(`  [${a.score}] ${a.title.slice(0, 70)} (${a.source})`);
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
      const post = await generateDraft(article, lang, client);
      if (!post) {
        console.log(`  ✗ [${lang}] parse failed`);
        continue;
      }

      const today = new Date().toISOString().split("T")[0];
      const langDir = lang === "ru"
        ? path.join(DRAFTS_DIR, "ru")
        : lang === "en"
        ? path.join(DRAFTS_DIR, "en")
        : DRAFTS_DIR;
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
      savedFiles.push(lang === "et" ? filename : `${lang}/${filename}`);
      console.log(`  ✓ [${lang}] → ${lang === "et" ? "" : lang + "/"}${filename}`);
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
