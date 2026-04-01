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

  const paths = ["content/drafts", "content/drafts/ru", "content/drafts/en"];
  const drafts: DraftMeta[] = [];

  for (const dirPath of paths) {
    const url = `https://api.github.com/repos/${repo}/contents/${dirPath}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) continue;
    const items = await res.json() as Array<{ name: string; type: string; download_url: string }>;

    for (const item of items) {
      if (item.type !== "file" || (!item.name.endsWith(".mdx") && !item.name.endsWith(".md"))) continue;
      try {
        const fileRes = await fetch(item.download_url);
        if (!fileRes.ok) continue;
        const raw = await fileRes.text();
        const fm = parseFrontmatter(raw);
        const langFromPath = dirPath.endsWith("/ru") ? "ru" : dirPath.endsWith("/en") ? "en" : "et";
        drafts.push({
          filename: item.name,
          path: `${dirPath}/${item.name}`,
          title: fm.title || item.name.replace(/\.mdx?$/, ""),
          excerpt: fm.excerpt || fm.seoExcerpt || "",
          lang: fm.lang || langFromPath,
          date: fm.date || "",
        });
      } catch {
        // Skip
      }
    }
  }

  drafts.sort((a, b) => b.date.localeCompare(a.date) || b.filename.localeCompare(a.filename));
  return drafts;
}

export async function GET() {
  try {
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
