/**
 * fix-orphan-dots.ts — reattach orphan sentence-ending dots that wrap onto
 * their own line in old AI-generated drafts.
 *
 * Pattern (happens in scout RU output especially):
 *   "...потерю зрения\n. Исторически возможности..."
 *
 * Fix: collapse "\n. " (or "\n? ", "\n! ") at line start back to the
 * preceding word. Then ensure single newline doesn't accidentally remove
 * intentional paragraph break — only acts within a paragraph block.
 *
 * Pure deterministic. Char-multiset preservation enforced.
 *
 * Usage:
 *   npx tsx scripts/fix-orphan-dots.ts            # dry-run summary
 *   npx tsx scripts/fix-orphan-dots.ts --apply    # write
 */
import fs from "fs";
import path from "path";

const POSTS = path.join(process.cwd(), "content/posts");
const DRAFTS_ROOT = path.join(process.cwd(), "content/drafts");
const APPLY = process.argv.includes("--apply");
const INCLUDE_DRAFTS = process.argv.includes("--drafts");

function fixBody(body: string): { out: string; changed: boolean } {
  // Within a paragraph block (no blank line), collapse a line that begins
  // with sentence-ending punctuation back onto the previous line.
  //   "...word\n. Next" → "...word. Next"
  //   "...word\n? Next" → "...word? Next"
  //   "...word\n... Next" → "...word... Next"
  let out = body.replace(/([^\n])\n([.!?…]+)\s+/g, "$1$2 ");
  // Also strip leading-whitespace-before-period: "word ." → "word."
  out = out.replace(/(\S) +([.!?,;:])/g, "$1$2");
  return { out, changed: out !== body };
}

function verifyCharsPreserved(a: string, b: string): boolean {
  return a.replace(/\s+/g, "") === b.replace(/\s+/g, "");
}

function listAllMdx(): string[] {
  const out: string[] = [];
  for (const f of fs.readdirSync(POSTS)) if (f.endsWith(".mdx")) out.push(path.join(POSTS, f));
  if (INCLUDE_DRAFTS && fs.existsSync(DRAFTS_ROOT)) {
    for (const lang of fs.readdirSync(DRAFTS_ROOT)) {
      const langDir = path.join(DRAFTS_ROOT, lang);
      if (!fs.statSync(langDir).isDirectory()) continue;
      for (const f of fs.readdirSync(langDir)) if (f.endsWith(".mdx")) out.push(path.join(langDir, f));
    }
  }
  return out;
}

function main() {
  const allFiles = listAllMdx();
  let candidates = 0, applied = 0, failed = 0;
  const failedFiles: string[] = [];
  for (const fp of allFiles) {
    const f = path.relative(process.cwd(), fp);
    const raw = fs.readFileSync(fp, "utf-8");
    const fmMatch = raw.match(/^---\n[\s\S]*?\n---\n/);
    if (!fmMatch) continue;
    const body = raw.slice(fmMatch[0].length);
    const { out, changed } = fixBody(body);
    if (!changed) continue;
    candidates++;
    if (!verifyCharsPreserved(body, out)) { failed++; failedFiles.push(f); continue; }
    if (APPLY) {
      fs.writeFileSync(fp, raw.slice(0, fmMatch[0].length) + out);
      applied++;
    }
  }
  console.log(`\nOrphan-dot fixer:`);
  console.log(`  Files needing fix: ${candidates}`);
  console.log(`  Char-verification failures: ${failed}`);
  if (failedFiles.length) for (const f of failedFiles) console.log(`    ${f}`);
  if (APPLY) console.log(`  Applied: ${applied}`);
  else console.log(`  (dry-run — pass --apply to write)`);
}

main();
