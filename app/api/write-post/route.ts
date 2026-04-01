/**
 * POST /api/write-post
 * Takes a brief from the admin UI, generates trilingual blog posts via Claude,
 * saves them to content/drafts/. Local dev only.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

const DRAFTS_ROOT = path.join(process.cwd(), "content/drafts");

function draftsDir(lang: string): string {
  if (lang === "ru") return path.join(DRAFTS_ROOT, "ru");
  if (lang === "en") return path.join(DRAFTS_ROOT, "en");
  return DRAFTS_ROOT;
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
  const langInstructions: Record<string, string> = {
    et: `Estonian. Warm, expert but accessible. Natural language, not overly formal. Include KSA-specific context where natural.
Keywords to weave in naturally: laserkorrektsiooni hind, silmade laseroperatsioon, ICB operatsioon, Flow3 Tallinnas`,
    ru: `Russian. Professional yet warm. Use "вы" (formal). Include KSA context for Russian-speaking audience in Estonia.
Keywords: лазерная коррекция зрения Таллин, операция ICB, Flow3, KSA Silmakeskus`,
    en: `English. Clear, confident, expert. For expats in Tallinn or international patients.
Keywords: laser eye surgery Tallinn, ICB lens replacement Estonia, Flow3 procedure, KSA Silmakeskus`,
  };

  return `You are a senior content writer for KSA Silmakeskus, an eye clinic in Tallinn, Estonia.
KSA specialises in: Flow3 laser (flapless, safer for sports, 1-week recovery) and ICB lens replacement (for those not suited for laser).
KSA has 55,000+ procedures performed. Recovery after Flow3: ~1 week. Founded by Dr. Ants Haavel.

The editor/owner has given you the following brief or draft idea to develop into a full blog post in ${langLabel}:

---
${brief}
---

Write a complete, polished ${langLabel} blog post based on this brief. Expand it, add structure, and make it SEO-optimised.

Return ONLY a JSON object (no markdown code fences):
{
  "title": "Post title max 60 chars with primary keyword",
  "slug": "url-kebab-slug",
  "excerpt": "Meta description 150-180 chars with benefit and keyword",
  "categories": ["Category1", "Category2"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "ctaType": "kiirtest-inline or kiirtest-soft or none",
  "medicalReview": true or false,
  "seoTitle": "SEO title max 60 chars",
  "seoExcerpt": "Meta description 120-155 chars",
  "llmSearchQueries": [
    "Conversational question 1 this post answers (in ${langLabel})",
    "Conversational question 2",
    "Conversational question 3",
    "Conversational question 4",
    "Conversational question 5"
  ],
  "faqItems": [
    {"q": "Question 1 in ${langLabel}", "a": "Answer (2-3 sentences)"},
    {"q": "Question 2", "a": "Answer"},
    {"q": "Question 3", "a": "Answer"}
  ],
  "content": "Full markdown body (700-1000 words). Include:\\n- ## H2 headings every 200-300 words\\n- 1-2 natural internal links to ksa.ee (hinnakiri, flow3, icb-time)\\n- Keep the author's voice and original facts from the brief\\n- End with a natural CTA sentence\\n- Do NOT include H1 title\\n- Do NOT include a FAQ section (handled separately)"
}

CTA rules:
- kiirtest-inline: about laser/ICB/Flow3/getting rid of glasses
- kiirtest-soft: general eye health education
- none: children, general health unrelated to procedures

medicalReview = true only for specific clinical claims (dosages, contraindication lists, complication rates).`;
}

function buildMdxFile(post: Record<string, unknown>, lang: string, brief: string): string {
  const today = new Date().toISOString().split("T")[0];
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
  // Safety: only allow in dev
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Admin API only available in dev mode" }, { status: 403 });
  }

  const { brief, languages } = await req.json() as { brief: string; languages: string[] };

  if (!brief?.trim()) {
    return NextResponse.json({ error: "Brief is required" }, { status: 400 });
  }

  const client = new Anthropic();
  fs.mkdirSync(DRAFTS_ROOT, { recursive: true });
  fs.mkdirSync(path.join(DRAFTS_ROOT, "ru"), { recursive: true });
  fs.mkdirSync(path.join(DRAFTS_ROOT, "en"), { recursive: true });

  const results: { lang: string; filename: string; title: string; excerpt: string }[] = [];
  const errors: { lang: string; error: string }[] = [];

  for (const lang of (languages ?? ["et"])) {
    try {
      const prompt = buildPrompt(brief.trim(), lang);
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3500,
        messages: [{ role: "user", content: prompt }],
      });

      const text = (response.content[0] as { text: string }).text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");

      const post = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const today = new Date().toISOString().split("T")[0];
      const slug = (post.slug as string).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      const dir = draftsDir(lang);
      let filename = `${today}-${slug}.mdx`;

      // Avoid overwriting
      let counter = 1;
      while (fs.existsSync(path.join(dir, filename))) {
        filename = `${today}-${slug}-${counter++}.mdx`;
      }

      const mdx = buildMdxFile(post, lang, brief);
      fs.writeFileSync(path.join(dir, filename), mdx, "utf-8");

      results.push({
        lang,
        filename,
        title: post.title as string,
        excerpt: post.excerpt as string,
      });
    } catch (err) {
      errors.push({ lang, error: (err as Error).message });
    }
  }

  return NextResponse.json({ results, errors });
}
