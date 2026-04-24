/**
 * Audit: run the funnel classifier across every published post and show the reshuffle.
 * Usage: npx tsx scripts/audit-classifier.ts
 *        npx tsx scripts/audit-classifier.ts --samples  (print 5 example posts per bucket)
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { resolveFunnel } from "../lib/funnel-classifier";

const postsDir = path.join(process.cwd(), "content/posts");
const files = fs.readdirSync(postsDir).filter((f) => f.endsWith(".mdx"));

interface Row {
  slug: string;
  title: string;
  before: string;
  after: string;
  categories: string[];
  lang: string;
}

const rows: Row[] = [];
for (const file of files) {
  const raw = fs.readFileSync(path.join(postsDir, file), "utf-8");
  const { data, content } = matter(raw);
  const before = (data.funnel as string) ?? "general";
  const cats = Array.isArray(data.categories) ? (data.categories as string[]) : [];
  const after = resolveFunnel({
    title: data.title as string,
    slug: data.slug as string | undefined,
    categories: cats,
    body: content,
    funnel: before as "flow3" | "audit" | "kids" | "dryeye" | "general",
    funnelOverride: data.funnelOverride === true,
  });
  rows.push({
    slug: (data.slug as string) ?? file.replace(/\.mdx$/, ""),
    title: (data.title as string) ?? "(no title)",
    before,
    after,
    categories: cats,
    lang: (data.lang as string) ?? "et",
  });
}

const beforeCounts: Record<string, number> = {};
const afterCounts: Record<string, number> = {};
const moved: Row[] = [];
for (const r of rows) {
  beforeCounts[r.before] = (beforeCounts[r.before] ?? 0) + 1;
  afterCounts[r.after] = (afterCounts[r.after] ?? 0) + 1;
  if (r.before !== r.after) moved.push(r);
}

console.log(`\n📊 Classifier audit — ${rows.length} published posts\n`);
console.log("BEFORE (frontmatter funnel):");
for (const [k, v] of Object.entries(beforeCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${k.padEnd(10)} ${v}`);
}
console.log("\nAFTER (auto-classifier):");
for (const [k, v] of Object.entries(afterCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${k.padEnd(10)} ${v}`);
}
console.log(`\n🔀 Reclassified: ${moved.length} posts (${((moved.length / rows.length) * 100).toFixed(1)}%)\n`);

if (process.argv.includes("--samples")) {
  for (const bucket of ["audit", "kids", "dryeye"] as const) {
    const hits = moved.filter((m) => m.after === bucket).slice(0, 8);
    if (hits.length === 0) continue;
    console.log(`\n── ${bucket.toUpperCase()} samples (first 8 reclassified) ──`);
    for (const h of hits) {
      console.log(`   [${h.lang}] ${h.before} → ${bucket}  ${h.title.slice(0, 80)}`);
    }
  }
}
