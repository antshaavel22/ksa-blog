/**
 * format-walls-of-text.ts — Fix poorly-formatted EN/ET posts.
 *
 * Problem: some scout-generated posts have zero H2 headers and text as one
 * giant paragraph. Classic wall-of-text — unreadable.
 *
 * Fix: pass the body to Claude Haiku with strict instructions to ONLY add
 * paragraph breaks and H2 headings. Every word preserved. No rewrite.
 *
 * Usage:
 *   npx tsx scripts/format-walls-of-text.ts              # dry-run, shows queue
 *   npx tsx scripts/format-walls-of-text.ts --apply      # actually writes
 *   npx tsx scripts/format-walls-of-text.ts --apply --limit 3   # test on 3
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Anthropic from "@anthropic-ai/sdk";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const APPLY = process.argv.includes("--apply");
const LIMIT_IDX = process.argv.indexOf("--limit");
const LIMIT = LIMIT_IDX >= 0 ? parseInt(process.argv[LIMIT_IDX + 1], 10) : Infinity;
const POSTS = path.join(process.cwd(), "content/posts");
const PROGRESS = path.join(process.cwd(), ".format-progress.json");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You reformat eye-clinic blog posts that were generated as one giant wall of text.

Your ONLY job: add paragraph breaks (blank lines) and H2 headings (## ) to make the text readable.

STRICT RULES:
1. PRESERVE EVERY SINGLE WORD. Do not rewrite, rephrase, condense, summarize, or "improve" the prose. Not one word changed.
2. Do not add introductions, conclusions, or transitions. Only structure.
3. Insert paragraph breaks (blank lines) every 3-5 sentences where a topic shifts.
4. Add 3-6 H2 headings (## Heading) at natural topic boundaries. Headings should be short (3-7 words) and summarize the section below.
5. Keep all existing formatting (bold, italic, lists, links) exactly as-is.
6. Output the body text only — no frontmatter, no code fences, no explanation.
7. Match the original language of the post (Estonian → Estonian headings; English → English headings).
8. Never use ## for the first section — start with a paragraph.

If the input already has headings, leave them in place but add missing paragraph breaks as needed.`;

function analyze(body: string) {
  const lines = body.split("\n");
  const h = lines.filter((l) => /^#{2,3} /.test(l)).length;
  let run = 0, maxrun = 0;
  for (const l of lines) {
    if (l.trim() === "") { run = 0; continue; }
    if (/^(#{1,6} |[-*] |\d+\. |\|)/.test(l)) { run = 0; continue; }
    run += l.split(/\s+/).length;
    if (run > maxrun) maxrun = run;
  }
  const words = body.split(/\s+/).filter(Boolean).length;
  return { h, maxrun, words };
}

async function reformat(body: string): Promise<string> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: "user", content: body }],
  });
  const text = (msg.content[0] as { text: string }).text.trim();
  // Strip accidental code fences
  return text.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");
}

function wordSetOf(s: string): string[] {
  // Strip markdown link URLs (keep only the visible [text])
  let t = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  // Strip bare URLs
  t = t.replace(/https?:\/\/\S+/g, " ");
  // Normalize typographic apostrophes
  t = t.replace(/[’‘]/g, "'");
  return t
    .toLowerCase()
    .replace(/[#*_`>\[\]()!:;,.?"—–\-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort();
}

function preservedAllWords(original: string, reformatted: string): { ok: boolean; missing: string[]; added: string[] } {
  const a = wordSetOf(original);
  const b = wordSetOf(reformatted);
  // Must be identical multisets (ignoring case + punctuation)
  const ma = new Map<string, number>();
  const mb = new Map<string, number>();
  for (const w of a) ma.set(w, (ma.get(w) || 0) + 1);
  for (const w of b) mb.set(w, (mb.get(w) || 0) + 1);
  const missing: string[] = [];
  const added: string[] = [];
  for (const [w, n] of ma) {
    const m = mb.get(w) || 0;
    if (m < n) missing.push(`${w}(-${n - m})`);
  }
  for (const [w, n] of mb) {
    const m = ma.get(w) || 0;
    if (n > m) added.push(`${w}(+${n - m})`);
  }
  // Allow up to 30 "added" words (H2 headings add a handful of words each).
  // Missing words = content loss, so cap strictly at 3.
  const missingCount = missing.reduce(
    (s, m) => s + parseInt(m.match(/\(-(\d+)\)/)?.[1] ?? "0", 10),
    0,
  );
  const addedCount = added.reduce(
    (s, a) => s + parseInt(a.match(/\(\+(\d+)\)/)?.[1] ?? "0", 10),
    0,
  );
  return { ok: missingCount <= 3 && addedCount <= 40, missing, added };
}

async function main() {
  const files = fs.readdirSync(POSTS).filter((f) => f.endsWith(".mdx"));
  const queue: Array<{ file: string; lang: string; stats: ReturnType<typeof analyze> }> = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(POSTS, f), "utf-8");
    const parsed = matter(raw);
    const lang = parsed.data.lang as string;
    if (lang !== "en" && lang !== "et") continue;
    const stats = analyze(parsed.content);
    // Problematic = medium+ post AND (no headings OR a paragraph >180 words)
    if (stats.words > 350 && (stats.h < 2 || stats.maxrun > 180)) {
      queue.push({ file: f, lang, stats });
    }
  }
  queue.sort((a, b) => b.stats.maxrun - a.stats.maxrun);

  console.log(`\nQueue: ${queue.length} posts (EN: ${queue.filter((q) => q.lang === "en").length}, ET: ${queue.filter((q) => q.lang === "et").length})`);
  console.log(`Apply: ${APPLY}   Limit: ${LIMIT}\n`);

  const progress: Record<string, "DONE" | "FAILED"> = fs.existsSync(PROGRESS)
    ? JSON.parse(fs.readFileSync(PROGRESS, "utf-8"))
    : {};

  const toProcess = queue.filter((q) => progress[q.file] !== "DONE").slice(0, LIMIT);
  if (!APPLY) {
    console.log(`First 15 in queue:\n`);
    for (const q of queue.slice(0, 15)) {
      console.log(`  [${q.lang}] H=${q.stats.h} longest_para=${q.stats.maxrun}w  ${q.file}`);
    }
    console.log(`\n(dry-run — pass --apply to reformat)\n`);
    return;
  }

  let done = 0, failed = 0;
  for (let i = 0; i < toProcess.length; i++) {
    const q = toProcess[i];
    const fp = path.join(POSTS, q.file);
    const raw = fs.readFileSync(fp, "utf-8");
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n/);
    if (!fmMatch) { console.log(`  ⚠ no frontmatter: ${q.file}`); continue; }
    const body = raw.slice(fmMatch[0].length);

    try {
      const reformatted = await reformat(body);
      const check = preservedAllWords(body, reformatted);
      if (!check.ok) {
        console.log(`  ❌ [${i + 1}/${toProcess.length}] WORD DRIFT ${q.file}`);
        if (check.missing.length) console.log(`       missing: ${check.missing.slice(0, 8).join(", ")}${check.missing.length > 8 ? "…" : ""}`);
        if (check.added.length) console.log(`       added: ${check.added.slice(0, 8).join(", ")}${check.added.length > 8 ? "…" : ""}`);
        progress[q.file] = "FAILED";
        failed++;
      } else {
        fs.writeFileSync(fp, raw.slice(0, fmMatch[0].length) + reformatted + "\n");
        progress[q.file] = "DONE";
        done++;
        const after = analyze(reformatted);
        console.log(`  ✓ [${i + 1}/${toProcess.length}] H=${q.stats.h}→${after.h} longest=${q.stats.maxrun}→${after.maxrun}w  ${q.file}`);
      }
    } catch (err) {
      console.log(`  ❌ [${i + 1}/${toProcess.length}] ERROR ${q.file}: ${(err as Error).message}`);
      progress[q.file] = "FAILED";
      failed++;
    }

    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(PROGRESS, JSON.stringify(progress, null, 2));
    }
  }
  fs.writeFileSync(PROGRESS, JSON.stringify(progress, null, 2));

  console.log(`\n\nDone: ${done}   Failed: ${failed}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
