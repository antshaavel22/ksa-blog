/**
 * POST /api/admin/batch-update
 *
 * Atomically writes N files in a SINGLE git commit via the GitHub Git Data API.
 * One commit → one Vercel build, instead of N commits / N builds.
 *
 * Input:  { files: [{ path: "content/posts/foo.mdx", content: "…" }, …],
 *           message?: "Batch edit: 5 posts" }
 * Output: { commit: "sha", files: N }
 */
import { NextRequest, NextResponse } from "next/server";

const GH = "https://api.github.com";

async function gh<T = unknown>(
  url: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub ${res.status} ${url}: ${txt}`);
  }
  return (await res.json()) as T;
}

export async function POST(req: NextRequest) {
  try {
    const { files, message } = (await req.json()) as {
      files: Array<{ path: string; content: string }>;
      message?: string;
    };

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "files[] required" }, { status: 400 });
    }

    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;
    if (!token || !repo) {
      return NextResponse.json(
        { error: "GITHUB_TOKEN or GITHUB_REPO not set" },
        { status: 500 }
      );
    }

    const branch = "main";

    // 1. Get current branch head
    const ref = await gh<{ object: { sha: string } }>(
      `${GH}/repos/${repo}/git/ref/heads/${branch}`,
      token
    );
    const parentSha = ref.object.sha;

    // 2. Get parent commit to extract its tree
    const parentCommit = await gh<{ tree: { sha: string } }>(
      `${GH}/repos/${repo}/git/commits/${parentSha}`,
      token
    );
    const baseTreeSha = parentCommit.tree.sha;

    // 3. Create blobs for each file in parallel
    const blobs = await Promise.all(
      files.map(async (f) => {
        const blob = await gh<{ sha: string }>(
          `${GH}/repos/${repo}/git/blobs`,
          token,
          {
            method: "POST",
            body: JSON.stringify({
              content: Buffer.from(f.content, "utf-8").toString("base64"),
              encoding: "base64",
            }),
          }
        );
        return { path: f.path, sha: blob.sha };
      })
    );

    // 4. Create a new tree with base_tree + all blobs
    const tree = await gh<{ sha: string }>(
      `${GH}/repos/${repo}/git/trees`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: blobs.map((b) => ({
            path: b.path,
            mode: "100644",
            type: "blob",
            sha: b.sha,
          })),
        }),
      }
    );

    // 5. Create commit pointing to new tree with parent
    const commitMsg =
      message ?? `Batch edit: ${files.length} file${files.length === 1 ? "" : "s"}`;
    const commit = await gh<{ sha: string }>(
      `${GH}/repos/${repo}/git/commits`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          message: commitMsg,
          tree: tree.sha,
          parents: [parentSha],
        }),
      }
    );

    // 6. Update branch ref to new commit
    await gh(`${GH}/repos/${repo}/git/refs/heads/${branch}`, token, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });

    // 7. Fire Vercel deploy hook ONCE (optional)
    const deployHook = process.env.VERCEL_DEPLOY_HOOK;
    if (deployHook) {
      try {
        await fetch(deployHook, { method: "POST" });
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({
      ok: true,
      commit: commit.sha,
      files: files.length,
      message: commitMsg,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "batch update failed" },
      { status: 500 }
    );
  }
}
