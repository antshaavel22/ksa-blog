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
// Auto-repair by default. The build must never fail because one field is
// malformed — we'd rather deploy with a [BROKEN] placeholder title that Silvia
// can fix later than block the entire site for every other post. Pass
// --strict to disable auto-repair.
const STRICT = process.argv.includes("--strict");
const FIX = !STRICT;

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

function stripNullCategoryEntries(raw: string): string | null {
  // Match the YAML categories block and remove items that are empty after `- `.
  // Block ends at first non-indented line (next key or `---`).
  const re = /^categories:\s*\n((?:[ \t]+-[^\n]*\n)+)/m;
  const m = raw.match(re);
  if (!m) return null;
  const block = m[1];
  const kept = block
    .split("\n")
    .filter((line) => {
      if (!line.trim()) return false;
      // `  - foo` keep, `  -` or `  - ` drop, `  - ""` drop, `  - null` drop.
      const after = line.replace(/^[ \t]+-\s*/, "").trim();
      if (after === "" || after === '""' || after === "''" || after === "null" || after === "~") return false;
      return true;
    })
    .join("\n");
  const newBlock = kept ? `categories:\n${kept}\n` : `categories: []\n`;
  return raw.replace(re, newBlock);
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

/**
 * Convert raw Rendia embed HTML to the MDX component. The raw form
 *   <var style="..." data-presentation="UUID">...</var>
 *   <script src="//hub.rendia.com/whitelabel/embed.js"></script>
 * crashes Vercel prerender because React rejects `style="..."` strings in MDX.
 * The MDX form `<RendiaEmbed id="UUID" />` works correctly.
 */
function repairRawRendiaEmbed(raw: string): { fixed: string; count: number } {
  const RENDIA_RE = /<var\b[^>]*\bdata-presentation=["']([0-9a-f-]+)["'][^>]*>[\s\S]*?<\/var>(?:\s*<script[^>]*hub\.rendia\.com[^>]*><\/script>)?/gi;
  let count = 0;
  const fixed = raw.replace(RENDIA_RE, (_match, id) => {
    count++;
    return `<RendiaEmbed id="${id}" caption="Source: Rendia" />`;
  });
  return { fixed, count };
}

/**
 * Detect any remaining HTML-string `style="..."` attribute in the MDX body
 * (after frontmatter). These crash React prerender. We can't safely auto-fix
 * arbitrary inline styles, so we surface them as a hard failure with the
 * line content and let the editor remove or convert them.
 */
function findRawStyleAttrs(body: string): { line: number; snippet: string }[] {
  const STYLE_RE = /\bstyle=["'][^"']+["']/g;
  const lines = body.split("\n");
  const hits: { line: number; snippet: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (STYLE_RE.test(lines[i])) {
      hits.push({ line: i + 1, snippet: lines[i].trim().slice(0, 200) });
      STYLE_RE.lastIndex = 0;
    }
  }
  return hits;
}

function main() {
  const files = [...walk(path.join(ROOT, "posts")), ...walk(path.join(ROOT, "drafts"))];
  const failures: Failure[] = [];
  let repaired = 0;

  for (const file of files) {
    let raw = fs.readFileSync(file, "utf-8");

    // Body-level check: raw Rendia HTML — auto-repair to MDX component.
    const rendiaResult = repairRawRendiaEmbed(raw);
    if (rendiaResult.count > 0) {
      if (FIX) {
        fs.writeFileSync(file, rendiaResult.fixed);
        raw = rendiaResult.fixed;
        console.log(`  ✓ converted ${rendiaResult.count} raw Rendia embed${rendiaResult.count === 1 ? "" : "s"} → MDX component: ${path.relative(process.cwd(), file)}`);
        repaired++;
      } else {
        failures.push({
          file: path.relative(process.cwd(), file),
          reason: `body contains ${rendiaResult.count} raw Rendia <var data-presentation="..."> embed(s) that crash prerender; use <RendiaEmbed id="UUID" /> instead`,
          headBlock: raw.slice(0, 400),
        });
        continue;
      }
    }

    // Body-level check: raw HTML style="..." attribute. React rejects these
    // in MDX with: 'The `style` prop expects a mapping from style properties
    // to values, not a string'. We don't auto-fix because the right rewrite
    // depends on intent — surface the offending line(s) and let the editor
    // remove them or convert to JSX style={{...}}.
    const fmEnd = raw.indexOf("\n---", 4);
    const body = fmEnd > 0 ? raw.slice(fmEnd + 4) : raw;
    const styleHits = findRawStyleAttrs(body);
    if (styleHits.length > 0) {
      const first = styleHits[0];
      failures.push({
        file: path.relative(process.cwd(), file),
        reason: `body contains raw HTML style="..." attribute(s) that crash React prerender (line ~${first.line}: ${first.snippet})`,
        headBlock: raw.slice(0, 400),
      });
      continue;
    }

    try {
      const parsed = matter(raw);
      const data = parsed.data as { categories?: unknown; tags?: unknown };

      // Auto-repair `categories: [null, ...]` — admin batch-edit can write
      // `- ` (empty YAML item) which becomes null and crashes the SSG render
      // (`c.toLowerCase()` on null in lib/funnel-classifier.ts).
      const cats = data.categories;
      if (Array.isArray(cats)) {
        const cleaned = cats.filter(
          (c) => typeof c === "string" && c.trim().length > 0,
        );
        if (cleaned.length !== cats.length) {
          if (FIX) {
            const fixed = stripNullCategoryEntries(raw);
            if (fixed && fixed !== raw) {
              fs.writeFileSync(file, fixed);
              console.log(`  ✓ stripped null category entries: ${path.relative(process.cwd(), file)}`);
              repaired++;
              continue;
            }
          }
          failures.push({
            file: path.relative(process.cwd(), file),
            reason: `categories array contains ${cats.length - cleaned.length} null/empty entr${cats.length - cleaned.length === 1 ? "y" : "ies"}`,
            headBlock: raw.slice(0, 400),
          });
          continue;
        }
      }
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

  console.log(`\n❌ ${failures.length} file(s) have invalid frontmatter that could not be auto-repaired:\n`);
  for (const f of failures) {
    console.log(`  ✗ ${f.file}`);
    console.log(`    reason: ${f.reason}`);
    console.log(`    first 200 chars:\n      ${f.headBlock.slice(0, 200).replace(/\n/g, "\n      ")}`);
    console.log();
  }
  console.log("These need manual fixing. Edit the file directly or delete the corrupted field.\n");
  process.exit(1);
}

main();
