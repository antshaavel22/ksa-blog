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

async function publishDev(draftPath: string, clientContent?: string): Promise<string> {
  const fs = await import("fs");
  const pathMod = await import("path");
  const cwd = process.cwd();

  let raw: string;
  if (clientContent) {
    raw = clientContent;
  } else {
    const absSource = pathMod.join(cwd, draftPath);
    if (!fs.existsSync(absSource)) throw new Error("Draft file not found: " + draftPath);
    raw = fs.readFileSync(absSource, "utf-8");
  }
  const published = removeDraftStatus(raw);

  const basename = pathMod.basename(draftPath);
  const targetRelative = `content/posts/${basename}`;
  const absTarget = pathMod.join(cwd, targetRelative);

  fs.mkdirSync(pathMod.dirname(absTarget), { recursive: true });
  fs.writeFileSync(absTarget, published, "utf-8");

  const absSource2 = pathMod.join(cwd, draftPath);
  if (fs.existsSync(absSource2)) fs.unlinkSync(absSource2);

  return getSlugFromFrontmatter(published) || getSlugFromPath(draftPath);
}

async function publishProd(draftPath: string, clientContent?: string): Promise<string> {
  const pathMod = await import("path");

  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;
  const branch = process.env.GITHUB_BRANCH ?? "main";
  const basename = pathMod.basename(draftPath);
  const targetPath = `content/posts/${basename}`;

  let raw: string;
  if (clientContent) {
    raw = clientContent;
  } else {
    const fs = await import("fs");
    const cwd = process.cwd();
    const absSource = pathMod.join(cwd, draftPath);
    if (!fs.existsSync(absSource)) throw new Error("Draft file not found: " + draftPath);
    raw = fs.readFileSync(absSource, "utf-8");
  }

  const published = removeDraftStatus(raw);

  const gh = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  };

  const ref = await gh<{ object: { sha: string } }>(
    `https://api.github.com/repos/${repo}/git/ref/heads/${branch}`
  );
  const parentSha = ref.object.sha;
  const parentCommit = await gh<{ tree: { sha: string } }>(
    `https://api.github.com/repos/${repo}/git/commits/${parentSha}`
  );
  const blob = await gh<{ sha: string }>(
    `https://api.github.com/repos/${repo}/git/blobs`,
    {
      method: "POST",
      body: JSON.stringify({
        content: Buffer.from(published, "utf-8").toString("base64"),
        encoding: "base64",
      }),
    }
  );

  const draftExists = await fetch(`https://api.github.com/repos/${repo}/contents/${draftPath}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  }).then((res) => res.ok).catch(() => false);

  const treeItems: Array<Record<string, string | null>> = [
    { path: targetPath, mode: "100644", type: "blob", sha: blob.sha },
  ];
  // GitHub's create-tree API requires `mode` and `type` on every entry,
  // even on deletions where `sha: null` signals removal. Omitting them
  // produces a 422 "Must supply a valid tree.mode".
  if (draftExists) treeItems.push({ path: draftPath, mode: "100644", type: "blob", sha: null });

  const tree = await gh<{ sha: string }>(
    `https://api.github.com/repos/${repo}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: treeItems }),
    }
  );
  const commit = await gh<{ sha: string }>(
    `https://api.github.com/repos/${repo}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        message: `Publish: ${basename}`,
        tree: tree.sha,
        parents: [parentSha],
      }),
    }
  );
  await gh(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  if (process.env.FORCE_VERCEL_DEPLOY_HOOK_AFTER_GIT === "true" && process.env.VERCEL_DEPLOY_HOOK) {
    try {
      await fetch(process.env.VERCEL_DEPLOY_HOOK, { method: "POST" });
    } catch {
      // Non-fatal: the Git commit is already pushed.
    }
  }

  return getSlugFromFrontmatter(published) || getSlugFromPath(draftPath);
}

export async function POST(req: NextRequest) {
  const { path: draftPath, content: clientContent } = await req.json() as {
    path: string;
    content?: string;
  };

  if (!draftPath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  if (!draftPath.startsWith("content/drafts/")) {
    return NextResponse.json({ error: "Invalid path - must be in content/drafts/" }, { status: 400 });
  }

  try {
    const slug =
      process.env.NODE_ENV === "production"
        ? await publishProd(draftPath, clientContent)
        : await publishDev(draftPath, clientContent);

    return NextResponse.json({ ok: true, slug, needsRedeploy: false });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
