/**
 * /api/admin/post — Read and update published posts in content/posts/
 * READ: always filesystem (files bundled with deployment)
 * WRITE: GitHub API in production (Vercel fs is read-only)
 */
import { NextRequest, NextResponse } from "next/server";

async function readPost(filePath: string): Promise<string> {
  const fs = await import("fs");
  const path = await import("path");
  const abs = path.join(process.cwd(), filePath);
  if (!fs.existsSync(abs)) throw new Error("File not found: " + filePath);
  return fs.readFileSync(abs, "utf-8");
}

async function writePostDev(filePath: string, content: string): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  const abs = path.join(process.cwd(), filePath);
  fs.writeFileSync(abs, content, "utf-8");
}

async function writePostProd(filePath: string, content: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;
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

  // Explicitly trigger Vercel redeploy (GitHub auto-deploy is also active, belt+suspenders)
  const deployHook = process.env.VERCEL_DEPLOY_HOOK;
  if (deployHook) {
    try { await fetch(deployHook, { method: "POST" }); } catch { /* non-fatal */ }
  }
}

async function readPostProd(filePath: string): Promise<string> {
  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;
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
  if (!filePath.startsWith("content/posts/"))
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
  if (!filePath.startsWith("content/posts/"))
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
