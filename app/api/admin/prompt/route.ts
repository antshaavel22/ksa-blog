import { NextRequest, NextResponse } from "next/server";
import path from "path";

const PROMPT_FILE = path.join(process.cwd(), "content/system/master-prompt.md");

export async function GET() {
  const fs = await import("fs");
  if (!fs.existsSync(PROMPT_FILE)) {
    return NextResponse.json({ error: "Prompt file not found" }, { status: 404 });
  }
  const content = fs.readFileSync(PROMPT_FILE, "utf-8");
  return NextResponse.json({ content });
}

export async function PUT(req: NextRequest) {
  const { content } = await req.json() as { content: string };
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  const fs = await import("fs");
  const pathMod = await import("path");
  fs.mkdirSync(pathMod.dirname(PROMPT_FILE), { recursive: true });
  fs.writeFileSync(PROMPT_FILE, content, "utf-8");
  return NextResponse.json({ ok: true });
}
