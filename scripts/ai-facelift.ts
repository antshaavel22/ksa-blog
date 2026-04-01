/**
 * ai-facelift.ts
 * Batch AI improvement of all MDX blog posts using Claude API.
 *
 * Phase 1 (default): Improve SEO metadata (title, excerpt) + flag medical content
 * Phase 2 (--content): Also improve H2 structure and add internal links
 *
 * Usage:
 *   npm run ai-facelift                    # Phase 1: metadata only (safe)
 *   npm run ai-facelift -- --content       # Phase 1 + 2: metadata + content
 *   npm run ai-facelift -- --dry-run       # Preview changes, don't write
 *   npm run ai-facelift -- --limit 10      # Process only first 10 posts
 *   npm run ai-facelift -- --lang et       # Process only Estonian posts
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Anthropic from "@anthropic-ai/sdk";

// Load .env.local if present (tsx doesn't always pass --env-file through)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const POSTS_DIR = path.join(process.cwd(), "content/posts");
const PROGRESS_FILE = path.join(process.cwd(), ".facelift-progress.json");

// CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DO_CONTENT = args.includes("--content");
const LIMIT = (() => { const i = args.indexOf("--limit"); return i >= 0 ? parseInt(args[i + 1]) : Infinity; })();
const LANG_FILTER = (() => { const i = args.indexOf("--lang"); return i >= 0 ? args[i + 1] : null; })();

// Internal links to inject (from strategy doc)
const INTERNAL_LINKS = {
  et: [
    { anchor: "laserkorrektsiooni hind", url: "https://ksa.ee/hinnakiri/" },
    { anchor: "hinnakiri", url: "https://ksa.ee/hinnakiri/" },
    { anchor: "ICB-operatsioon", url: "https://ksa.ee/icb-time" },
    { anchor: "vabane prillidest", url: "https://ksa.ee/vabane-prillidest/" },
    { anchor: "Flow3 protseduur", url: "https://ksa.ee/flow3/" },
  ],
  ru: [
    { anchor: "цены на лазерную коррекцию", url: "https://ksa.ee/ru/hinnakiri/" },
    { anchor: "операция ICB", url: "https://ksa.ee/ru/icb-time" },
  ],
  en: [
    { anchor: "laser correction price", url: "https://ksa.ee/en/price-list/" },
    { anchor: "ICB procedure", url: "https://ksa.ee/en/icb-time" },
  ],
};

// Medical keywords that trigger review flag
const MEDICAL_KEYWORDS = [
  "dioptrit", "diopter", "диоптри",
  "operatsioon", "хирургия", "surgery",
  "komplikatsioon", "осложнение", "complication",
  "kõrvaltoime", "побочный", "side effect",
  "vastunäidustus", "противопоказание", "contraindication",
  "ravim", "препарат", "medication",
  "diagnoos", "диагноз", "diagnosis",
  "glaukoom", "глаукома", "glaucoma",
  "katarakт", "катаракта", "cataract",
];

const client = new Anthropic();

// ── Load progress (to resume interrupted runs) ────────────────────────────────

function loadProgress(): Set<string> {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8")) as string[];
    return new Set(data);
  }
  return new Set();
}

function saveProgress(done: Set<string>) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify([...done], null, 2));
}

// ── Medical content detection ─────────────────────────────────────────────────

function needsMedicalReview(content: string): boolean {
  const lower = content.toLowerCase();
  return MEDICAL_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

// ── Build prompt for Claude ───────────────────────────────────────────────────

function buildMetadataPrompt(post: { title: string; excerpt: string; content: string; lang: string; categories: string[] }): string {
  const langLabel = post.lang === "et" ? "Estonian" : post.lang === "ru" ? "Russian" : "English";
  const targetKeywords = post.categories.join(", ");

  return `You are an SEO expert for KSA Silmakeskus, an eye clinic in Tallinn, Estonia specialising in laser eye surgery (Flow3) and ICB lens replacement.

Analyse this blog post and return ONLY a JSON object (no markdown, no explanation):

POST LANGUAGE: ${langLabel}
POST TITLE: ${post.title}
POST CATEGORIES: ${targetKeywords}
POST EXCERPT: ${post.excerpt}
POST CONTENT (first 800 chars): ${post.content.slice(0, 800)}

Return exactly this JSON:
{
  "seoTitle": "improved title (max 60 chars, include primary keyword, in ${langLabel})",
  "seoExcerpt": "improved meta description (120-155 chars, compelling, includes benefit, in ${langLabel})",
  "medicalReview": true or false (true if post contains clinical claims, diagnoses, drug interactions, or specific medical advice)
}

Rules:
- Keep the author's voice and meaning intact
- Estonian search terms: laserkorrektsiooni hind, silmade laseroperatsioon, ICB operatsioon, Flow3
- Russian search terms: лазерная коррекция зрения Таллин, операция ICB, Flow3
- English: laser eye surgery Tallinn, ICB lens replacement, Flow3 procedure
- medicalReview = true only for posts with specific clinical/medical claims, not general eye health tips`;
}

function buildContentPrompt(post: { title: string; content: string; lang: string }): string {
  const langLabel = post.lang === "et" ? "Estonian" : post.lang === "ru" ? "Russian" : "English";
  const links = INTERNAL_LINKS[post.lang as keyof typeof INTERNAL_LINKS] ?? INTERNAL_LINKS.et;
  const linkExamples = links.map((l) => `"${l.anchor}" → ${l.url}`).join("\n");

  return `You are a content editor for KSA Silmakeskus eye clinic. Improve this ${langLabel} blog post for readability and SEO.

TITLE: ${post.title}
CONTENT:
${post.content}

Return ONLY a JSON object:
{
  "improvedContent": "the full improved markdown content"
}

Rules:
1. Add or improve H2 headings (##) every 200-300 words where missing — use the section's natural topic
2. Add 1-3 internal links naturally where relevant. Available links:
${linkExamples}
   Format: [anchor text](url)
3. Do NOT change the author's voice, facts, tone, or overall structure
4. Do NOT add or remove major sections
5. Do NOT change the title (H1)
6. Keep all existing formatting (bold, lists, etc.)
7. Return only the markdown body (no frontmatter)`;
}

// ── Process a single post ─────────────────────────────────────────────────────

async function processPost(filePath: string, doContent: boolean): Promise<{
  changed: boolean;
  seoTitle?: string;
  seoExcerpt?: string;
  medicalReview?: boolean;
}> {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data: frontmatter, content } = matter(raw);

  // Phase 1: Metadata improvement
  const metaPrompt = buildMetadataPrompt({
    title: frontmatter.title ?? "",
    excerpt: frontmatter.excerpt ?? "",
    content,
    lang: frontmatter.lang ?? "et",
    categories: frontmatter.categories ?? [],
  });

  const metaResponse = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{ role: "user", content: metaPrompt }],
  });

  let seoTitle = frontmatter.title;
  let seoExcerpt = frontmatter.excerpt;
  let medicalReview = needsMedicalReview(content);

  try {
    const metaText = (metaResponse.content[0] as { text: string }).text.trim();
    const jsonMatch = metaText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.seoTitle) seoTitle = parsed.seoTitle;
      if (parsed.seoExcerpt) seoExcerpt = parsed.seoExcerpt;
      if (typeof parsed.medicalReview === "boolean") medicalReview = parsed.medicalReview;
    }
  } catch {
    // Keep originals on parse failure
  }

  // Phase 2: Content improvement (optional)
  let improvedContent = content;
  if (doContent && content.length > 200) {
    const contentPrompt = buildContentPrompt({
      title: frontmatter.title ?? "",
      content,
      lang: frontmatter.lang ?? "et",
    });

    const contentResponse = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{ role: "user", content: contentPrompt }],
    });

    try {
      const contentText = (contentResponse.content[0] as { text: string }).text.trim();
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.improvedContent && parsed.improvedContent.length > 100) {
          improvedContent = parsed.improvedContent;
        }
      }
    } catch {
      // Keep original on failure
    }
  }

  // Detect changes
  const changed =
    seoTitle !== frontmatter.title ||
    seoExcerpt !== frontmatter.excerpt ||
    medicalReview !== frontmatter.medicalReview ||
    improvedContent !== content;

  if (changed && !DRY_RUN) {
    const updatedFrontmatter = {
      ...frontmatter,
      title: seoTitle,
      excerpt: seoExcerpt,
      medicalReview,
    };
    const newFile = matter.stringify(improvedContent, updatedFrontmatter);
    fs.writeFileSync(filePath, newFile, "utf-8");
  }

  return { changed, seoTitle, seoExcerpt, medicalReview };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const files = fs.readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .map((f) => path.join(POSTS_DIR, f));

  // Filter by language if specified
  const toProcess = LANG_FILTER
    ? files.filter((f) => {
        const raw = fs.readFileSync(f, "utf-8");
        const { data } = matter(raw);
        return data.lang === LANG_FILTER;
      })
    : files;

  const limited = toProcess.slice(0, LIMIT === Infinity ? toProcess.length : LIMIT);
  const done = loadProgress();
  const remaining = limited.filter((f) => !done.has(path.basename(f)));

  console.log(`\nKSA Blog AI Facelift`);
  console.log(`━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Posts to process: ${remaining.length} (${limited.length - remaining.length} already done)`);
  console.log(`Mode: Phase 1 (metadata)${DO_CONTENT ? " + Phase 2 (content)" : ""}`);
  console.log(`Dry run: ${DRY_RUN}`);
  if (LANG_FILTER) console.log(`Language filter: ${LANG_FILTER}`);
  console.log();

  let processed = 0;
  let changed = 0;
  let medicalFlagged = 0;
  let errors = 0;
  const medicalReviewList: string[] = [];

  const BATCH_SIZE = 5;
  const DELAY_MS = 1000;

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (filePath) => {
        const filename = path.basename(filePath);
        try {
          const result = await processPost(filePath, DO_CONTENT);
          processed++;
          if (result.changed) changed++;
          if (result.medicalReview) {
            medicalFlagged++;
            medicalReviewList.push(filename);
          }
          done.add(filename);
        } catch (err) {
          errors++;
          console.error(`  ✗ ${filename}: ${(err as Error).message}`);
        }
      })
    );

    saveProgress(done);

    const pct = Math.round(((i + batch.length) / remaining.length) * 100);
    process.stdout.write(`\r  Progress: ${i + batch.length}/${remaining.length} (${pct}%) — ${changed} improved, ${medicalFlagged} flagged`);

    if (i + BATCH_SIZE < remaining.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n\n✓ Done!`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Improved:  ${changed}`);
  console.log(`  Errors:    ${errors}`);
  console.log(`  Medical review flagged: ${medicalFlagged}`);

  if (medicalReviewList.length > 0) {
    const reviewFile = path.join(process.cwd(), "medical-review-queue.txt");
    fs.writeFileSync(reviewFile, medicalReviewList.join("\n"), "utf-8");
    console.log(`\n  Medical review queue saved → medical-review-queue.txt`);
  }

  if (!DRY_RUN && changed > 0) {
    console.log(`\n  Run 'vercel --prod' to deploy the improved content.`);
  }

  // Clean up progress file on successful completion
  if (errors === 0 && fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
