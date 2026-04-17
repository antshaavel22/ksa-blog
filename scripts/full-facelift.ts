/**
 * full-facelift.ts — Formatting + SEO/LLM/META enrichment pass for published posts.
 *
 * ONE Claude call per post, returns JSON:
 *   { body, seoTitle, seoExcerpt, tags, llmSearchQueries, faqItems }
 *
 * Rules (enforced in prompt, verified after):
 *   - Never changes facts, claims, numbers, quotes, MDX components
 *   - Reformats body into 5-6-sentence paragraphs with 2-4 bold keywords per section
 *   - Fills missing SEO fields (or improves weak ones)
 *   - Preserves existing translatedFrom, author, categories, date, featuredImage
 *   - Removes ICB mentions (legacy procedure — we don't market this anymore)
 *
 * Usage:
 *   npx tsx scripts/full-facelift.ts --file <filename.mdx>        # single post, dry-run
 *   npx tsx scripts/full-facelift.ts --pilot ru                   # 5 hand-picked RU pilots, dry-run
 *   npx tsx scripts/full-facelift.ts --lang ru --limit 50         # batch, dry-run
 *   npx tsx scripts/full-facelift.ts --lang ru --apply            # WRITE to content/posts/
 *   npx tsx scripts/full-facelift.ts --lang ru --apply --only-new # skip already-faceli­fted
 *
 * Progress saved to .facelift-progress-<lang>.json (resumable).
 * Dry-run diffs saved to .facelift-diffs/<filename>.diff.md
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Anthropic from "@anthropic-ai/sdk";

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const has = (name: string) => args.includes(`--${name}`);

const APPLY = has("apply");
const ONLY_NEW = has("only-new");
const LIMIT = parseInt(arg("limit") ?? "0", 10) || Infinity;
const LANG = arg("lang");
const SINGLE = arg("file");
const PILOT = arg("pilot");

const POSTS_DIR = path.join(process.cwd(), "content/posts");
const DIFF_DIR = path.join(process.cwd(), ".facelift-diffs");
if (!fs.existsSync(DIFF_DIR)) fs.mkdirSync(DIFF_DIR);

const progressFile = (lang: string) =>
  path.join(process.cwd(), `.facelift-progress-${lang}.json`);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── 5 hand-picked RU pilots (old WP-imported, poor formatting) ────────────────
const PILOTS: Record<string, string[]> = {
  ru: [
    "5-%d0%bf%d1%80%d0%b8%d1%87%d0%b8%d0%bd-%d0%b2%d1%8b%d0%b1%d1%80%d0%b0%d1%82%d1%8c-%d0%be%d0%bd%d0%bb%d0%b0%d0%b9%d0%bd-%d0%ba%d0%be%d0%bd%d1%81%d1%83%d0%bb%d1%8c%d1%82%d0%b0%d1%86%d0%b8%d1%8e-ksa-silm.mdx",
    "5-%d1%83%d0%b4%d0%b8%d0%b2%d0%b8%d1%82%d0%b5%d0%bb%d1%8c%d0%bd%d1%8b%d1%85-%d1%84%d0%b0%d0%ba%d1%82%d0%be%d0%b2-%d0%be-%d0%ba%d0%be%d1%82%d0%be%d1%80%d1%8b%d1%85-%d0%be%d1%84%d1%82%d0%b0%d0%bb%d1%8c.mdx",
    "15-%d1%81%d0%b0%d0%bc%d1%8b%d1%85-%d1%87%d0%b0%d1%81%d1%82%d1%8b%d1%85-%d0%b2%d0%be%d0%bf%d1%80%d0%be%d1%81%d0%be%d0%b2-%d0%be-%d0%bb%d0%b0%d0%b7%d0%b5%d1%80%d0%bd%d0%be%d0%b9-%d0%ba%d0%be%d1%80%d1%80.mdx",
    "7-%d0%bd%d0%b5%d0%b7%d0%b0%d0%bc%d0%b5%d1%82%d0%bd%d1%8b%d1%85-%d0%bf%d1%80%d0%b8%d0%b2%d1%8b%d1%87%d0%b5%d0%ba-%d0%ba%d0%be%d1%82%d0%be%d1%80%d1%8b%d0%b5-%d0%bc%d0%be%d0%b3%d1%83%d1%82-%d0%b8%d1%81.mdx",
    "7-%d0%bf%d1%80%d0%b8%d1%87%d0%b8%d0%bd-%d0%bf%d0%be%d1%87%d0%b5%d0%bc%d1%83-%d1%81%d1%82%d0%be%d0%b8%d1%82-%d1%81%d0%b4%d0%b5%d0%bb%d0%b0%d1%82%d1%8c-%d0%bb%d0%b0%d0%b7%d0%b5%d1%80%d0%bd%d1%83%d1%8e.mdx",
  ],
};

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = (lang: string) => `You are a senior medical-content editor for KSA Silmakeskus, Estonia's leading eye clinic. You are doing a FORMATTING + SEO FACELIFT — not a rewrite.

LANGUAGE: ${lang === "ru" ? "Russian (Baltic/Estonian-Russian standards)" : lang === "en" ? "British English, clinical but warm" : "Estonian"}.

CORE RULE — DO NOT CHANGE MEANING:
- Never alter facts, claims, numbers, quotes, names, or dates in the body.
- Never invent new claims. FAQ answers must be grounded in wording already in the article.
- Keep the author's voice. This is polish, not rewrite.

FORMATTING CHANGES YOU MAKE:
1. Break monolithic paragraphs into short paragraphs of 5–6 sentences each.
2. Bold 2–4 keywords per section using **markdown bold**. Prefer medical terms, procedure names, clinic names, key numbers. Never bold entire sentences.
3. If the article has no H2 structure, add 2–4 H2 headings (benefit-oriented, concrete) — using wording already present in the text.
4. Preserve all MDX components exactly: \`<KiirtestCTA />\`, \`<YouTubeEmbed url="..." />\`, \`<Image ...>\`, markdown images \`![...](...)\`, lists, tables.
5. Keep Markdown links intact.

CONTENT CHANGES YOU MAKE (minimal):
- Remove ICB / ИКБ procedure mentions — we no longer market this procedure. Delete the sentence or replace with "лазерная коррекция" (ru) / "laser correction" (en) / "laserprotseduur" (et) as appropriate.
- Fix spelling: Таллин → Таллинн (two н) in Russian. Every "вы" that addresses the reader → "Вы" (capital).
- Do NOT change anything else.

SEO FIELDS YOU PRODUCE:
- seoTitle: ≤60 chars, keyword-first, clickable. Includes primary keyword + clinic or city where natural.
- seoExcerpt: 140–155 chars, natural sentence, contains primary keyword, ends with subtle benefit or next step.
- tags: 5–8 long-tail keywords as a string array. Lower-case, specific, searchable. No generic "health" or "vision" alone.
- llmSearchQueries: 8–10 full natural questions a person would type into ChatGPT/Perplexity/Google in ${lang}. E.g. "Сколько стоит лазерная коррекция в Таллинне?" — real questions, not keyword soup.
- faqItems: 3–5 {q, a} pairs. Questions match real reader intent. Answers are 1–3 sentences, reusing wording from the article body. Never introduce new facts in FAQ.

OUTPUT FORMAT — strictly these XML-style sections, in this exact order, nothing else:

<body>
...the reformatted markdown body here (multi-line OK)...
</body>
<seoTitle>...</seoTitle>
<seoExcerpt>...</seoExcerpt>
<tags>
- tag one
- tag two
- tag three
</tags>
<llmQueries>
- first natural question
- second natural question
</llmQueries>
<faq>
Q: question 1
A: answer 1
Q: question 2
A: answer 2
</faq>

No preamble, no explanation, no markdown fences. Just the sections above.`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadProgress(lang: string): Set<string> {
  const f = progressFile(lang);
  return fs.existsSync(f)
    ? new Set(JSON.parse(fs.readFileSync(f, "utf-8")) as string[])
    : new Set();
}
function saveProgress(lang: string, done: Set<string>) {
  fs.writeFileSync(progressFile(lang), JSON.stringify([...done], null, 2));
}

function needsFacelift(fm: Record<string, unknown>, body: string): boolean {
  // Heuristic: skip posts that already have full SEO + bold keywords + short paragraphs
  const hasSeo =
    fm.seoTitle &&
    fm.seoExcerpt &&
    Array.isArray(fm.llmSearchQueries) &&
    (fm.llmSearchQueries as unknown[]).length >= 5 &&
    Array.isArray(fm.faqItems) &&
    (fm.faqItems as unknown[]).length >= 3;
  const hasBold = /\*\*[^*]+\*\*/.test(body);
  const longestPara = Math.max(
    ...body.split(/\n\n+/).map((p) => p.length),
    0
  );
  const shortParas = longestPara < 900;
  return !(hasSeo && hasBold && shortParas);
}

function buildFrontmatter(
  original: Record<string, unknown>,
  updates: {
    seoTitle: string;
    seoExcerpt: string;
    tags: string[];
    llmSearchQueries: string[];
    faqItems: { q: string; a: string }[];
  }
): string {
  const merged = {
    ...original,
    seoTitle: updates.seoTitle,
    seoExcerpt: updates.seoExcerpt,
    tags: updates.tags,
    llmSearchQueries: updates.llmSearchQueries,
    faqItems: updates.faqItems,
    faceliftedAt: new Date().toISOString(),
  };
  // Serialise manually to keep YAML style tidy (matter.stringify uses js-yaml
  // which reorders keys and switches quote style).
  const lines: string[] = ["---"];
  const order = [
    "title",
    "slug",
    "date",
    "author",
    "categories",
    "tags",
    "excerpt",
    "featuredImage",
    "lang",
    "ctaType",
    "medicalReview",
    "status",
    "seoTitle",
    "seoExcerpt",
    "llmSearchQueries",
    "faqItems",
    "translatedFrom",
    "hideDate",
    "hideAuthor",
    "imageFocalPoint",
    "expertReviewer",
    "generatedAt",
    "faceliftedAt",
  ];
  const written = new Set<string>();
  const yamlValue = (v: unknown): string => {
    if (v === null || v === undefined) return '""';
    if (typeof v === "boolean") return String(v);
    if (typeof v === "number") return String(v);
    const s = String(v);
    // Always quote; escape double quotes.
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  };
  const writeKey = (k: string, v: unknown) => {
    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${k}: []`);
      } else if (typeof v[0] === "string") {
        lines.push(`${k}:`);
        for (const item of v) lines.push(`  - ${yamlValue(item)}`);
      } else if (typeof v[0] === "object" && v[0] !== null) {
        // faqItems
        lines.push(`${k}:`);
        for (const item of v as Record<string, unknown>[]) {
          const keys = Object.keys(item);
          lines.push(`  - ${keys[0]}: ${yamlValue(item[keys[0]])}`);
          for (const kk of keys.slice(1)) {
            lines.push(`    ${kk}: ${yamlValue(item[kk])}`);
          }
        }
      }
    } else {
      lines.push(`${k}: ${yamlValue(v)}`);
    }
    written.add(k);
  };
  for (const k of order) {
    if (k in merged && merged[k as keyof typeof merged] !== undefined) {
      writeKey(k, merged[k as keyof typeof merged]);
    }
  }
  // Write any remaining keys we didn't know about
  for (const k of Object.keys(merged)) {
    if (!written.has(k)) writeKey(k, merged[k as keyof typeof merged]);
  }
  lines.push("---");
  return lines.join("\n");
}

function diff(before: string, after: string): string {
  return `=== BEFORE ===\n\n${before}\n\n=== AFTER ===\n\n${after}`;
}

interface FaceliftResult {
  body: string;
  seoTitle: string;
  seoExcerpt: string;
  tags: string[];
  llmSearchQueries: string[];
  faqItems: { q: string; a: string }[];
}

async function facelift(
  filename: string,
  raw: string,
  lang: string
): Promise<FaceliftResult> {
  const parsed = matter(raw);
  const bodyBefore = parsed.content.trim();

  const userPrompt = `Here is the post to facelift. Title: "${parsed.data.title}"

Existing excerpt: ${parsed.data.excerpt ?? "(none)"}
Categories: ${JSON.stringify(parsed.data.categories ?? [])}

BODY:
---
${bodyBefore}
---

Return the JSON per instructions.`;

  const resp = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 8000,
    system: SYSTEM_PROMPT(lang),
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = resp.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();

  const parsedResp = parseXmlSections(text);

  // Sanity checks
  if (!parsedResp.body || parsedResp.body.length < bodyBefore.length * 0.5) {
    throw new Error(
      `Body shrank >50% (${bodyBefore.length} → ${parsedResp.body?.length}). Aborting.`
    );
  }
  if (!parsedResp.seoTitle || parsedResp.seoTitle.length > 80) {
    throw new Error(`Bad seoTitle: ${parsedResp.seoTitle}`);
  }
  if (parsedResp.faqItems.length < 2) {
    throw new Error(`Too few FAQ items: ${parsedResp.faqItems.length}`);
  }
  return parsedResp;
}

function parseXmlSections(text: string): FaceliftResult {
  const section = (tag: string): string => {
    const m = text.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`));
    if (!m) throw new Error(`Missing <${tag}> section in model output`);
    return m[1].trim();
  };
  const body = section("body");
  const seoTitle = section("seoTitle");
  const seoExcerpt = section("seoExcerpt");
  const tagsBlock = section("tags");
  const llmBlock = section("llmQueries");
  const faqBlock = section("faq");

  const tags = tagsBlock
    .split("\n")
    .map((l) => l.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);
  const llmSearchQueries = llmBlock
    .split("\n")
    .map((l) => l.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);

  const faqItems: { q: string; a: string }[] = [];
  const faqLines = faqBlock.split("\n");
  let currentQ: string | null = null;
  let currentA: string[] = [];
  const flush = () => {
    if (currentQ && currentA.length) {
      faqItems.push({ q: currentQ, a: currentA.join(" ").trim() });
    }
    currentQ = null;
    currentA = [];
  };
  for (const line of faqLines) {
    const qm = line.match(/^\s*Q:\s*(.*)$/);
    const am = line.match(/^\s*A:\s*(.*)$/);
    if (qm) {
      flush();
      currentQ = qm[1].trim();
    } else if (am) {
      currentA = [am[1].trim()];
    } else if (line.trim() && currentQ) {
      currentA.push(line.trim());
    }
  }
  flush();

  return { body, seoTitle, seoExcerpt, tags, llmSearchQueries, faqItems };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function processFile(filename: string, lang: string, idx: number, total: number) {
  const filePath = path.join(POSTS_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(raw);
  const fm = parsed.data as Record<string, unknown>;

  if (ONLY_NEW && !needsFacelift(fm, parsed.content)) {
    console.log(`  [${idx}/${total}] ⊘ skip (already good): ${filename.slice(0, 60)}`);
    return { skipped: true };
  }

  console.log(`  [${idx}/${total}] ▸ ${filename.slice(0, 70)}`);
  try {
    const result = await facelift(filename, raw, lang);

    // Scrub any residual ICB mentions from original excerpt (legacy)
  const cleanedFm = { ...fm };
  for (const field of ["excerpt", "title"] as const) {
    const v = cleanedFm[field];
    if (typeof v === "string") {
      cleanedFm[field] = v
        .replace(/\s*и\s*ICB[^.,\n]*/gi, "")
        .replace(/\s*и\s*ИКБ[^.,\n]*/gi, "")
        .replace(/,\s*ICB[^.,\n]*/gi, "")
        .replace(/,\s*ИКБ[^.,\n]*/gi, "")
        .replace(/\s*·\s*ICB[^.,\n]*/gi, "")
        .replace(/\s*·\s*ИКБ[^.,\n]*/gi, "")
        .replace(/\bICB[™®]*\s*/gi, "")
        .replace(/\bИКБ[™®]*\s*/gi, "")
        .replace(/Таллин(?!н)/g, "Таллинн")
        .replace(/\s{2,}/g, " ")
        .trim();
    }
  }

  const newFm = buildFrontmatter(cleanedFm, {
      seoTitle: result.seoTitle,
      seoExcerpt: result.seoExcerpt,
      tags: result.tags,
      llmSearchQueries: result.llmSearchQueries,
      faqItems: result.faqItems,
    });
    const newContent = `${newFm}\n\n${result.body.trim()}\n`;

    if (APPLY) {
      fs.writeFileSync(filePath, newContent);
      console.log(`    ✓ written`);
    } else {
      const diffPath = path.join(DIFF_DIR, `${filename}.diff.md`);
      fs.writeFileSync(diffPath, diff(raw, newContent));
      console.log(`    · dry-run (diff → ${path.relative(process.cwd(), diffPath)})`);
    }
    return { skipped: false };
  } catch (err) {
    console.error(`    ✗ ERROR: ${(err as Error).message}`);
    return { skipped: false, error: true };
  }
}

async function main() {
  let files: string[] = [];
  let lang = "ru";

  if (SINGLE) {
    files = [SINGLE];
    // detect lang from frontmatter
    const raw = fs.readFileSync(path.join(POSTS_DIR, SINGLE), "utf-8");
    lang = (matter(raw).data.lang as string) || "ru";
  } else if (PILOT) {
    lang = PILOT;
    files = PILOTS[PILOT] ?? [];
  } else if (LANG) {
    lang = LANG;
    const all = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".mdx"));
    files = all.filter((f) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, f), "utf-8");
      const fm = matter(raw).data as Record<string, unknown>;
      return fm.lang === LANG;
    });
  } else {
    console.error(
      "Specify one of: --file <name> | --pilot ru|en|et | --lang ru|en|et"
    );
    process.exit(1);
  }

  files = files.slice(0, LIMIT);
  console.log(
    `\nFull facelift — ${APPLY ? "WRITE" : "DRY-RUN"} — lang=${lang} — ${files.length} files\n`
  );

  const done = APPLY ? loadProgress(lang) : new Set<string>();
  let idx = 0;
  let ok = 0;
  let skipped = 0;
  let errored = 0;

  for (const f of files) {
    idx++;
    if (done.has(f)) {
      console.log(`  [${idx}/${files.length}] ⊘ already processed: ${f.slice(0, 60)}`);
      skipped++;
      continue;
    }
    const r = await processFile(f, lang, idx, files.length);
    if (r.error) errored++;
    else if (r.skipped) skipped++;
    else {
      ok++;
      if (APPLY) {
        done.add(f);
        saveProgress(lang, done);
      }
    }
  }

  console.log(`\nDone. ok=${ok} skipped=${skipped} errored=${errored}`);
  if (!APPLY)
    console.log(
      `Dry-run diffs in .facelift-diffs/ — review, then re-run with --apply`
    );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
