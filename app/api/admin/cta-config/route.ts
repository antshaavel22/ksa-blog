import { NextRequest, NextResponse } from "next/server";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONFIG_PATH = "data/cta-config.json";

async function readDev(): Promise<unknown> {
  const fs = await import("fs");
  const abs = path.join(process.cwd(), CONFIG_PATH);
  return JSON.parse(fs.readFileSync(abs, "utf-8"));
}

async function readProd(): Promise<unknown> {
  // Try bundled filesystem first (fast, present since last deploy)
  try {
    const fs = await import("fs");
    const abs = path.join(process.cwd(), CONFIG_PATH);
    if (fs.existsSync(abs)) return JSON.parse(fs.readFileSync(abs, "utf-8"));
  } catch {}
  // Fallback: GitHub API (if config was changed after last deploy)
  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${CONFIG_PATH}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub read error: ${res.status}`);
  const data = await res.json() as { content: string };
  const decoded = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
  return JSON.parse(decoded);
}

async function writeDev(config: unknown): Promise<void> {
  const fs = await import("fs");
  const abs = path.join(process.cwd(), CONFIG_PATH);
  fs.writeFileSync(abs, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

async function writeProd(config: unknown): Promise<void> {
  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;
  const putUrl = `https://api.github.com/repos/${repo}/contents/${CONFIG_PATH}`;

  const checkRes = await fetch(putUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  const body: Record<string, string> = {
    message: "Update cta-config.json",
    content: Buffer.from(JSON.stringify(config, null, 2) + "\n", "utf-8").toString("base64"),
  };
  if (checkRes.ok) {
    const existing = await checkRes.json() as { sha: string };
    body.sha = existing.sha;
  }

  const putRes = await fetch(putUrl, {
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

  const deployHook = process.env.VERCEL_DEPLOY_HOOK;
  if (deployHook) {
    try {
      await fetch(deployHook, { method: "POST" });
    } catch {}
  }
}

export async function GET() {
  try {
    const config = process.env.NODE_ENV === "production" ? await readProd() : await readDev();
    return NextResponse.json({ config });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { config } = await req.json() as { config: unknown };
    if (!config || typeof config !== "object") {
      return NextResponse.json({ error: "config is required" }, { status: 400 });
    }
    if (process.env.NODE_ENV === "production") {
      await writeProd(config);
    } else {
      await writeDev(config);
    }
    const needsRedeploy = process.env.NODE_ENV === "production" && !process.env.VERCEL_DEPLOY_HOOK;
    return NextResponse.json({ ok: true, needsRedeploy });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
