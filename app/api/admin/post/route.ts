/**
 * /api/admin/post — Read and update published posts in content/posts/
 * READ: always filesystem (files bundled with deployment)
 * WRITE: GitHub API in production (Vercel fs is read-only)
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireGitHubConfig } from "@/lib/admin-env";

export const runtime = "nodejs";

function parsePostPath(filePath: string): string | null {
  const match = filePath.match(/^content\/posts\/([^/]+\.mdx?)$/);
  return match?.[1] ?? null;
}

async function readPost(filePath: string): Promise<string> {
  const basename = parsePostPath(filePath);
  if (!basename) throw new Error("Invalid path");

  const abs = path.join(process.cwd(), "content", "posts", basename);
  if (!fs.existsSync(abs)) throw new Error("File not found: " + filePath);
  return fs.readFileSync(abs, "utf-8");
}

async function writePostDev(filePath: string, content: string): Promise<void> {
  const basename = parsePostPath(filePath);
  if (!basename) throw new Error("Invalid path");

  const abs = path.join(process.cwd(), "content", "posts", basename);
  fs.writeFileSync(abs, content, "utf-8");
}

async function writePostProd(filePath: string, content: string): Promise<void> {
  const { token, repo } = requireGitHubConfig();
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  const getRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  let sha: string | undefined;
  if (getRes.ok) {
    const data = await getRes.json() as { sha: string };
    sha = data.sha;
  }

  const body: Record<string, string> = {
    message: `Edit published post: ${filePath}`,
    content: Buffer.from(content, "utf-8").toString("base64"),
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!putRes.ok) throw new Error(`GitHub write error: ${putRes.status}`);

  // GitHub auto-deploy already sees this commit. Make deploy-hook use opt-in
  // so one editor save does not create duplicate Vercel builds.
  const deployHook = process.env.VERCEL_DEPLOY_HOOK;
  if (process.env.FORCE_VERCEL_DEPLOY_HOOK_AFTER_GIT === "true" && deployHook) {
    try { await fetch(deployHook, { method: "POST" }); } catch { /* non-fatal */ }
  }
}

async function readPostProd(filePath: string): Promise<string> {
  const { token, repo } = requireGitHubConfig();
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub read error: ${res.status} — file not found: ${filePath}`);
  const data = await res.json() as { content: string };
  return Buffer.from(data.content, "base64").toString("utf-8");
}

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) return NextResponse.json({ error: "path is required" }, { status: 400 });
  if (!parsePostPath(filePath))
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  try {
    if (process.env.NODE_ENV === "production") {
      // Try filesystem first (fast, always works for files in the deployment bundle).
      // Fall back to GitHub API for files created after the last deploy (e.g. newly published posts).
      try {
        const content = await readPost(filePath);
        return NextResponse.json({ content });
      } catch {
        const content = await readPostProd(filePath);
        return NextResponse.json({ content });
      }
    } else {
      const content = await readPost(filePath);
      return NextResponse.json({ content });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) return NextResponse.json({ error: "path is required" }, { status: 400 });
  if (!parsePostPath(filePath))
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  const { content } = await req.json() as { content: string };
  if (typeof content !== "string")
    return NextResponse.json({ error: "content is required" }, { status: 400 });

  try {
    if (process.env.NODE_ENV === "production") {
      await writePostProd(filePath, content);
    } else {
      await writePostDev(filePath, content);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
