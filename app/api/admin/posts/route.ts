import { NextResponse } from "next/server";

interface PostMeta {
  filename: string;
  path: string;
  title: string;
  excerpt: string;
  lang: string;
  date: string;
  slug: string;
  featuredImage: string;
  category: string;
}

function parseFrontmatterField(fm: string, key: string): string {
  // Handle multiline YAML block scalars (>-)
  const re = new RegExp(`^${key}:\\s*(.*)$`, "m");
  const m = fm.match(re);
  if (!m) return "";
  const val = m[1].trim();
  if (val === ">-" || val === ">") {
    // Read next indented line
    const blockRe = new RegExp(`^${key}:\\s*>-?\\s*\\n((?:[ \\t]+.+\\n?)*)`, "m");
    const bm = fm.match(blockRe);
    if (bm) return bm[1].replace(/^[ \t]+/mg, "").replace(/\n/g, " ").trim();
  }
  return val.replace(/^["']|["']$/g, "");
}

function normalizeCategory(raw: string): string {
  if (!raw) return "";
  // Strip leading dash/bracket/quote/whitespace and trailing bracket/quote/whitespace
  return raw.replace(/^[\-\[\]"'\s]+/, "").replace(/[\[\]"'\s]+$/, "").trim();
}

async function listPosts(): Promise<PostMeta[]> {
  const fs = await import("fs");
  const path = await import("path");
  const dir = path.join(process.cwd(), "content/posts");
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir)
    .filter((f: string) => f.endsWith(".mdx") || f.endsWith(".md"))
    .sort()
    .reverse(); // newest first

  const posts: PostMeta[] = [];
  for (const filename of files) {
    const filePath = path.join(dir, filename);
    if (fs.statSync(filePath).isDirectory()) continue;
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) continue;
      const fm = fmMatch[1];
      const slugFromFm = parseFrontmatterField(fm, "slug");

      // Parse categories — may be inline or YAML block list
      let categoryRaw = "";
      // Try block list first: "categories:\n  - Flow Protseduur"
      const blockCatRe = /^categories:\s*\n(?:\s+- ?(.*)\n?)/m;
      const blockCatMatch = fm.match(blockCatRe);
      if (blockCatMatch) {
        categoryRaw = blockCatMatch[1].trim();
      } else {
        categoryRaw = parseFrontmatterField(fm, "categories");
      }

      posts.push({
        filename,
        path: `content/posts/${filename}`,
        title: parseFrontmatterField(fm, "title") || filename.replace(/\.mdx?$/, ""),
        excerpt: parseFrontmatterField(fm, "excerpt").slice(0, 120),
        lang: parseFrontmatterField(fm, "lang") || "et",
        date: parseFrontmatterField(fm, "date") || "",
        slug: slugFromFm || filename.replace(/\.mdx?$/, ""),
        featuredImage: parseFrontmatterField(fm, "featuredImage"),
        category: normalizeCategory(categoryRaw),
      });
    } catch {
      // Skip unreadable files
    }
  }
  return posts;
}

export async function GET() {
  try {
    // Always use filesystem — content/posts/ is bundled with the Vercel deployment.
    const posts = await listPosts();
    return NextResponse.json({ posts });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
