/**
 * POST /api/admin/upload-image
 * Receives a client-side compressed WebP blob, saves it to GitHub.
 * Heavy lifting (resize, compress) happens in the browser before upload
 * so the payload stays ~150–300 KB regardless of original file size.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireGitHubConfig } from "@/lib/admin-env";

export const runtime = "nodejs";

// ── GitHub API writer ───────────────────────────────────────────────────────

async function writeToGitHub(filePath: string, content: Buffer): Promise<string> {
  const { token, repo } = requireGitHubConfig();
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  const getRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  let sha: string | undefined;
  if (getRes.ok) sha = ((await getRes.json()) as { sha: string }).sha;

  const body: Record<string, string> = {
    message: `upload: ${filePath}`,
    content: content.toString("base64"),
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

  if (!putRes.ok) throw new Error(`GitHub: ${putRes.status} ${await putRes.text()}`);
  return `https://raw.githubusercontent.com/${repo}/main/${filePath}`;
}

// ── Filesystem writer (dev) ─────────────────────────────────────────────────

async function writeToDisk(filePath: string, content: Buffer): Promise<string> {
  if (!filePath.startsWith("public/uploads/")) {
    throw new Error("Invalid upload path");
  }

  const relativeUploadPath = filePath.replace(/^public\/uploads\//, "");
  const uploadRoot = path.join(process.cwd(), "public", "uploads");
  const abs = path.join(uploadRoot, relativeUploadPath);
  const resolvedRoot = path.resolve(uploadRoot);
  const resolvedTarget = path.resolve(abs);

  if (!resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new Error("Invalid upload path");
  }

  fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });
  fs.writeFileSync(resolvedTarget, content);
  return "/" + filePath.replace(/^public\//, "");
}

// ── Filename sanitizer ──────────────────────────────────────────────────────

function sanitize(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[äöüõ]/g, (c) => ({ ä: "a", ö: "o", ü: "u", õ: "o" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// ── Main ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    const originalName = formData.get("originalName") as string ?? "image";
    const originalSizeKB = Number(formData.get("originalSizeKB") ?? 0);
    const originalWidth = Number(formData.get("originalWidth") ?? 0);

    if (!file) return NextResponse.json({ error: "Pilti ei leitud" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Build path: public/uploads/YYYY/MM/slug-timestamp.webp
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const slug = sanitize(originalName);
    const ts = Date.now().toString(36);
    const filename = `${slug}-${ts}.webp`;
    const filePath = `public/uploads/${yyyy}/${mm}/${filename}`;

    const previewUrl =
      process.env.NODE_ENV === "production"
        ? await writeToGitHub(filePath, buffer)
        : await writeToDisk(filePath, buffer);

    const blogUrl = `/uploads/${yyyy}/${mm}/${filename}`;

    return NextResponse.json({
      ok: true,
      url: blogUrl,
      previewUrl,
      filename,
      original: { name: originalName, sizeKB: originalSizeKB, width: originalWidth, height: 0 },
      optimized: { sizeKB: Math.round(buffer.length / 1024), format: "webp" },
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
