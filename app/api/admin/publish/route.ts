import { NextRequest, NextResponse } from "next/server";
import path from "path";

function removeDraftStatus(content: string): string {
  return content.replace(/^status:\s*["']?draft["']?\s*\n/m, "");
}

function getSlugFromFrontmatter(content: string): string {
  const m = content.match(/^slug:\s*["']?([^"'\n]+)["']?/m);
  return m ? m[1].trim() : "";
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

  return getSlugFromFrontmatter(published) || getSlugFromPath(draftPath);
}

async function publishProd(draftPath: string): Promise<string> {
  const fs = await import("fs");
  const pathMod = await import("path");
  const cwd = process.cwd();

  // Step 1: Read draft from FILESYSTEM (bundled with deployment)
  const absSource = pathMod.join(cwd, draftPath);
  if (!fs.existsSync(absSource)) throw new Error("Draft file not found: " + draftPath);
  const raw = fs.readFileSync(absSource, "utf-8");
  const published = removeDraftStatus(raw);

  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;
  const basename = pathMod.basename(draftPath);
  const targetPath = `content/posts/${basename}`;

  // Step 2: Write to content/posts/ on GitHub
  const putUrl = `https://api.github.com/repos/${repo}/contents/${targetPath}`;
  const checkRes = await fetch(putUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
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

  // Step 3: Delete draft from GitHub (if it exists there)
  const deleteUrl = `https://api.github.com/repos/${repo}/contents/${draftPath}`;
  const getRes = await fetch(deleteUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (getRes.ok) {
    const draftData = await getRes.json() as { sha: string };
    await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: `Remove draft after publish: ${basename}`, sha: draftData.sha }),
    });
  }

  // Step 4: Trigger Vercel redeploy via deploy hook (if configured)
  const deployHook = process.env.VERCEL_DEPLOY_HOOK;
  if (deployHook) {
    try {
      await fetch(deployHook, { method: "POST" });
    } catch {
      // Non-fatal — just means manual redeploy needed
    }
  }

  return getSlugFromFrontmatter(published) || getSlugFromPath(draftPath);
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

    const needsRedeploy = process.env.NODE_ENV === "production" && !process.env.VERCEL_DEPLOY_HOOK;

    return NextResponse.json({ ok: true, slug, needsRedeploy });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
