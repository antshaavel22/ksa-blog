/**
 * fill-translations.ts
 * Finds ET posts that have no RU or EN equivalent, generates missing versions,
 * and saves them to content/drafts/ for editor review.
 *
 * Usage:
 *   npm run fill-translations                    # Generate missing RU+EN for all ET posts
 *   npm run fill-translations -- --lang en       # Only generate EN versions
 *   npm run fill-translations -- --lang ru       # Only generate RU versions
 *   npm run fill-translations -- --limit 10      # Process first 10 unmatched ET posts
 *   npm run fill-translations -- --dry-run       # Show gaps without generating
 *   npm run fill-translations -- --category "flow-protseduur"  # Prioritise one category
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Anthropic from "@anthropic-ai/sdk";

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const POSTS_DIR = path.join(process.cwd(), "content/posts");
const DRAFTS_DIR = path.join(process.cwd(), "content/drafts");
const PROGRESS_FILE = path.join(process.cwd(), ".fill-translations-progress.json");

// CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => { const i = args.indexOf("--limit"); return i >= 0 ? parseInt(args[i + 1]) : Infinity; })();
const LANG_FILTER = (() => { const i = args.indexOf("--lang"); return i >= 0 ? args[i + 1] : null; })();
const CAT_FILTER = (() => { const i = args.indexOf("--category"); return i >= 0 ? args[i + 1] : null; })();
const TARGET_LANGS = LANG_FILTER ? [LANG_FILTER] : ["ru", "en"];

// ── Priority order for categories ────────────────────────────────────────────
// High-value commercial content first
const CATEGORY_PRIORITY: Record<string, number> = {
  "flow protseduur": 10,
  "flow3": 10,
  "edulood": 9,
  "kogemuslood": 9,
  "nägemise korrigeerimine": 8,
  "nagemise korrigeerimine": 8,
  "ksa silmakeskus": 7,
  "huvitavad faktid": 6,
  "silmad ja tervis": 5,
  "silmade tervis & nipid": 4,
  "eye health & tips": 4,
  "tehnoloogia": 3,
};

function postPriority(cats: string[]): number {
  let max = 0;
  for (const c of cats) {
    const p = CATEGORY_PRIORITY[c.toLowerCase()] ?? 1;
    if (p > max) max = p;
  }
  return max;
}

// ── Load/save progress ────────────────────────────────────────────────────────
function loadProgress(): Set<string> {
  if (fs.existsSync(PROGRESS_FILE)) {
    return new Set(JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8")) as string[]);
  }
  return new Set();
}
function saveProgress(done: Set<string>) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify([...done], null, 2));
}

// ── Read all posts ────────────────────────────────────────────────────────────
interface PostMeta {
  slug: string;
  title: string;
  lang: string;
  categories: string[];
  tags: string[];
  excerpt: string;
  content: string;
  featuredImage: string;
  file: string;
}

function readAllPosts(): PostMeta[] {
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, f), "utf-8");
      const { data, content } = matter(raw);
      return {
        slug: data.slug ?? f.replace(/\.mdx?$/, ""),
        title: data.title ?? "",
        lang: data.lang ?? "et",
        categories: data.categories ?? [],
        tags: data.tags ?? [],
        excerpt: data.excerpt ?? "",
        content,
        featuredImage: data.featuredImage ?? "",
        file: f,
      };
    });
}

// ── Simple title similarity (for matching existing translations) ──────────────
// Strips punctuation, lowercases, returns set of significant words
function titleWords(title: string): Set<string> {
  const stopwords = new Set(["ja", "on", "et", "kas", "kui", "see", "oma", "mis", "ning",
    "и", "в", "на", "с", "по", "для", "что", "как", "от", "the", "a", "an", "is", "are",
    "for", "of", "in", "to", "how", "what", "why", "your", "you", "can"]);
  return new Set(
    title.toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w))
  );
}

function titleOverlap(a: string, b: string): number {
  const wa = titleWords(a);
  const wb = titleWords(b);
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  return overlap / Math.max(wa.size, wb.size, 1);
}

// ── Build translation prompt ──────────────────────────────────────────────────
function buildTranslationPrompt(post: PostMeta, targetLang: string): string {
  const langLabel = targetLang === "ru" ? "Russian" : "English";

  const voiceGuide: Record<string, string> = {
    ru: `VOICE & STYLE (Russian):
- Write like a smart, calm expert explaining something to a curious 12-year-old. Clear. No jargon without explanation.
- Warm but not gushing. Confident but not arrogant. No hype, no drama, no hollow superlatives.
- Short sentences. One idea per sentence. If a sentence has more than 20 words, split it.
- No fluff. Every sentence must carry information or build trust. Cut anything decorative.
- Address reader as "вы". Conversational formal — like a doctor who is also a good teacher.
- No phrases like: "уникальный", "революционный", "лучший в мире", "невероятно".
- Use plain words: not "осуществить коррекцию зрения" but "исправить зрение".
- Trust through facts: "55 000 процедур", "наши врачи сами выбрали Flow3", not empty claims.
- One natural internal link max: [Flow3](https://ksa.ee/ru/flow3/) or [цены](https://ksa.ee/ru/hinnakiri/) or [ICB](https://ksa.ee/ru/icb-time)
- Keywords woven in naturally (never forced): лазерная коррекция зрения Таллин, Flow3, KSA Silmakeskus`,

    en: `VOICE & STYLE (English):
- Write like a calm, knowledgeable expert talking to a curious person with no medical background.
- Plain English. If a 4th grader can't follow it, simplify. No Latin, no acronym soup.
- Short sentences. Active voice. Cut adjectives unless they carry real meaning.
- No fluff, no hype, no "amazing", "revolutionary", "life-changing" unless quoting a real patient.
- Warm but measured. Confident but never pushy. The reader should feel informed, not sold to.
- Trust through specifics: "55,000+ procedures", "our own doctors chose Flow3 for themselves" — not vague claims.
- One natural internal link max: [Flow3](https://ksa.ee/en/laser-eye-surgery/) or [pricing](https://ksa.ee/en/price-list/) or [ICB](https://ksa.ee/en/icb-time)
- Keywords woven in naturally: laser eye surgery Tallinn, Flow3 Estonia, KSA Silmakeskus`,
  };

  return `You are a world-class medical copywriter for KSA Silmakeskus, a premium eye clinic in Tallinn, Estonia.

ABOUT KSA:
- Specialists in Flow3 (flapless surface laser — no cut, no flap, safer for sports, recovery ~1 week)
- And ICB lens replacement (for those not suitable for laser — replaces the natural lens)
- 55,000+ procedures performed. Founded and led by Dr. Ants Haavel (ophthalmologist, 20+ years).
- The entire clinical team chose Flow3 for their own vision — that's the ultimate proof of trust.
- Clinic location: Tallinn, Estonia. Serving Estonian, Russian, and international patients.

YOUR TASK:
Adapt the Estonian blog post below into ${langLabel}. This is NOT a literal translation.
Rewrite it with the voice, rhythm and natural flow of a native ${langLabel} speaker.
Keep all facts and the essential structure — but make it feel originally written in ${langLabel}.

${voiceGuide[targetLang]}

ORIGINAL ESTONIAN POST:
Title: ${post.title}
Categories: ${post.categories.join(", ")}
Excerpt: ${post.excerpt}
Content:
${post.content.slice(0, 3000)}

Return ONLY a JSON object (no markdown fences):
{
  "title": "Adapted title in ${langLabel} (max 60 chars, with keyword)",
  "slug": "url-kebab-slug-in-latin-characters",
  "excerpt": "Meta description 150-180 chars in ${langLabel}",
  "categories": ${JSON.stringify(post.categories)},
  "tags": ${JSON.stringify(post.tags)},
  "ctaType": "kiirtest-inline or kiirtest-soft or none",
  "medicalReview": ${post.categories.some(c => c.toLowerCase().includes("tervis") || c.toLowerCase().includes("health")) ? "true" : "false"},
  "seoTitle": "SEO title in ${langLabel} (max 60 chars)",
  "seoExcerpt": "Meta description in ${langLabel} (120-155 chars)",
  "llmSearchQueries": [
    "Conversational question 1 in ${langLabel}",
    "Conversational question 2",
    "Conversational question 3"
  ],
  "content": "Full adapted blog post body in ${langLabel} markdown. Keep same structure and length as original. Include ## H2 headings. Do NOT include H1 title."
}`;
}

// ── Save draft MDX file ───────────────────────────────────────────────────────
function saveDraft(post: Record<string, unknown>, targetLang: string, sourceTitle: string, sourceFeaturedImage?: string): string {
  const langDir = path.join(DRAFTS_DIR, targetLang);
  fs.mkdirSync(langDir, { recursive: true });

  const today = new Date().toISOString().split("T")[0];
  const slug = (post.slug as string).replace(/[^a-z0-9-]/gi, "-").toLowerCase().slice(0, 80);
  let filename = `${today}-${slug}.mdx`;
  let counter = 1;
  while (fs.existsSync(path.join(langDir, filename))) {
    filename = `${today}-${slug}-${counter++}.mdx`;
  }

  const y = (s: string) => `"${String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").trim()}"`;
  const yamlList = (arr: string[]) => (arr ?? []).map((s) => `  - ${y(s)}`).join("\n");
  const cats = post.categories as string[];
  const tags = post.tags as string[];

  const mdx = `---
title: ${y(post.title as string)}
slug: ${y(post.slug as string)}
date: ${y(today)}
author: "KSA Silmakeskus"
categories: [${cats.map((c) => `"${c.replace(/"/g, '\\"')}"`).join(", ")}]
tags: [${tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(", ")}]
excerpt: ${y(post.excerpt as string)}
featuredImage: ${y(sourceFeaturedImage ?? "")}
lang: "${targetLang}"
ctaType: "${post.ctaType}"
medicalReview: ${post.medicalReview}
status: "draft"
seoTitle: ${y(post.seoTitle as string)}
seoExcerpt: ${y(post.seoExcerpt as string)}
llmSearchQueries:
${yamlList((post.llmSearchQueries as string[]) ?? [])}
translatedFrom: ${y(sourceTitle)}
generatedAt: "${new Date().toISOString()}"
---

${(post.content as string).trim()}
`;

  fs.writeFileSync(path.join(langDir, filename), mdx, "utf-8");
  return `${targetLang}/${filename}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const client = new Anthropic();
  const allPosts = readAllPosts();

  const etPosts = allPosts
    .filter((p) => p.lang === "et" && p.title)
    .sort((a, b) => postPriority(b.categories) - postPriority(a.categories));

  const ruPosts = allPosts.filter((p) => p.lang === "ru");
  const enPosts = allPosts.filter((p) => p.lang === "en");

  console.log(`\nKSA Translation Gap Filler`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`ET posts: ${etPosts.length} | RU posts: ${ruPosts.length} | EN posts: ${enPosts.length}`);

  // Find ET posts that lack RU or EN equivalents
  const gaps: { post: PostMeta; missingLangs: string[] }[] = [];

  for (const etPost of etPosts) {
    // Apply category filter if specified
    if (CAT_FILTER) {
      const hasCategory = etPost.categories.some((c) =>
        c.toLowerCase().replace(/\s+/g, "-") === CAT_FILTER.toLowerCase()
      );
      if (!hasCategory) continue;
    }

    const missingLangs: string[] = [];

    for (const lang of TARGET_LANGS) {
      const pool = lang === "ru" ? ruPosts : enPosts;
      // Check if a similar post exists (title overlap > 30% = likely same topic)
      const hasEquivalent = pool.some((p) => titleOverlap(etPost.title, p.title) > 0.3);
      if (!hasEquivalent) {
        missingLangs.push(lang);
      }
    }

    if (missingLangs.length > 0) {
      gaps.push({ post: etPost, missingLangs });
    }
  }

  const totalToGenerate = gaps.reduce((sum, g) => sum + g.missingLangs.length, 0);
  console.log(`\nGaps found: ${gaps.length} ET posts missing translations`);
  console.log(`Posts to generate: ${totalToGenerate} (RU: ${gaps.filter(g => g.missingLangs.includes("ru")).length}, EN: ${gaps.filter(g => g.missingLangs.includes("en")).length})`);

  if (DRY_RUN) {
    console.log(`\nTop 20 gaps (by priority):`);
    gaps.slice(0, 20).forEach((g, i) => {
      console.log(`  ${i + 1}. [${g.missingLangs.join("+")}] ${g.post.title.slice(0, 60)}`);
    });
    console.log(`\n  Run without --dry-run to generate. Use --limit 20 to start small.`);
    return;
  }

  const done = loadProgress();
  const toProcess = gaps
    .filter((g) => !done.has(g.post.file))
    .slice(0, LIMIT === Infinity ? gaps.length : LIMIT);

  console.log(`\nGenerating ${toProcess.reduce((s, g) => s + g.missingLangs.length, 0)} posts (${toProcess.length} ET sources)...`);
  console.log(`This runs in batches of 3. Progress saved — safe to interrupt and resume.\n`);

  let generated = 0;
  let errors = 0;
  const BATCH_SIZE = 3;
  const DELAY_MS = 1000;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.flatMap(({ post, missingLangs }) =>
        missingLangs.map(async (lang) => {
          try {
            const prompt = buildTranslationPrompt(post, lang);
            const response = await client.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 3500,
              messages: [{ role: "user", content: prompt }],
            });

            const text = (response.content[0] as { text: string }).text.trim();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON in response");

            const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
            const filename = saveDraft(parsed, lang, post.title, post.featuredImage);
            generated++;
            process.stdout.write(`  ✓ [${lang.toUpperCase()}] ${(parsed.title as string).slice(0, 50)} → ${filename}\n`);
          } catch (err) {
            errors++;
            process.stdout.write(`  ✗ [${lang.toUpperCase()}] ${post.title.slice(0, 40)}: ${(err as Error).message}\n`);
          }
        })
      )
    );

    // Mark batch as done (by source ET file)
    batch.forEach(({ post }) => done.add(post.file));
    saveProgress(done);

    const pct = Math.round(((i + batch.length) / toProcess.length) * 100);
    process.stdout.write(`\r  Progress: ${i + batch.length}/${toProcess.length} ET posts (${pct}%) — ${generated} drafts saved\n`);

    if (i + BATCH_SIZE < toProcess.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n✓ Done!`);
  console.log(`  Generated: ${generated} drafts`);
  console.log(`  Errors:    ${errors}`);
  console.log(`  Location:  content/drafts/`);
  console.log(`\n  Review drafts, then move to content/posts/ + remove status: "draft" + redeploy.`);

  // Clean progress file on full completion (no limit)
  if (LIMIT === Infinity && errors === 0 && fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
