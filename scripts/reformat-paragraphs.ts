/**
 * reformat-paragraphs.ts — Split long paragraphs into 5-6 sentence chunks.
 *
 * Pure deterministic, NO LLM. Inserts blank lines between sentences only.
 * Every character preserved exactly except added "\n\n" at split points.
 *
 * Usage:
 *   npx tsx scripts/reformat-paragraphs.ts                     # dry-run summary
 *   npx tsx scripts/reformat-paragraphs.ts --diff <slug>       # show diff for one post
 *   npx tsx scripts/reformat-paragraphs.ts --diff-sample 10    # diffs for 10 random candidates
 *   npx tsx scripts/reformat-paragraphs.ts --apply             # write changes to all
 *   npx tsx scripts/reformat-paragraphs.ts --apply --limit 20  # write first 20
 */
import fs from "fs";
import path from "path";

const POSTS = path.join(process.cwd(), "content/posts");
const APPLY = process.argv.includes("--apply");
const DIFF = process.argv.indexOf("--diff");
const DIFF_SAMPLE = process.argv.indexOf("--diff-sample");
const LIMIT_IDX = process.argv.indexOf("--limit");
const LIMIT = LIMIT_IDX >= 0 ? parseInt(process.argv[LIMIT_IDX + 1], 10) : Infinity;
const MIN_SENTENCES = 7;   // only split paragraphs longer than 6 sentences
const TARGET_CHUNK = 5;    // target chunk size

// Abbreviations that look like sentence-ends but aren't.
// Match the trailing dot — used to suppress false splits.
const ABBREV = new Set<string>([
  // English
  "dr", "mr", "mrs", "ms", "prof", "st", "no", "vs", "etc", "inc", "ltd",
  "co", "fig", "p", "pp", "vol", "ed", "eds", "u.s", "u.k", "e.g", "i.e",
  "approx", "min", "max", "sec", "hr", "hrs", "yrs", "g", "kg", "mg", "ml",
  "mm", "cm", "km", "ph", "phd", "md",
  // Estonian
  "hr", "pr", "nr", "lk", "lhk", "vt", "nt", "u", "kr", "krt", "k", "a",
  "saj", "snd", "u.s", "ehk", "ld",
  // Russian (transliterated short forms with dots)
  "г", "гг", "т", "тт", "т.е", "т.д", "т.п", "и.т.д", "и.т.п", "стр", "ст",
  "проф", "доц", "акад", "млн", "млрд", "тыс", "руб", "коп", "ул",
]);

type Block = { kind: "skip" | "para"; text: string; lineStart: number };

function isStructuralLine(line: string): boolean {
  if (/^\s*$/.test(line)) return true;
  if (/^\s*#{1,6}\s/.test(line)) return true;          // heading
  if (/^\s*[-*+]\s/.test(line)) return true;           // unordered list
  if (/^\s*\d+\.\s/.test(line)) return true;           // ordered list
  if (/^\s*>/.test(line)) return true;                  // blockquote
  if (/^\s*\|/.test(line)) return true;                 // table row
  if (/^\s*```/.test(line)) return true;                // code fence
  if (/^\s*<\w/.test(line)) return true;                // MDX/HTML tag at line start
  if (/^\s*!\[/.test(line)) return true;                // image-only line
  return false;
}

function tokenizeBlocks(body: string): Block[] {
  const lines = body.split("\n");
  const blocks: Block[] = [];
  let buffer: string[] = [];
  let bufStart = 0;
  let inFence = false;
  let inComponent = false;

  function flush(endIdx: number) {
    if (buffer.length === 0) return;
    blocks.push({ kind: "para", text: buffer.join("\n"), lineStart: bufStart });
    buffer = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track triple-backtick fences
    if (/^\s*```/.test(line)) {
      flush(i);
      blocks.push({ kind: "skip", text: line, lineStart: i });
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      blocks.push({ kind: "skip", text: line, lineStart: i });
      continue;
    }

    // Track multi-line MDX components (line begins with < and we see no > yet)
    if (!inComponent && /^\s*<\w/.test(line) && !/>\s*$/.test(line.trim())) {
      flush(i);
      inComponent = true;
      blocks.push({ kind: "skip", text: line, lineStart: i });
      continue;
    }
    if (inComponent) {
      blocks.push({ kind: "skip", text: line, lineStart: i });
      if (/\/?>\s*$/.test(line.trim())) inComponent = false;
      continue;
    }

    if (isStructuralLine(line)) {
      flush(i);
      blocks.push({ kind: "skip", text: line, lineStart: i });
      continue;
    }

    if (buffer.length === 0) bufStart = i;
    buffer.push(line);
  }
  flush(lines.length);
  return blocks;
}

/**
 * Split paragraph text into sentence boundaries.
 * Returns sentence strings (each WITHOUT trailing whitespace; rejoined with " ").
 * Conservative: only splits on .!? followed by whitespace then a capital letter,
 * skipping common abbreviations.
 */
function splitSentences(text: string): string[] {
  // Normalize internal newlines to single spaces (paragraph reflow before split)
  let normalized = text.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
  // Fix orphan punctuation: source posts often had sentence-ending dots wrapped
  // onto their own line (`eduks\n. Kuigi`), which after reflow leaves
  // a stray space before the punctuation (`eduks . Kuigi`). Reattach.
  normalized = normalized.replace(/ +([.!?,;:])/g, "$1");
  const sentences: string[] = [];
  let i = 0;
  let start = 0;
  while (i < normalized.length) {
    const ch = normalized[i];
    if (ch === "." || ch === "!" || ch === "?" || ch === "…") {
      // Consume any following . ! ? (e.g. "?!", "…")
      let j = i;
      while (j + 1 < normalized.length && /[.!?…]/.test(normalized[j + 1])) j++;
      // Lookahead: must be EOS or whitespace then capital / opening quote / number-bullet
      const after = normalized.slice(j + 1);
      const ws = after.match(/^(\s+)/);
      if (!ws && j + 1 < normalized.length) {
        i = j + 1;
        continue;
      }
      const next = ws ? after.slice(ws[1].length) : "";
      const nextCh = next[0] || "";
      const startsNew =
        !nextCh ||
        /[A-ZÕÄÖÜÜŠŽÀ-ÿА-Я«„"'(\[]/.test(nextCh) ||
        /^\d/.test(nextCh);
      // Check abbreviation (only for "." not "!" "?")
      if (ch === ".") {
        // Look back at the word right before the dot
        const before = normalized.slice(start, i);
        const wordMatch = before.match(/([A-Za-zÕÄÖÜõäöüА-Яа-я.]+)$/);
        const word = (wordMatch?.[1] || "").toLowerCase();
        // Drop trailing dots in the captured word for abbrev lookup
        const wordNoTrail = word.replace(/\.+$/, "");
        if (ABBREV.has(wordNoTrail)) {
          i = j + 1;
          continue;
        }
        // Initials: single letter then dot (e.g. "A. Haavel")
        if (/^[a-zA-ZÕÄÖÜõäöü]$/.test(wordNoTrail)) {
          i = j + 1;
          continue;
        }
      }
      if (startsNew) {
        sentences.push(normalized.slice(start, j + 1));
        // skip whitespace
        const wsLen = ws ? ws[1].length : 0;
        i = j + 1 + wsLen;
        start = i;
        continue;
      }
    }
    i++;
  }
  if (start < normalized.length) {
    sentences.push(normalized.slice(start));
  }
  return sentences.map((s) => s.trim()).filter(Boolean);
}

/**
 * Choose chunk boundaries: aim for chunks of 5 sentences, but don't leave a
 * tiny tail. Examples:
 *   7 sentences → [4, 3]
 *   8 → [4, 4]
 *   9 → [5, 4]
 *   10 → [5, 5]
 *   11 → [4, 4, 3]
 *   12 → [4, 4, 4]
 *   13 → [5, 4, 4]
 */
function chunkBoundaries(n: number): number[] {
  if (n <= 6) return [n];
  const numChunks = Math.ceil(n / TARGET_CHUNK);
  const base = Math.floor(n / numChunks);
  const extra = n - base * numChunks;
  const sizes: number[] = [];
  for (let i = 0; i < numChunks; i++) sizes.push(base + (i < extra ? 1 : 0));
  return sizes;
}

function hasMarkdownSoftBreaks(text: string): boolean {
  // Markdown soft-break: line ending with two trailing spaces or a backslash.
  // These are intentional line breaks (often used for list-like content
  // without being a formal list). Touching such blocks corrupts layout.
  if (/  +\n/.test(text)) return true;
  if (/\\\n/.test(text)) return true;
  // Multi-line block where any internal line is short (< 60 chars), suggests
  // line-broken list-like content, not flowing prose.
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 3) {
    const shortLines = lines.filter((l) => l.length < 60).length;
    if (shortLines >= 2) return true;
  }
  return false;
}

function reflowParagraph(text: string): string | null {
  // Only touch blocks that are a single flowing line (or multi-line wrap of one).
  // Anything with intentional soft-breaks or short list-like lines is preserved.
  if (hasMarkdownSoftBreaks(text)) return null;
  const sentences = splitSentences(text);
  if (sentences.length < MIN_SENTENCES) return null;
  const sizes = chunkBoundaries(sentences.length);
  const chunks: string[] = [];
  let idx = 0;
  for (const sz of sizes) {
    chunks.push(sentences.slice(idx, idx + sz).join(" "));
    idx += sz;
  }
  return chunks.join("\n\n");
}

function reformatBody(body: string): { changed: boolean; out: string; splitCount: number } {
  const blocks = tokenizeBlocks(body);
  const outLines: string[] = [];
  let splitCount = 0;
  for (const b of blocks) {
    if (b.kind === "skip") {
      outLines.push(b.text);
      continue;
    }
    const reflowed = reflowParagraph(b.text);
    if (reflowed === null) {
      outLines.push(b.text);
    } else {
      outLines.push(reflowed);
      splitCount++;
    }
  }
  const out = outLines.join("\n");
  return { changed: out !== body, out, splitCount };
}

/** Verify reformat preserved every non-whitespace character. */
function verifyCharsPreserved(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, "");
  return norm(a) === norm(b);
}

function showDiff(file: string, before: string, after: string) {
  const a = before.split("\n");
  const b = after.split("\n");
  console.log(`\n--- BEFORE: ${file} (${a.length} lines)`);
  console.log(`+++ AFTER:  ${file} (${b.length} lines)`);
  // Print just the paragraph blocks that changed (very simple: show first 60 lines of each)
  const head = (arr: string[]) => arr.slice(0, 80).join("\n");
  console.log("\n=== BEFORE (first 80 lines) ===");
  console.log(head(a));
  console.log("\n=== AFTER (first 80 lines) ===");
  console.log(head(b));
}

function processFile(fp: string): { changed: boolean; splitCount: number; verified: boolean; out: string; before: string } {
  const raw = fs.readFileSync(fp, "utf-8");
  const fmMatch = raw.match(/^---\n[\s\S]*?\n---\n/);
  if (!fmMatch) return { changed: false, splitCount: 0, verified: true, out: raw, before: raw };
  const fm = fmMatch[0];
  const body = raw.slice(fm.length);
  const { changed, out, splitCount } = reformatBody(body);
  const verified = verifyCharsPreserved(body, out);
  return { changed, splitCount, verified, out: fm + out, before: raw };
}

function main() {
  const files = fs.readdirSync(POSTS).filter((f) => f.endsWith(".mdx"));

  if (DIFF >= 0 && process.argv[DIFF + 1]) {
    const slug = process.argv[DIFF + 1];
    const file = files.find((f) => f.includes(slug));
    if (!file) {
      console.log(`No file matching: ${slug}`);
      return;
    }
    const { changed, splitCount, verified, out, before } = processFile(path.join(POSTS, file));
    console.log(`File: ${file}`);
    console.log(`Changed: ${changed}  Splits: ${splitCount}  Verified: ${verified}`);
    if (changed) showDiff(file, before, out);
    return;
  }

  // Build candidate list (files where reformat would change something)
  const results = files.map((f) => {
    const r = processFile(path.join(POSTS, f));
    return { file: f, ...r };
  });
  const candidates = results.filter((r) => r.changed);
  const verified = candidates.filter((r) => r.verified).length;
  const failed = candidates.filter((r) => !r.verified);

  if (DIFF_SAMPLE >= 0) {
    const n = parseInt(process.argv[DIFF_SAMPLE + 1] ?? "10", 10);
    const sample = candidates.sort((a, b) => b.splitCount - a.splitCount).slice(0, n);
    for (const c of sample) {
      console.log(`\n${"=".repeat(80)}\n${c.file}  splits=${c.splitCount}  verified=${c.verified}`);
      showDiff(c.file, c.before, c.out);
    }
    return;
  }

  console.log(`\nTotal posts:    ${files.length}`);
  console.log(`Would change:   ${candidates.length}`);
  console.log(`Char-verified:  ${verified}/${candidates.length}`);
  if (failed.length) {
    console.log(`\n⚠  ${failed.length} files failed char-preservation check:`);
    for (const f of failed.slice(0, 20)) console.log(`   ${f.file}`);
  }

  // Top 10 by splits
  const top = candidates.sort((a, b) => b.splitCount - a.splitCount).slice(0, 15);
  console.log(`\nTop candidates by # paragraphs split:`);
  for (const t of top) console.log(`  splits=${t.splitCount}  ${t.file}`);

  if (!APPLY) {
    console.log(`\n(dry-run — pass --apply to write, or --diff-sample N to inspect N diffs)\n`);
    return;
  }

  const toWrite = candidates.filter((r) => r.verified).slice(0, LIMIT);
  let n = 0;
  for (const r of toWrite) {
    fs.writeFileSync(path.join(POSTS, r.file), r.out);
    n++;
  }
  console.log(`\nWrote ${n} files. Skipped ${failed.length} due to char-preservation failures.\n`);
}

main();
