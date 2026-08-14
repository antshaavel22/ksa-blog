/**
 * /api/admin/posts — lists published posts for the admin "Avaldatud" tab.
 *
 * The bundled filesystem is frozen at deploy time, so a post published after
 * the last completed deploy is invisible here — the editor publishes, looks at
 * the list, and their article is missing. Publishing several posts in a row
 * makes it worse: each push cancels the previous in-flight Vercel build, so the
 * gap can last well beyond the usual ~2 min.
 *
 * So: list from the filesystem (fast, covers everything at deploy time), then
 * ask GitHub for the real directory listing and fetch content for only the
 * files the filesystem doesn't have yet. Normally that's zero extra fetches.
 * Mirrors the GitHub-first reads already used by /api/admin/post and /draft.
 */
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

function buildMeta(filename: string, raw: string): PostMeta | null {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;
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

  return {
    filename,
    path: `content/posts/${filename}`,
    title: parseFrontmatterField(fm, "title") || filename.replace(/\.mdx?$/, ""),
    excerpt: parseFrontmatterField(fm, "excerpt").slice(0, 120),
    lang: parseFrontmatterField(fm, "lang") || "et",
    date: parseFrontmatterField(fm, "date") || "",
    slug: slugFromFm || filename.replace(/\.mdx?$/, ""),
    featuredImage: parseFrontmatterField(fm, "featuredImage"),
    category: normalizeCategory(categoryRaw),
  };
}

async function listPosts(): Promise<PostMeta[]> {
  const fs = await import("fs");
  const path = await import("path");
  const dir = path.join(process.cwd(), "content/posts");
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir)
    .filter((f: string) => f.endsWith(".mdx") || f.endsWith(".md"));

  const posts: PostMeta[] = [];
  for (const filename of files) {
    const filePath = path.join(dir, filename);
    if (fs.statSync(filePath).isDirectory()) continue;
    try {
      const meta = buildMeta(filename, fs.readFileSync(filePath, "utf-8"));
      if (meta) posts.push(meta);
    } catch {
      // Skip unreadable files
    }
  }
  return posts;
}

// Posts that exist on the branch but not in this deploy's bundle. The contents
// API caps directory listings at 1000 entries and content/posts/ is already
// past that, so read the directory as a git tree instead.
async function listPostsMissingFromDeploy(have: Set<string>): Promise<PostMeta[]> {
  const { requireGitHubConfig } = await import("@/lib/admin-env");
  const { token, repo, branch } = requireGitHubConfig();
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };

  const treeRes = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(branch)}:content/posts`,
    { headers, cache: "no-store" },
  );
  if (!treeRes.ok) throw new Error(`GitHub tree ${treeRes.status}`);
  const tree = await treeRes.json() as { tree?: Array<{ path: string; type: string }> };

  const missing = (tree.tree ?? [])
    .filter((e) => e.type === "blob" && /\.mdx?$/.test(e.path) && !have.has(e.path))
    .map((e) => e.path);
  if (missing.length === 0) return [];

  const fetched = await Promise.all(missing.map(async (filename) => {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/contents/content/posts/${encodeURIComponent(filename)}?ref=${encodeURIComponent(branch)}`,
        { headers, cache: "no-store" },
      );
      if (!res.ok) return null;
      const data = await res.json() as { content?: string };
      if (!data.content) return null;
      return buildMeta(filename, Buffer.from(data.content, "base64").toString("utf-8"));
    } catch {
      return null;
    }
  }));
  return fetched.filter((m): m is PostMeta => m !== null);
}

export async function GET() {
  try {
    const posts = await listPosts();
    // Never let a GitHub hiccup take down the whole list — the filesystem
    // results are still correct, just possibly missing the newest posts.
    try {
      const have = new Set(posts.map((p) => p.filename));
      posts.push(...await listPostsMissingFromDeploy(have));
    } catch {
      // fall through with filesystem-only results
    }
    // Sort newest first: by date frontmatter desc, filename desc as tiebreaker.
    // This keeps order consistent for scout-prefixed files AND WP-migrated files
    // (which have no date prefix in filename). Matches /api/admin/drafts ordering.
    posts.sort((a, b) => b.date.localeCompare(a.date) || b.filename.localeCompare(a.filename));
    return NextResponse.json({ posts });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
