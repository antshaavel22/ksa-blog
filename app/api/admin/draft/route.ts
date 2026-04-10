import { NextRequest, NextResponse } from "next/server";

// ── Read: always filesystem (files bundled with Vercel deployment) ────────────

async function readDraft(filePath: string): Promise<string> {
  const fs = await import("fs");
  const path = await import("path");
  const abs = path.join(process.cwd(), filePath);
  if (!fs.existsSync(abs)) throw new Error("File not found: " + filePath);
  return fs.readFileSync(abs, "utf-8");
}

// ── Write: filesystem in dev, GitHub API in prod (Vercel fs is read-only) ────

async function writeDraftDev(filePath: string, content: string): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  const abs = path.join(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
}

async function writeDraftProd(filePath: string, content: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  // Get current SHA if file exists on GitHub
  const getRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });

  let sha: string | undefined;
  if (getRes.ok) {
    const data = await getRes.json() as { sha: string };
    sha = data.sha;
  }

  const body: Record<string, string> = {
    message: `Update draft: ${filePath}`,
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
  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub write error: ${putRes.status} ${err}`);
  }
}

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }
  if (!filePath.startsWith("content/drafts/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    // Always use filesystem — files are bundled with the Vercel deployment
    const content = await readDraft(filePath);
    return NextResponse.json({ content });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// ── Delete: GitHub API in prod, filesystem in dev ────────────────────────────

async function deleteDraftProd(filePath: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  const getRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!getRes.ok) throw new Error(`File not found on GitHub: ${filePath}`);
  const { sha } = await getRes.json() as { sha: string };

  const delRes = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: `Delete draft: ${filePath}`, sha }),
  });
  if (!delRes.ok) throw new Error(`GitHub delete error: ${delRes.status}`);
}

async function deleteDraftDev(filePath: string): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  const abs = path.join(process.cwd(), filePath);
  if (!fs.existsSync(abs)) throw new Error("File not found: " + abs);
  fs.unlinkSync(abs);
}

export async function DELETE(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) return NextResponse.json({ error: "path is required" }, { status: 400 });
  if (!filePath.startsWith("content/drafts/")) {
    return NextResponse.json({ error: "Invalid path — only drafts can be deleted this way" }, { status: 400 });
  }
  try {
    if (process.env.NODE_ENV === "production") {
      await deleteDraftProd(filePath);
    } else {
      await deleteDraftDev(filePath);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }
  if (!filePath.startsWith("content/drafts/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const { content } = await req.json() as { content: string };
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  try {
    if (process.env.NODE_ENV === "production") {
      await writeDraftProd(filePath, content);
    } else {
      await writeDraftDev(filePath, content);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
