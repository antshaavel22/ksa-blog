import { NextResponse } from "next/server";

export interface DraftMeta {
  filename: string;
  path: string;
  title: string;
  excerpt: string;
  lang: string;
  date: string;
}

// Minimal frontmatter parser (avoids importing gray-matter in edge/RSC context)
function parseFrontmatter(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return result;
  const block = match[1];
  for (const line of block.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
    if (key && val) result[key] = val;
  }
  return result;
}

async function listDraftsDev(): Promise<DraftMeta[]> {
  const fs = await import("fs");
  const path = await import("path");
  const cwd = process.cwd();

  const dirs = [
    { dir: path.join(cwd, "content/drafts"), prefix: "content/drafts" },
    { dir: path.join(cwd, "content/drafts/et"), prefix: "content/drafts/et" },
    { dir: path.join(cwd, "content/drafts/ru"), prefix: "content/drafts/ru" },
    { dir: path.join(cwd, "content/drafts/en"), prefix: "content/drafts/en" },
  ];

  const drafts: DraftMeta[] = [];

  for (const { dir, prefix } of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f: string) => f.endsWith(".mdx") || f.endsWith(".md"));
    for (const file of files) {
      const filePath = path.join(dir, file);
      // Skip if it's a directory
      if (fs.statSync(filePath).isDirectory()) continue;
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const fm = parseFrontmatter(raw);
        drafts.push({
          filename: file,
          path: `${prefix}/${file}`,
          title: fm.title || file.replace(/\.mdx?$/, ""),
          excerpt: fm.excerpt || fm.seoExcerpt || "",
          lang: fm.lang || (prefix.endsWith("/ru") ? "ru" : prefix.endsWith("/en") ? "en" : "et"),
          date: fm.date || "",
        });
      } catch {
        // Skip unreadable files
      }
    }
  }

  // Sort newest first
  drafts.sort((a, b) => b.date.localeCompare(a.date) || b.filename.localeCompare(a.filename));
  return drafts;
}

async function listDraftsProd(): Promise<DraftMeta[]> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    throw new Error("GITHUB_TOKEN and GITHUB_REPO must be set in production");
  }

  const branch = process.env.GITHUB_BRANCH ?? "main";
  const treeRes = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );
  if (!treeRes.ok) throw new Error(`GitHub tree read error: ${treeRes.status}`);

  const treeData = await treeRes.json() as {
    tree: Array<{ path: string; type: string; sha: string }>;
  };
  const draftFiles = treeData.tree.filter((item) =>
    item.type === "blob" &&
    item.path.startsWith("content/drafts/") &&
    (item.path.endsWith(".mdx") || item.path.endsWith(".md"))
  );

  async function readDraftBlob(item: { path: string; sha: string }): Promise<DraftMeta | null> {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/git/blobs/${item.sha}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = await res.json() as { content: string };
      const raw = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
      const fm = parseFrontmatter(raw);
      const parts = item.path.split("/");
      const filename = parts[parts.length - 1] ?? "";
      const langFromPath = item.path.includes("/ru/") ? "ru" : item.path.includes("/en/") ? "en" : "et";
      return {
        filename,
        path: item.path,
        title: fm.title || filename.replace(/\.mdx?$/, ""),
        excerpt: fm.excerpt || fm.seoExcerpt || "",
        lang: fm.lang || langFromPath,
        date: fm.date || "",
      };
    } catch {
      return null;
    }
  }

  const drafts = (await Promise.all(draftFiles.map(readDraftBlob)))
    .filter((draft): draft is DraftMeta => draft !== null);
  drafts.sort((a, b) => b.date.localeCompare(a.date) || b.filename.localeCompare(a.filename));
  return drafts;
}

export async function GET() {
  try {
    // Production reads current drafts from GitHub so draft-only commits can skip
    // Vercel rebuilds without making new drafts disappear from the admin UI.
    const drafts =
      process.env.NODE_ENV === "production"
        ? await listDraftsProd()
        : await listDraftsDev();

    return NextResponse.json({ drafts });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
