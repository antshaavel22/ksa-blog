/**
 * POST /api/admin/move-lang
 * Moves a draft to a different language folder and updates the lang frontmatter field.
 * Only works for drafts (content/drafts/*). Published posts just update frontmatter in-place.
 *
 * Body: { fromPath: string, toLang: "et"|"ru"|"en", content: string }
 * Returns: { ok: true, newPath: string }
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";

function newPathForLang(fromPath: string, toLang: string): string {
  // content/drafts/et/file.mdx → content/drafts/en/file.mdx
  return fromPath.replace(/content\/drafts\/(et|ru|en)\//, `content/drafts/${toLang}/`);
}

async function moveDev(fromPath: string, newPath: string, content: string) {
  const fs = await import("fs");
  const pathMod = await import("path");
  const cwd = process.cwd();
  const absNew = pathMod.join(cwd, newPath);
  fs.mkdirSync(pathMod.dirname(absNew), { recursive: true });
  fs.writeFileSync(absNew, content, "utf-8");
  const absOld = pathMod.join(cwd, fromPath);
  if (fs.existsSync(absOld) && fromPath !== newPath) fs.unlinkSync(absOld);
}

async function moveProd(fromPath: string, newPath: string, content: string) {
  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;
  const base = `https://api.github.com/repos/${repo}/contents/`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  const b64 = Buffer.from(content, "utf-8").toString("base64");

  // 1. Write new file
  const putUrl = base + newPath;
  const checkRes = await fetch(putUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
  const putBody: Record<string, string> = { message: `Move to ${path.dirname(newPath)}: ${path.basename(newPath)}`, content: b64 };
  if (checkRes.ok) { const d = await checkRes.json() as { sha: string }; putBody.sha = d.sha; }
  const putRes = await fetch(putUrl, { method: "PUT", headers, body: JSON.stringify(putBody) });
  if (!putRes.ok) throw new Error(`GitHub write error: ${putRes.status} ${await putRes.text()}`);

  // 2. Delete old file (only if path actually changed)
  if (fromPath !== newPath) {
    const delUrl = base + fromPath;
    const getRes = await fetch(delUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
    if (getRes.ok) {
      const d = await getRes.json() as { sha: string };
      await fetch(delUrl, {
        method: "DELETE", headers,
        body: JSON.stringify({ message: `Remove old draft after lang move: ${path.basename(fromPath)}`, sha: d.sha }),
      });
    }
  }
}

export async function POST(req: NextRequest) {
  const { fromPath, toLang, content } = await req.json() as {
    fromPath: string; toLang: string; content: string;
  };

  if (!fromPath?.startsWith("content/drafts/")) {
    return NextResponse.json({ error: "Only drafts can be moved" }, { status: 400 });
  }
  if (!["et", "ru", "en"].includes(toLang)) {
    return NextResponse.json({ error: "Invalid lang" }, { status: 400 });
  }
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  const newPath = newPathForLang(fromPath, toLang);
  try {
    if (process.env.NODE_ENV === "production") {
      await moveProd(fromPath, newPath, content);
    } else {
      await moveDev(fromPath, newPath, content);
    }
    return NextResponse.json({ ok: true, newPath });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
