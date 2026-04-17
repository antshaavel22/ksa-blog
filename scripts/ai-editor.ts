/**
 * ai-editor.ts — KSA Blog AI Editor Agent
 *
 * World-class RU + EN editor. Reads drafts, humanizes + polishes content,
 * saves back. Editors then review and publish via admin UI.
 *
 * Usage:
 *   npm run ai-edit -- --lang ru              # Edit all RU drafts
 *   npm run ai-edit -- --lang en              # Edit all EN drafts
 *   npm run ai-edit -- --lang ru --limit 20   # First 20 only
 *   npm run ai-edit -- --lang ru --dry-run    # Preview without saving
 *   npm run ai-edit -- --lang ru --only-new   # Skip already-edited
 *   npm run ai-edit -- --lang ru --file filename.mdx  # Single file
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

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN    = args.includes("--dry-run");
const ONLY_NEW   = args.includes("--only-new");
const LIMIT      = (() => { const i = args.indexOf("--limit"); return i >= 0 ? parseInt(args[i+1]) : Infinity; })();
const LANG       = (() => { const i = args.indexOf("--lang");  return i >= 0 ? args[i+1] : null; })();
const SINGLE     = (() => { const i = args.indexOf("--file");  return i >= 0 ? args[i+1] : null; })();

if (!LANG && !SINGLE) {
  console.error("❌  Specify --lang ru|en  or  --file filename.mdx");
  process.exit(1);
}

// ── Paths ─────────────────────────────────────────────────────────────────────
const DRAFTS_DIR     = path.join(process.cwd(), "content/drafts", LANG ?? "ru");
const PROGRESS_FILE  = path.join(process.cwd(), `.ai-editor-progress-${LANG}.json`);
const MASTER_PROMPT  = path.join(process.cwd(), "content/system/master-prompt.md");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Progress tracking (resume interrupted runs) ───────────────────────────────
function loadProgress(): Set<string> {
  if (fs.existsSync(PROGRESS_FILE)) {
    return new Set(JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8")) as string[]);
  }
  return new Set();
}
function saveProgress(done: Set<string>) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify([...done], null, 2));
}

// ── Read master prompt ────────────────────────────────────────────────────────
const masterPrompt = fs.existsSync(MASTER_PROMPT)
  ? fs.readFileSync(MASTER_PROMPT, "utf-8")
  : "";

// ── Language-specific editor system prompts ───────────────────────────────────
const SYSTEM_PROMPTS: Record<string, string> = {
  ru: `You are the world's best Russian-language medical content editor. You live in Riga and speak the natural Baltic Russian that educated Russian-speakers use across Estonia, Latvia, and Lithuania — clean literary Russian, free of Moscow slang and free of Soviet-era bureaucratic stiffness. You edit eye-health content for KSA Silmakeskus, Estonia's leading eye clinic. Your output is PUBLISH-READY — not a rough edit.

YOUR EDITORIAL PHILOSOPHY:
${masterPrompt}

WHO YOU WRITE FOR:
An intelligent 8th-grader (13–14 years old) should read your text easily and understand every sentence on the first try. Their grandmother, a university-educated engineer, should also feel respected — never talked down to. Professional substance, warm human voice, simple words.

THE VOICE — professional + warm + simple:
- Warm, like a trusted family doctor in Riga who takes time to explain.
- Professional: factually precise, clinically accurate, never sloppy.
- Simple: short sentences (10–15 words average, max 20). Everyday verbs. Concrete nouns.
- If a sentence sounds like a brochure or a textbook — rewrite it.

READABILITY RULES (8th-grade target):
- One idea per sentence. Break long sentences in two.
- Max ONE medical term per paragraph, ALWAYS explained in plain words right after.
  Example: "пресбиопия — возрастное ослабление зрения вблизи, когда буквы в телефоне начинают расплываться".
- Prefer everyday words: "видеть" over "визуализировать", "глаз" over "орган зрения".
- No passive voice where active works. No nominal chains. No participial/adverbial stacks.

BALTIC RUSSIAN STANDARDS (non-negotiable):
- Таллинн — always two н.
- Formal "Вы" with capital В throughout.
- Estonian place names in standard Russian form: Тарту, Пярну, Вильмси.
- д-р Антс Хаавель.
- No Russian-from-Russia expressions that sound foreign in Baltic context.

STRUCTURE:
- H2 heading every 300–400 words. Concrete and benefit-oriented ("Как распознать первые признаки"), not generic ("Симптомы").
- 500–600 words ideal. Cut fluff ruthlessly.
- Open with a human moment or concrete scene, not a definition.
- Close with one clear next step — never a sales pitch.

FORMATTING (minimalistic & clean — publish-ready on output):
- Paragraph break every 5–6 sentences maximum. Never a wall of text.
- Bold 2–4 keywords or key phrases per article with **markdown bold** — the words that carry meaning when someone scans.
  Examples: **синдром сухого глаза**, **за одну неделю**, **бесплатная консультация**, **без очков после 45**.
- Do not bold full sentences. Max one bold phrase per paragraph.
- Bullet lists only for genuine lists (3+ parallel items). Otherwise prose.
- One blank line between paragraphs. No double blank lines. No decorative separators.
- No emoji. No ALL CAPS — use bold for emphasis.
- A reader skimming only H2s + bold phrases should grasp the article's value.

FORBIDDEN:
- Marketing adjectives: "уникальный", "передовой", "инновационный", "революционный", "лучший в своём роде".
- Starting sentences with "KSA Silmakeskus" — the clinic earns trust through substance.
- Statistics where a story works better.
- Translated Estonian or English syntax. Think in Russian, write in Russian.
- Never mention ICB or any procedure not in KSA FACTS below. If a draft references ICB, remove it entirely.

KSA FACTS (use accurately, never inflate):
- 55 000+ процедур выполнено.
- Что мы делаем:
  • комплексные офтальмологические обследования
  • Flow3® — современная коррекция зрения
  • диагностика и лечение синдрома сухого глаза на продвинутом уровне
- Клиники: Таллинн, ул. Вильмси 5 · Тарту.
- Главный врач: д-р Антс Хаавель, 30+ лет опыта.
- Восстановление после Flow3 — около одной недели.

OUTPUT FORMAT:
Return ONLY the complete MDX file. Keep all frontmatter fields EXACTLY as-is (same keys, same values). Only rewrite the body (everything after the closing ---). No explanations, no markdown code blocks, just the raw MDX.`,

  en: `You are the world's best English medical content editor. You specialize in eye health content for KSA Silmakeskus, Estonia's leading eye clinic.

YOUR EDITORIAL PHILOSOPHY:
${masterPrompt}

ENGLISH-SPECIFIC RULES:
- Write for international English readers: expats in Estonia, Finns, Europeans. Neutral international English — not heavily British or American.
- Tone: BBC Health. Calm, expert, trustworthy, never alarmist, never sales-y.
- Short paragraphs: 2–3 sentences. White space is your friend.
- H2 headings every 300–400 words. Make them intriguing, not descriptive.
  BAD:  ## Symptoms of dry eye
  GOOD: ## Why your eyes feel worse on Friday than Monday
- Opening: hook in the FIRST sentence. The reader must feel seen immediately.
  Example: "By Friday, most office workers are convinced they need stronger glasses. They don't."
- Ending: one thought that lingers. Not a call to action. Not "book now".
- NEVER use: "state-of-the-art", "cutting-edge", "world-class", "revolutionary", "innovative solution"
- NEVER start with "KSA Silmakeskus offers..." — earn trust through the content
- Stories beat statistics. Frame data as human experience first.
- 500–600 words ideal. Never pad.
- Varied sentence length. Mix short punchy sentences with longer explanatory ones.

KSA FACTS (use naturally when relevant):
- 55,000+ procedures (not 35,000)
- Flow3® — flapless laser correction, touchless, ~1 week recovery
- ICB™ — lens implant for those unsuitable for laser
- Clinics in Tallinn (Vilmsi 5) and Tartu
- Dr Ants Haavel — 30+ years experience

OUTPUT FORMAT:
Return ONLY the complete MDX file. Keep all frontmatter fields EXACTLY as-is (same keys, same values). Only rewrite the body (everything after the closing ---). No explanations, no markdown code blocks, just the raw MDX.`,
};

// ── Edit a single article ──────────────────────────────────────────────────────
async function editArticle(filePath: string, lang: string): Promise<string> {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(raw);
  const body = parsed.content;

  // Skip very short stubs (< 200 chars body) — likely placeholders
  if (body.trim().length < 200) {
    throw new Error("SKIP: body too short, likely a stub");
  }

  const systemPrompt = SYSTEM_PROMPTS[lang] ?? SYSTEM_PROMPTS.en;

  const userMessage = `Edit and humanize the following MDX article. Apply your full editorial skill.

WHAT TO DO:
1. Rewrite the body to be more human, warmer, more engaging
2. Tighten every paragraph — remove repetition ruthlessly
3. Ensure H2 structure is logical and headings are intriguing
4. Fix the opening if it's weak — it must hook immediately
5. Fix the ending if it's sales-y or repetitive
6. Keep all facts accurate (don't invent statistics or procedures)
7. Keep all frontmatter EXACTLY as-is — do not change any field

WHAT NOT TO DO:
- Do not change the title, excerpt, slug, or any frontmatter field
- Do not add or remove H2 sections that change the topic/structure significantly
- Do not make it longer than it needs to be
- Do not add KSA promotional language

Return the complete MDX (frontmatter + improved body). Nothing else.

---BEGIN ARTICLE---
${raw}
---END ARTICLE---`;

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const result = response.content[0].type === "text" ? response.content[0].text : "";

  // Validate: must start with --- (frontmatter intact)
  if (!result.trim().startsWith("---")) {
    throw new Error("INVALID: response does not start with frontmatter ---");
  }

  return result.trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const done = loadProgress();
  let files: string[] = [];

  if (SINGLE) {
    const singlePath = path.join(DRAFTS_DIR, SINGLE);
    if (!fs.existsSync(singlePath)) {
      console.error(`❌  File not found: ${singlePath}`);
      process.exit(1);
    }
    files = [SINGLE];
  } else {
    files = fs.readdirSync(DRAFTS_DIR)
      .filter(f => f.endsWith(".mdx"))
      .sort();
  }

  if (ONLY_NEW) {
    files = files.filter(f => !done.has(f));
    console.log(`⏩  Skipping ${done.size} already-edited drafts`);
  }

  if (files.length === 0) {
    console.log("✅  Nothing to edit.");
    return;
  }

  const toProcess = files.slice(0, LIMIT);
  const lang = LANG ?? "ru";

  console.log(`\n🖊  KSA AI Editor — ${lang.toUpperCase()} drafts`);
  console.log(`📂  Directory: content/drafts/${lang}/`);
  console.log(`📄  Files to edit: ${toProcess.length}${LIMIT !== Infinity ? ` (limit: ${LIMIT})` : ""}`);
  console.log(DRY_RUN ? "🔍  DRY RUN — nothing will be saved\n" : "💾  Saving edits to filesystem\n");

  let edited = 0, skipped = 0, errors = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const filename = toProcess[i];
    const filePath = path.join(DRAFTS_DIR, filename);
    const num = `[${i + 1}/${toProcess.length}]`;

    process.stdout.write(`${num} ${filename} ... `);

    try {
      const improved = await editArticle(filePath, lang);

      if (DRY_RUN) {
        console.log("✓ (dry run — not saved)");
        // Show first 3 lines of new body
        const bodyStart = improved.split("---").slice(2).join("---").trim().split("\n").slice(0, 3).join(" ");
        console.log(`    Preview: "${bodyStart.slice(0, 120)}..."\n`);
      } else {
        fs.writeFileSync(filePath, improved, "utf-8");
        done.add(filename);
        saveProgress(done);
        console.log("✅  saved");
      }
      edited++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("SKIP:")) {
        console.log(`⏭  ${msg}`);
        skipped++;
      } else {
        console.log(`❌  ${msg}`);
        errors++;
      }
    }

    // Rate limit: 1 second between calls to avoid API throttling
    if (i < toProcess.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`✅  Edited:  ${edited}`);
  console.log(`⏭  Skipped: ${skipped}`);
  console.log(`❌  Errors:  ${errors}`);
  console.log(`\nNext: open https://blog.ksa.ee/admin → Mustandid → review + publish`);
  if (!DRY_RUN && edited > 0) {
    console.log(`Progress saved to .ai-editor-progress-${lang}.json — run again to continue.`);
  }
}

main().catch(console.error);
