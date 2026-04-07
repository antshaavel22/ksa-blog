/**
 * POST /api/admin/save-raw-draft
 * Saves user-written text directly as a draft MDX file — NO AI processing.
 * Text goes in exactly as the user wrote it.
 */

import { NextRequest, NextResponse } from "next/server";

// ── Write: filesystem in dev, GitHub API in prod ────────────────────────────

async function writeDev(filePath: string, content: string): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  const abs = path.join(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
}

async function writeProd(filePath: string, content: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPO!;
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  // Check if file already exists (get SHA)
  const getRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });

  let sha: string | undefined;
  if (getRes.ok) {
    const data = (await getRes.json()) as { sha: string };
    sha = data.sha;
  }

  const body: Record<string, string> = {
    message: `draft: ${filePath}`,
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöüõ]/g, (c) => ({ ä: "a", ö: "o", ü: "u", õ: "o" })[c] ?? c)
    .replace(/[а-яё]/g, (c) => {
      const map: Record<string, string> = {
        а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
        з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
        п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
        ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
      };
      return map[c] ?? c;
    })
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function escapeYaml(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").trim()}"`;
}

export async function POST(req: NextRequest) {
  try {
    const { title, body, lang, author, categories, tags } = (await req.json()) as {
      title: string;
      body: string;
      lang: string;
      author?: string;
      categories?: string[];
      tags?: string[];
    };

    if (!title?.trim()) {
      return NextResponse.json({ error: "Pealkiri on kohustuslik" }, { status: 400 });
    }
    if (!body?.trim()) {
      return NextResponse.json({ error: "Tekst on kohustuslik" }, { status: 400 });
    }
    if (!["et", "ru", "en"].includes(lang)) {
      return NextResponse.json({ error: "Kehtetu keel" }, { status: 400 });
    }

    const date = new Date().toISOString().split("T")[0];
    const slug = toSlug(title);
    const authorName = author?.trim() || "Dr. Ants Haavel";
    const cats = categories?.length ? categories : ["Elustiil"];
    const tagList = tags?.length ? tags : [];

    // Build MDX with minimal frontmatter
    const mdx = `---
title: ${escapeYaml(title)}
slug: "${slug}"
date: "${date}"
author: "${authorName}"
categories: [${cats.map((c) => `"${c.replace(/"/g, '\\"')}"`).join(", ")}]
tags: [${tagList.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(", ")}]
excerpt: ${escapeYaml(body.slice(0, 180).replace(/^#+\s*/gm, "").replace(/\n/g, " "))}
featuredImage: ""
lang: "${lang}"
ctaType: "kiirtest-soft"
medicalReview: false
status: "draft"
seoTitle: ${escapeYaml(title)}
seoExcerpt: ${escapeYaml(body.slice(0, 155).replace(/^#+\s*/gm, "").replace(/\n/g, " "))}
---

${body.trim()}
`;

    // Build file path
    const langDir = lang === "ru" ? "ru" : lang === "en" ? "en" : "et";
    let filename = `${date}-${slug}.mdx`;

    // Check for duplicates (dev only — in prod GitHub handles it)
    if (process.env.NODE_ENV !== "production") {
      const fs = await import("fs");
      const path = await import("path");
      const dir = path.join(process.cwd(), `content/drafts/${langDir}`);
      fs.mkdirSync(dir, { recursive: true });
      let counter = 1;
      while (fs.existsSync(path.join(dir, filename))) {
        filename = `${date}-${slug}-${counter++}.mdx`;
      }
    }

    const filePath = `content/drafts/${langDir}/${filename}`;

    if (process.env.NODE_ENV === "production") {
      await writeProd(filePath, mdx);
    } else {
      await writeDev(filePath, mdx);
    }

    return NextResponse.json({
      ok: true,
      filename,
      path: filePath,
      title: title.trim(),
      lang,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
