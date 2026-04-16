import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { oldPath, newPath } = await req.json() as { oldPath: string; newPath: string };
  if (!oldPath || !newPath) return NextResponse.json({ error: "oldPath and newPath required" }, { status: 400 });
  if (!oldPath.startsWith("public/uploads/") || !newPath.startsWith("public/uploads/")) {
    return NextResponse.json({ error: "Only /uploads/ images can be renamed" }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;
  const base = `https://api.github.com/repos/${repo}/contents`;

  // 1. Read old file
  const getRes = await fetch(`${base}/${oldPath}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!getRes.ok) return NextResponse.json({ error: `Could not read original image: ${getRes.status}` }, { status: 404 });
  const { content: b64, sha } = await getRes.json() as { content: string; sha: string };

  // 2. Write new file
  const putRes = await fetch(`${base}/${newPath}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Rename image: ${oldPath.split("/").pop()} → ${newPath.split("/").pop()}`,
      content: b64.replace(/\n/g, ""), // GitHub returns base64 with line breaks — strip them
    }),
  });
  if (!putRes.ok) return NextResponse.json({ error: `Could not write new image: ${putRes.status}` }, { status: 500 });

  // 3. Delete old file
  await fetch(`${base}/${oldPath}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ message: `Remove old image after rename: ${oldPath.split("/").pop()}`, sha }),
  });

  // Return the new public URL
  const newUrl = "/" + newPath.replace(/^public\//, "");
  return NextResponse.json({ ok: true, url: newUrl });
}
