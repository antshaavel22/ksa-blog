import { NextResponse } from "next/server";

interface PostMeta {
  filename: string;
  path: string;
  title: string;
  excerpt: string;
  lang: string;
  date: string;
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

async function listPostsDev(): Promise<PostMeta[]> {
  const fs = await import("fs");
  const path = await import("path");
  const dir = path.join(process.cwd(), "content/posts");
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir)
    .filter((f: string) => f.endsWith(".mdx") || f.endsWith(".md"))
    .sort()
    .reverse(); // newest first

  const posts: PostMeta[] = [];
  for (const filename of files.slice(0, 200)) { // limit to 200
    const filePath = path.join(dir, filename);
    const raw = fs.readFileSync(filePath, "utf-8");
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) continue;
    const fm = fmMatch[1];
    posts.push({
      filename,
      path: `content/posts/${filename}`,
      title: parseFrontmatterField(fm, "title") || filename.replace(/\.mdx?$/, ""),
      excerpt: parseFrontmatterField(fm, "excerpt").slice(0, 120),
      lang: parseFrontmatterField(fm, "lang") || "et",
      date: parseFrontmatterField(fm, "date") || "",
    });
  }
  return posts;
}

async function listPostsProd(): Promise<PostMeta[]> {
  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;
  const url = `https://api.github.com/repos/${repo}/contents/content/posts?per_page=200`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const files = await res.json() as { name: string; path: string }[];
  return files
    .filter((f) => f.name.endsWith(".mdx") || f.name.endsWith(".md"))
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(0, 200)
    .map((f) => ({
      filename: f.name,
      path: f.path,
      title: f.name.replace(/\.mdx?$/, "").replace(/-/g, " "),
      excerpt: "",
      lang: "et",
      date: "",
    }));
}

export async function GET() {
  try {
    const posts =
      process.env.NODE_ENV === "production"
        ? await listPostsProd()
        : await listPostsDev();
    return NextResponse.json({ posts });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
