import { NextRequest, NextResponse } from "next/server";
import path from "path";

function removeDraftStatus(content: string): string {
  // Remove the line `status: "draft"` (with any quoting style) from frontmatter
  return content.replace(/^status:\s*["']?draft["']?\s*\n/m, "");
}

function getSlugFromPath(filePath: string): string {
  return path.basename(filePath).replace(/\.mdx?$/, "");
}

async function publishDev(draftPath: string): Promise<string> {
  const fs = await import("fs");
  const pathMod = await import("path");
  const cwd = process.cwd();

  const absSource = pathMod.join(cwd, draftPath);
  if (!fs.existsSync(absSource)) throw new Error("Draft file not found: " + draftPath);

  const raw = fs.readFileSync(absSource, "utf-8");
  const published = removeDraftStatus(raw);

  const basename = pathMod.basename(draftPath);
  const targetRelative = `content/posts/${basename}`;
  const absTarget = pathMod.join(cwd, targetRelative);

  fs.mkdirSync(pathMod.dirname(absTarget), { recursive: true });
  fs.writeFileSync(absTarget, published, "utf-8");
  fs.unlinkSync(absSource);

  return getSlugFromPath(draftPath);
}

async function publishProd(draftPath: string): Promise<string> {
  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;

  // 1. Read the draft
  const getUrl = `https://api.github.com/repos/${repo}/contents/${draftPath}`;
  const getRes = await fetch(getUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!getRes.ok) throw new Error(`Could not read draft from GitHub: ${getRes.status}`);
  const fileData = await getRes.json() as { content: string; sha: string; encoding: string };
  const raw = Buffer.from(fileData.content, "base64").toString("utf-8");
  const draftSha = fileData.sha;

  // 2. Remove draft status
  const published = removeDraftStatus(raw);

  // 3. Write to content/posts/
  const basename = path.basename(draftPath);
  const targetPath = `content/posts/${basename}`;
  const putUrl = `https://api.github.com/repos/${repo}/contents/${targetPath}`;

  // Check if target already exists (get its sha if so)
  const checkRes = await fetch(putUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  const putBody: Record<string, string> = {
    message: `Publish: ${basename}`,
    content: Buffer.from(published, "utf-8").toString("base64"),
  };
  if (checkRes.ok) {
    const existing = await checkRes.json() as { sha: string };
    putBody.sha = existing.sha;
  }

  const putRes = await fetch(putUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(putBody),
  });
  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub write error: ${putRes.status} ${err}`);
  }

  // 4. Delete from drafts
  const deleteUrl = `https://api.github.com/repos/${repo}/contents/${draftPath}`;
  const deleteRes = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Remove draft after publish: ${basename}`,
      sha: draftSha,
    }),
  });
  if (!deleteRes.ok) {
    const err = await deleteRes.text();
    throw new Error(`GitHub delete error: ${deleteRes.status} ${err}`);
  }

  return getSlugFromPath(draftPath);
}

export async function POST(req: NextRequest) {
  const { path: draftPath } = await req.json() as { path: string };

  if (!draftPath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  if (!draftPath.startsWith("content/drafts/")) {
    return NextResponse.json({ error: "Invalid path — must be in content/drafts/" }, { status: 400 });
  }

  try {
    const slug =
      process.env.NODE_ENV === "production"
        ? await publishProd(draftPath)
        : await publishDev(draftPath);

    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
