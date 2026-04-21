import { NextRequest, NextResponse } from "next/server";
import path from "path";

function addDraftStatus(content: string): string {
  // Insert `status: "draft"` into frontmatter after the first `---` line
  return content.replace(/^(---\r?\n)/, '$1status: "draft"\n');
}

function getLangFromContent(content: string): string {
  const m = content.match(/^lang:\s*["']?([a-z]{2})["']?/m);
  return m ? m[1] : "et";
}

async function unpublishDev(postPath: string): Promise<string> {
  const fs = await import("fs");
  const pathMod = await import("path");
  const cwd = process.cwd();

  const absSource = pathMod.join(cwd, postPath);
  if (!fs.existsSync(absSource)) throw new Error("Post file not found: " + postPath);

  const raw = fs.readFileSync(absSource, "utf-8");
  const withDraft = addDraftStatus(raw);
  const lang = getLangFromContent(raw);

  const basename = pathMod.basename(postPath);
  const targetDir = `content/drafts/${lang}`;
  const absTargetDir = pathMod.join(cwd, targetDir);
  fs.mkdirSync(absTargetDir, { recursive: true });

  const absTarget = pathMod.join(absTargetDir, basename);
  fs.writeFileSync(absTarget, withDraft, "utf-8");
  fs.unlinkSync(absSource);

  return `${targetDir}/${basename}`;
}

async function githubGetWithRetry(url: string, token: string, retries = 3): Promise<{ content: string; sha: string }> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      cache: "no-store" as RequestCache,
    });
    if (res.ok) return res.json() as Promise<{ content: string; sha: string }>;
    if (res.status === 404 && i < retries - 1) {
      // GitHub API can temporarily return 404 for files that exist (rate limits / eventual consistency)
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
      continue;
    }
    throw new Error(`GitHub read failed: ${res.status}`);
  }
  throw new Error("GitHub read failed after retries");
}

async function unpublishProd(postPath: string): Promise<string> {
  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;

  // 1. Read the published post (with retry — GitHub API can be flaky after batch operations)
  const getUrl = `https://api.github.com/repos/${repo}/contents/${postPath}`;
  const fileData = await githubGetWithRetry(getUrl, token);
  const raw = Buffer.from(fileData.content.replace(/\n/g, ""), "base64").toString("utf-8");
  const postSha = fileData.sha;

  // 2. Add draft status
  const withDraft = addDraftStatus(raw);
  const lang = getLangFromContent(raw);
  const basename = path.basename(postPath);
  const targetPath = `content/drafts/${lang}/${basename}`;

  // 3. Write to content/drafts/[lang]/
  const putUrl = `https://api.github.com/repos/${repo}/contents/${targetPath}`;
  const checkRes = await fetch(putUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  const putBody: Record<string, string> = {
    message: `Unpublish: ${basename}`,
    content: Buffer.from(withDraft, "utf-8").toString("base64"),
  };
  if (checkRes.ok) {
    const existing = await checkRes.json() as { sha: string };
    putBody.sha = existing.sha;
  }

  const putRes = await fetch(putUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify(putBody),
  });
  if (!putRes.ok) throw new Error(`GitHub write error: ${putRes.status}`);

  // 4. Delete from content/posts/
  const deleteRes = await fetch(getUrl, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ message: `Remove after unpublish: ${basename}`, sha: postSha }),
  });
  if (!deleteRes.ok) throw new Error(`GitHub delete error: ${deleteRes.status}`);

  return targetPath;
}

export async function POST(req: NextRequest) {
  const { path: postPath } = await req.json() as { path: string };

  if (!postPath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  if (!postPath.startsWith("content/posts/")) {
    return NextResponse.json({ error: "Invalid path — must be in content/posts/" }, { status: 400 });
  }

  try {
    const draftPath =
      process.env.NODE_ENV === "production"
        ? await unpublishProd(postPath)
        : await unpublishDev(postPath);

    return NextResponse.json({ ok: true, draftPath });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
