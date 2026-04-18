/**
 * validate-content.ts — Parse every MDX file in content/posts and content/drafts.
 *
 * Purpose: catch invalid frontmatter BEFORE it reaches Vercel and blocks the
 * entire site build. A single bad YAML character in one post can break every
 * deployment — we want to find those locally or in CI, not in production.
 *
 * Exit code: 0 if all files parse cleanly, 1 if any fail.
 *
 * Usage:
 *   npx tsx scripts/validate-content.ts              # check all
 *   npx tsx scripts/validate-content.ts --fix-quotes # auto-repair broken titles
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const ROOT = path.join(process.cwd(), "content");
const FIX = process.argv.includes("--fix-quotes");

type Failure = {
  file: string;
  reason: string;
  headBlock: string;
};

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith(".mdx")) acc.push(full);
  }
  return acc;
}

function tryAutoRepair(raw: string): string | null {
  // Common corruption pattern: title truncated at an escaped quote
  //   title: "Something \"
  // The line ends with an unclosed quote. We can't recover the original title,
  // but we CAN convert the malformed line to valid YAML by closing the quote
  // with single-quote style. The human can fix the actual text later.
  const brokenTitleRe = /^(title):\s*"([^"]*)\\"$/m;
  const m = raw.match(brokenTitleRe);
  if (m) {
    const salvaged = m[2]; // text before the broken escape
    const replacement = `${m[1]}: '${salvaged.replace(/'/g, "''")} [BROKEN — please fix]'`;
    return raw.replace(brokenTitleRe, replacement);
  }
  return null;
}

function main() {
  const files = [...walk(path.join(ROOT, "posts")), ...walk(path.join(ROOT, "drafts"))];
  const failures: Failure[] = [];
  let repaired = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf-8");
    try {
      matter(raw);
    } catch (err) {
      const reason = (err as Error).message.split("\n")[0];
      const headBlock = raw.slice(0, 400);

      if (FIX) {
        const fixed = tryAutoRepair(raw);
        if (fixed) {
          fs.writeFileSync(file, fixed);
          // Re-validate
          try {
            matter(fixed);
            console.log(`  ✓ repaired: ${path.relative(process.cwd(), file)}`);
            repaired++;
            continue;
          } catch {
            // Fall through to failure
          }
        }
      }

      failures.push({
        file: path.relative(process.cwd(), file),
        reason,
        headBlock,
      });
    }
  }

  console.log(`\nScanned ${files.length} MDX files.`);
  if (repaired > 0) console.log(`Auto-repaired: ${repaired}`);

  if (failures.length === 0) {
    console.log("✅ All frontmatter valid.\n");
    process.exit(0);
  }

  console.log(`\n❌ ${failures.length} file(s) have invalid frontmatter — the Vercel build will FAIL until these are fixed:\n`);
  for (const f of failures) {
    console.log(`  ✗ ${f.file}`);
    console.log(`    reason: ${f.reason}`);
    console.log(`    first 200 chars:\n      ${f.headBlock.slice(0, 200).replace(/\n/g, "\n      ")}`);
    console.log();
  }
  console.log("Run with --fix-quotes to auto-repair common title-quote truncations.\n");
  process.exit(1);
}

main();
