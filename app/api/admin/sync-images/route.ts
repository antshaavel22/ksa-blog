import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const CONTENT_DIRS = ["content/posts", "content/drafts/et", "content/drafts/ru", "content/drafts/en"];

interface FileEntry {
  filePath: string; // relative, e.g. content/posts/foo.mdx
  title: string;
  slug: string;
  lang: string;
  featuredImage: string;
  translatedFrom: string;
}

function scanAllFiles(): FileEntry[] {
  const cwd = process.cwd();
  const entries: FileEntry[] = [];

  for (const dir of CONTENT_DIRS) {
    const absDir = path.join(cwd, dir);
    if (!fs.existsSync(absDir)) continue;
    const files = fs.readdirSync(absDir).filter((f) => f.endsWith(".mdx") || f.endsWith(".md"));
    for (const file of files) {
      const filePath = `${dir}/${file}`;
      const raw = fs.readFileSync(path.join(absDir, file), "utf-8");
      const { data } = matter(raw);
      entries.push({
        filePath,
        title: data.title || "",
        slug: data.slug || file.replace(/\.mdx?$/, ""),
        lang: data.lang || "et",
        featuredImage: data.featuredImage || "",
        translatedFrom: data.translatedFrom || "",
      });
    }
  }
  return entries;
}

function findSisterArticles(source: FileEntry, all: FileEntry[]): FileEntry[] {
  if (source.lang === "et") {
    // This IS the original — find RU/EN that translatedFrom matches this title
    return all.filter(
      (f) =>
        f.filePath !== source.filePath &&
        f.translatedFrom &&
        f.translatedFrom === source.title
    );
  } else {
    // This is a translation — find the ET original, then all siblings
    const etOriginal = all.find(
      (f) => f.lang === "et" && f.title === source.translatedFrom
    );
    if (!etOriginal) return [];

    // Return ET original + other translations (excluding self)
    const sisters = all.filter(
      (f) =>
        f.filePath !== source.filePath &&
        (f.filePath === etOriginal.filePath ||
          (f.translatedFrom === etOriginal.title && f.filePath !== source.filePath))
    );
    return sisters;
  }
}

async function writeImageToFile(filePath: string, featuredImage: string): Promise<void> {
  const cwd = process.cwd();
  const absPath = path.join(cwd, filePath);

  if (process.env.NODE_ENV === "production") {
    // Write to GitHub
    const token = process.env.GITHUB_TOKEN!;
    const repo = process.env.GITHUB_REPO!;
    const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

    const getRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (!getRes.ok) return; // Skip if file not found on GitHub

    const fileData = (await getRes.json()) as { content: string; sha: string };
    const raw = Buffer.from(fileData.content, "base64").toString("utf-8");
    const { data, content } = matter(raw);
    data.featuredImage = featuredImage;
    const updated = matter.stringify(content, data);

    await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Sync image: ${path.basename(filePath)}`,
        content: Buffer.from(updated, "utf-8").toString("base64"),
        sha: fileData.sha,
      }),
    });
  } else {
    // Dev: write locally
    const raw = fs.readFileSync(absPath, "utf-8");
    const { data, content } = matter(raw);
    data.featuredImage = featuredImage;
    const updated = matter.stringify(content, data);
    fs.writeFileSync(absPath, updated, "utf-8");
  }
}

// POST: Sync image from a source article to all sister articles
export async function POST(req: NextRequest) {
  const { filePath, featuredImage } = (await req.json()) as {
    filePath: string;
    featuredImage: string;
  };

  if (!filePath || !featuredImage) {
    return NextResponse.json({ error: "filePath and featuredImage required" }, { status: 400 });
  }

  const all = scanAllFiles();
  const source = all.find((f) => f.filePath === filePath);
  if (!source) {
    return NextResponse.json({ error: "Source file not found" }, { status: 404 });
  }

  const sisters = findSisterArticles(source, all);
  const needsSync = sisters.filter((s) => s.featuredImage !== featuredImage);

  const synced: string[] = [];
  for (const sister of needsSync) {
    try {
      await writeImageToFile(sister.filePath, featuredImage);
      synced.push(sister.filePath);
    } catch {
      // Skip failed writes
    }
  }

  return NextResponse.json({
    ok: true,
    source: source.filePath,
    sistersFound: sisters.length,
    synced,
    alreadySynced: sisters.length - needsSync.length,
  });
}

// GET: Find sister articles for a given file
export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("filePath");
  if (!filePath) {
    return NextResponse.json({ error: "filePath param required" }, { status: 400 });
  }

  const all = scanAllFiles();
  const source = all.find((f) => f.filePath === filePath);
  if (!source) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const sisters = findSisterArticles(source, all);

  return NextResponse.json({
    source: { filePath: source.filePath, title: source.title, lang: source.lang, featuredImage: source.featuredImage },
    sisters: sisters.map((s) => ({
      filePath: s.filePath,
      title: s.title,
      lang: s.lang,
      featuredImage: s.featuredImage,
      needsSync: s.featuredImage !== source.featuredImage,
    })),
  });
}
