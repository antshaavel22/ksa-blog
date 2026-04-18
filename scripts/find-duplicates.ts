/**
 * find-duplicates.ts — Detect duplicate posts within each language (RU, EN, ET).
 *
 * Duplicate = same normalised title within the same lang.
 * Normalisation: lowercase, strip punctuation, collapse whitespace.
 *
 * Output: prints groups with 2+ members, keeps the OLDEST (earliest date) as
 * canonical, marks the rest for deletion.
 *
 * Usage:
 *   npx tsx scripts/find-duplicates.ts           # report only
 *   npx tsx scripts/find-duplicates.ts --delete  # delete duplicates (local fs)
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const POSTS = path.join(process.cwd(), "content/posts");
const DELETE = process.argv.includes("--delete");

type Post = {
  file: string;
  title: string;
  lang: string;
  date: string;
  slug: string;
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function main() {
  const files = fs.readdirSync(POSTS).filter((f) => f.endsWith(".mdx"));
  const posts: Post[] = [];

  for (const file of files) {
    const full = path.join(POSTS, file);
    const raw = fs.readFileSync(full, "utf-8");
    try {
      const { data } = matter(raw);
      posts.push({
        file: full,
        title: String(data.title ?? ""),
        lang: String(data.lang ?? "et"),
        date: String(data.date ?? ""),
        slug: String(data.slug ?? file.replace(/\.mdx$/, "")),
      });
    } catch {
      // Skip unparseable — validate-content handles these
    }
  }

  // Group by (lang, normalised title)
  const groups = new Map<string, Post[]>();
  for (const p of posts) {
    if (!p.title) continue;
    const key = `${p.lang}|${norm(p.title)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const dupGroups = [...groups.entries()].filter(([, v]) => v.length > 1);
  const toDelete: Post[] = [];

  console.log(`\nScanned ${posts.length} posts. Found ${dupGroups.length} duplicate groups.\n`);

  for (const [key, members] of dupGroups) {
    const [lang] = key.split("|");
    // Keep the OLDEST — earliest date wins. Ties: shorter filename.
    const sorted = [...members].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.file.length - b.file.length;
    });
    const keep = sorted[0];
    const drop = sorted.slice(1);
    toDelete.push(...drop);

    console.log(`[${lang}] "${members[0].title}"`);
    console.log(`  KEEP:   ${path.basename(keep.file)}  (${keep.date})`);
    for (const d of drop) {
      console.log(`  DELETE: ${path.basename(d.file)}  (${d.date})`);
    }
    console.log();
  }

  console.log(`Total files to delete: ${toDelete.length}`);
  const byLang = toDelete.reduce<Record<string, number>>((acc, p) => {
    acc[p.lang] = (acc[p.lang] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`By language:`, byLang);

  if (DELETE) {
    for (const p of toDelete) fs.unlinkSync(p.file);
    console.log(`\n✓ Deleted ${toDelete.length} duplicate files from local filesystem.`);
    console.log(`  Remember to commit + push to propagate to production.`);
  } else {
    console.log(`\n(dry run — pass --delete to remove files)`);
  }
}

main();
