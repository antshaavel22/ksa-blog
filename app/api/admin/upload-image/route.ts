/**
 * POST /api/admin/upload-image
 * Receives a client-side compressed image blob, normalizes it to a real WebP
 * on the server, and saves it to GitHub.
 *
 * The browser step is NOT trusted for format: Safari's canvas cannot encode
 * WebP and silently hands back a PNG, so until 2026-09-08 every photo Silvia
 * or Jana uploaded from Safari landed as a 1.5–2.4 MB PNG with a .webp name
 * (26 files, 41.5 MB). sharp now re-encodes anything that is not already a
 * small WebP: max 1400 px wide, quality 82, white matte.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { requireGitHubConfig } from "@/lib/admin-env";

/** Real WebP files start with RIFF....WEBP. Anything else gets re-encoded. */
function isWebp(buf: Buffer): boolean {
  return buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
}

const MAX_WIDTH = 1400;
const WEBP_QUALITY = 82;
const KEEP_AS_IS_BYTES = 400_000; // a genuine small WebP from Chrome is left untouched

async function normalizeToWebp(input: Buffer): Promise<Buffer> {
  if (isWebp(input) && input.length <= KEEP_AS_IS_BYTES) return input;
  return sharp(input)
    .rotate() // honour EXIF orientation from phone photos
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

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
    const received = Buffer.from(arrayBuffer);
    const buffer = await normalizeToWebp(received);

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
      optimized: { sizeKB: Math.round(buffer.length / 1024), format: "webp", receivedKB: Math.round(received.length / 1024), reencoded: buffer !== received },
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
