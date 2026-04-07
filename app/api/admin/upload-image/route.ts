/**
 * POST /api/admin/upload-image
 * Accepts image upload from editor, resizes + compresses to WebP,
 * stores in GitHub repo at public/uploads/YYYY/MM/filename.webp
 *
 * Image processing:
 *  - Max width: 1400px (retina-ready for 700px blog column)
 *  - Format: WebP (best quality/size ratio)
 *  - Quality: 82 (sharp sweet spot — high res, small file)
 *  - Typical output: 80–200 KB for a full-width blog image
 */

import { NextRequest, NextResponse } from "next/server";

// ── GitHub API writer ───────────────────────────────────────────────────────

async function writeToGitHub(filePath: string, content: Buffer): Promise<string> {
  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  // Check if file exists
  const getRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });

  let sha: string | undefined;
  if (getRes.ok) {
    const data = (await getRes.json()) as { sha: string };
    sha = data.sha;
  }

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

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub write failed: ${putRes.status} ${err}`);
  }

  // Return raw GitHub URL for immediate preview (before Vercel redeploys)
  return `https://raw.githubusercontent.com/${repo}/main/${filePath}`;
}

// ── Filesystem writer (dev) ─────────────────────────────────────────────────

async function writeToDisk(filePath: string, content: Buffer): Promise<string> {
  const fs = await import("fs");
  const path = await import("path");
  const abs = path.join(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  // In dev, serve from local filesystem
  return "/" + filePath.replace(/^public\//, "");
}

// ── Slug helper ─────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, "") // remove extension
    .replace(/[äöüõ]/g, (c) => ({ ä: "a", ö: "o", ü: "u", õ: "o" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// ── Main handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Pilti ei leitud" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic"];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|gif|avif|heic)$/i)) {
      return NextResponse.json(
        { error: "Lubatud formaadid: JPEG, PNG, WebP, GIF, AVIF, HEIC" },
        { status: 400 }
      );
    }

    // Validate file size (max 20 MB input)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Fail on liiga suur (max 20 MB)" },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Process with sharp
    const sharp = (await import("sharp")).default;

    // Get metadata first
    const metadata = await sharp(inputBuffer).metadata();
    const originalWidth = metadata.width ?? 0;
    const originalHeight = metadata.height ?? 0;
    const originalSizeKB = Math.round(inputBuffer.length / 1024);

    // Resize + compress to WebP
    const maxWidth = 1400;
    let pipeline = sharp(inputBuffer).rotate(); // auto-rotate from EXIF

    if (originalWidth > maxWidth) {
      pipeline = pipeline.resize(maxWidth, undefined, {
        withoutEnlargement: true,
        fit: "inside",
      });
    }

    const outputBuffer = await pipeline
      .webp({ quality: 82, effort: 4 })
      .toBuffer();

    const outputMeta = await sharp(outputBuffer).metadata();
    const outputSizeKB = Math.round(outputBuffer.length / 1024);

    // Build file path: public/uploads/YYYY/MM/filename.webp
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const slug = sanitizeFilename(file.name);
    const timestamp = Date.now().toString(36); // short unique suffix
    const filename = `${slug}-${timestamp}.webp`;
    const filePath = `public/uploads/${yyyy}/${mm}/${filename}`;

    // Save
    let previewUrl: string;
    if (process.env.NODE_ENV === "production") {
      previewUrl = await writeToGitHub(filePath, outputBuffer);
    } else {
      previewUrl = await writeToDisk(filePath, outputBuffer);
    }

    // The final URL for the blog (after deploy)
    const blogUrl = `/uploads/${yyyy}/${mm}/${filename}`;

    return NextResponse.json({
      ok: true,
      url: blogUrl,
      previewUrl,
      filename,
      original: {
        name: file.name,
        width: originalWidth,
        height: originalHeight,
        sizeKB: originalSizeKB,
        type: file.type,
      },
      optimized: {
        width: outputMeta.width,
        height: outputMeta.height,
        sizeKB: outputSizeKB,
        format: "webp",
      },
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

// Increase body size limit for image uploads (default is 1MB)
export const config = {
  api: {
    bodyParser: false,
  },
};
