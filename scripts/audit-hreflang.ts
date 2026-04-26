import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const POSTS = path.join(process.cwd(), "content/posts");

type Post = {
  file: string;
  slug: string;
  lang: "et" | "ru" | "en" | string;
  title: string;
  translatedFrom?: string;
};

function loadPosts(): Post[] {
  return fs.readdirSync(POSTS)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(POSTS, f), "utf8");
      const fm = matter(raw).data as Record<string, unknown>;
      return {
        file: f,
        slug: (fm.slug as string) || f.replace(/\.mdx$/, ""),
        lang: (fm.lang as string) || "et",
        title: (fm.title as string) || "",
        translatedFrom: fm.translatedFrom as string | undefined,
      };
    });
}

function main() {
  const posts = loadPosts();
  const byLang = { et: [] as Post[], ru: [] as Post[], en: [] as Post[] };
  for (const p of posts) {
    if (p.lang in byLang) (byLang as Record<string, Post[]>)[p.lang].push(p);
  }

  const etByTitle = new Map<string, Post[]>();
  for (const p of byLang.et) {
    const arr = etByTitle.get(p.title) ?? [];
    arr.push(p);
    etByTitle.set(p.title, arr);
  }

  const orphans: Post[] = [];           // RU/EN with translatedFrom that doesn't match any ET title
  const missingFrom: Post[] = [];       // RU/EN with no translatedFrom at all
  const ambiguous: Post[] = [];         // RU/EN whose translatedFrom matches multiple ET titles
  const dupETTitles: { title: string; slugs: string[] }[] = [];

  for (const [title, list] of etByTitle.entries()) {
    if (list.length > 1) dupETTitles.push({ title, slugs: list.map((p) => p.slug) });
  }

  for (const p of [...byLang.ru, ...byLang.en]) {
    if (!p.translatedFrom) {
      missingFrom.push(p);
      continue;
    }
    const matches = etByTitle.get(p.translatedFrom);
    if (!matches || matches.length === 0) orphans.push(p);
    else if (matches.length > 1) ambiguous.push(p);
  }

  console.log(`# Hreflang audit\n`);
  console.log(`Posts: ET=${byLang.et.length}, RU=${byLang.ru.length}, EN=${byLang.en.length}, total=${posts.length}\n`);
  console.log(`## Duplicate ET titles (creates ambiguity for sister-matching): ${dupETTitles.length}`);
  for (const d of dupETTitles.slice(0, 30)) {
    console.log(`  - "${d.title}"`);
    for (const s of d.slugs) console.log(`      · ${s}`);
  }
  console.log(`\n## RU/EN without translatedFrom: ${missingFrom.length}`);
  for (const p of missingFrom.slice(0, 30)) console.log(`  - [${p.lang}] ${p.slug}`);
  console.log(`\n## RU/EN with translatedFrom that does NOT match any ET title: ${orphans.length}`);
  for (const p of orphans.slice(0, 50)) console.log(`  - [${p.lang}] ${p.slug}\n      → translatedFrom: "${p.translatedFrom}"`);
  console.log(`\n## RU/EN whose translatedFrom matches multiple ET posts (ambiguous): ${ambiguous.length}`);
  for (const p of ambiguous.slice(0, 30)) console.log(`  - [${p.lang}] ${p.slug} → "${p.translatedFrom}"`);

  const total = missingFrom.length + orphans.length + ambiguous.length;
  console.log(`\n## TOTAL hreflang risk posts: ${total}`);
}

main();
