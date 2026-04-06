/**
 * POST /api/write-post
 * Takes a brief from the admin UI, generates trilingual blog posts via Claude,
 * saves them to content/drafts/.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { KSA_MASTER_PROMPT, LANG_SEO_KEYWORDS } from "@/lib/master-prompt";

const DRAFTS_ROOT = path.join(process.cwd(), "content/drafts");

function draftsDir(lang: string): string {
  if (lang === "ru") return path.join(DRAFTS_ROOT, "ru");
  if (lang === "en") return path.join(DRAFTS_ROOT, "en");
  return path.join(DRAFTS_ROOT, "et");
}

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

function buildPrompt(brief: string, lang: string): string {
  const langLabel = lang === "et" ? "Estonian" : lang === "ru" ? "Russian" : "English";
  const keywords = LANG_SEO_KEYWORDS[lang]?.join(", ") ?? "";

  return `${KSA_MASTER_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR TASK — WRITE FROM BRIEF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The editor has given you the following brief, draft idea, or rough text.
Develop it into a full, polished KSA blog post in ${langLabel}.

If the brief already contains a near-complete article: polish, restructure,
and improve it while keeping all original facts and the author's voice.

If the brief is keywords/ideas/notes: expand into a full 700-1000 word post.

BRIEF:
───────
${brief}
───────

Language: ${langLabel}
SEO keywords to weave in naturally (do not keyword-stuff, 1-2 per 300 words):
${keywords}

Return ONLY a valid JSON object (no markdown fences, no explanation before or after):
{
  "title": "Compelling title max 60 chars — primary keyword near the start",
  "slug": "url-kebab-slug-max-60-chars",
  "excerpt": "Engaging meta description 150-180 chars — benefit + keyword",
  "categories": ["Primary Category", "Secondary Category"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "ctaType": "kiirtest-inline or kiirtest-soft or none",
  "medicalReview": false,
  "seoTitle": "SEO title max 60 chars",
  "seoExcerpt": "Meta description 120-155 chars",
  "llmSearchQueries": [
    "Natural question 1 this post answers (in ${langLabel})",
    "Natural question 2",
    "Natural question 3",
    "Natural question 4",
    "Natural question 5"
  ],
  "faqItems": [
    {"q": "FAQ question 1 (in ${langLabel})", "a": "Clear 2-3 sentence answer"},
    {"q": "FAQ question 2", "a": "Answer"},
    {"q": "FAQ question 3", "a": "Answer"}
  ],
  "content": "Full ${langLabel} article body in markdown (700-1000 words). Rules:\\n- Start with a hook — NO 'In this article...'\\n- ## H2 headings every 200-300 words\\n- Short paragraphs (2-4 sentences)\\n- Medical terms with plain translation: myopia (short-sightedness)\\n- 1-2 natural links to ksa.ee\\n- Do NOT include H1 or FAQ section (handled separately)\\n- End with an empowering sentence, not a sales pitch"
}`;
}

function buildMdxFile(post: Record<string, unknown>, lang: string, brief: string, dateOverride?: string): string {
  const today = dateOverride ?? new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  const faqItems = (post.faqItems as { q: string; a: string }[]) ?? [];
  const faqSection = faqItems.length > 0
    ? `\n\n## ${lang === "ru" ? "Часто задаваемые вопросы" : lang === "en" ? "Frequently Asked Questions" : "Korduma kippuvad küsimused"}\n\n` +
      faqItems.map((f) => `**${f.q}**\n\n${f.a}`).join("\n\n")
    : "";

  const y = (s: string) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").trim()}"`;
  const yamlList = (arr: string[]) => arr.map((s) => `  - ${y(s)}`).join("\n");
  const cats = post.categories as string[];
  const tags = post.tags as string[];

  return `---
title: ${y(post.title as string)}
slug: ${y(post.slug as string)}
date: ${y(today)}
author: "KSA Silmakeskus"
categories: [${cats.map((c) => `"${c.replace(/"/g, '\\"')}"`).join(", ")}]
tags: [${tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(", ")}]
excerpt: ${y(post.excerpt as string)}
featuredImage: ""
lang: "${lang}"
ctaType: "${post.ctaType}"
medicalReview: ${post.medicalReview}
status: "draft"
seoTitle: ${y(post.seoTitle as string)}
seoExcerpt: ${y(post.seoExcerpt as string)}
llmSearchQueries:
${yamlList((post.llmSearchQueries as string[]) ?? [])}
briefSummary: ${y(brief.slice(0, 200))}
generatedAt: "${now}"
---

${(post.content as string).trim()}${faqSection}
`;
}

export async function POST(req: NextRequest) {
  const { brief, languages, dateOverride } = await req.json() as {
    brief: string;
    languages: string[];
    dateOverride?: string;
  };

  if (!brief?.trim()) {
    return NextResponse.json({ error: "Brief is required" }, { status: 400 });
  }

  const client = new Anthropic();
  fs.mkdirSync(path.join(DRAFTS_ROOT, "et"), { recursive: true });
  fs.mkdirSync(path.join(DRAFTS_ROOT, "ru"), { recursive: true });
  fs.mkdirSync(path.join(DRAFTS_ROOT, "en"), { recursive: true });

  const results: { lang: string; filename: string; title: string; excerpt: string }[] = [];
  const errors: { lang: string; error: string }[] = [];

  for (const lang of (languages ?? ["et"])) {
    try {
      const prompt = buildPrompt(brief.trim(), lang);
      const response = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      });

      const text = (response.content[0] as { text: string }).text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");

      const post = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const date = dateOverride ?? new Date().toISOString().split("T")[0];
      const slug = (post.slug as string).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      const dir = draftsDir(lang);
      let filename = `${date}-${slug}.mdx`;

      let counter = 1;
      while (fs.existsSync(path.join(dir, filename))) {
        filename = `${date}-${slug}-${counter++}.mdx`;
      }

      const mdx = buildMdxFile(post, lang, brief, dateOverride);
      fs.writeFileSync(path.join(dir, filename), mdx, "utf-8");

      results.push({ lang, filename, title: post.title as string, excerpt: post.excerpt as string });
    } catch (err) {
      errors.push({ lang, error: (err as Error).message });
    }
  }

  return NextResponse.json({ results, errors });
}
