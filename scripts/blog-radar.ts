/**
 * blog-radar.ts
 * Daily editorial radar — scans curated RSS feeds, picks top 3 vision/eye-health items,
 * posts to KSA Slack #blog-radar at 08:00 EET. No drafts written; just leads for editors.
 *
 * Usage:
 *   npm run radar                # post to #blog-radar
 *   npm run radar -- --dry-run   # print to stdout, do not post
 *   npm run radar -- --dm        # post to Ants's DM instead of channel (test mode)
 */

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import Parser from "rss-parser";

// ── env loader (same pattern as content-scout) ────────────────────────────────
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DM_MODE = args.includes("--dm");

const SLACK_WEBHOOK = process.env.SLACK_RADAR_WEBHOOK;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL = DM_MODE ? "U08C1C757NX" : "C0B0AL88P0R"; // Ants DM | #blog-radar
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SEEN_FILE = path.join(process.cwd(), ".radar-seen.json");

if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing");

// ── sources ──────────────────────────────────────────────────────────────────
type Source = { id: string; name: string; url: string; lang: "en" | "et" | "ru" };
const SOURCES: Source[] = [
  // English — research / industry
  { id: "healio_ophth", name: "Healio Ophthalmology", url: "https://www.healio.com/sws/feed/news/ophthalmology", lang: "en" },
  { id: "healio_opto", name: "Healio Optometry", url: "https://www.healio.com/sws/feed/news/optometry", lang: "en" },
  { id: "bjo", name: "British Journal of Ophthalmology", url: "https://bjo.bmj.com/rss/current.xml", lang: "en" },
  { id: "bmjophth", name: "BMJ Open Ophthalmology", url: "https://bmjophth.bmj.com/rss/recent.xml", lang: "en" },
  { id: "medpagetoday_ophth", name: "MedPage Today Ophthalmology", url: "https://www.medpagetoday.com/rss/Ophthalmology.xml", lang: "en" },
  { id: "sciencedaily_eye", name: "ScienceDaily Eye Care", url: "https://www.sciencedaily.com/rss/health_medicine/eye_care.xml", lang: "en" },
  // Estonian — broad health/lifestyle/science (filter applied for eye-related)
  { id: "err", name: "ERR Uudised", url: "https://www.err.ee/rss", lang: "et" },
  { id: "novaator", name: "ERR Novaator (teadus)", url: "https://novaator.err.ee/rss", lang: "et" },
  { id: "postimees_tervis", name: "Postimees Tervis", url: "https://tervis.postimees.ee/rss", lang: "et" },
  // Russian (Estonia-local)
  { id: "rus_err", name: "ERR rus", url: "https://rus.err.ee/rss", lang: "ru" },
  { id: "rus_postimees", name: "Postimees Rus Здоровье", url: "https://rus.postimees.ee/rss", lang: "ru" },
];

// ── seen-store ───────────────────────────────────────────────────────────────
function loadSeen(): Set<string> {
  if (!fs.existsSync(SEEN_FILE)) return new Set();
  try { return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, "utf-8"))); } catch { return new Set(); }
}
function saveSeen(seen: Set<string>) {
  // keep last ~2000 entries
  const arr = Array.from(seen).slice(-2000);
  fs.writeFileSync(SEEN_FILE, JSON.stringify(arr, null, 2));
}

// ── fetch ────────────────────────────────────────────────────────────────────
type Item = { title: string; link: string; date: string; sourceName: string; lang: Source["lang"]; snippet: string };

async function fetchAll(): Promise<Item[]> {
  const parser = new Parser({ timeout: 12000 });
  const items: Item[] = [];
  await Promise.all(SOURCES.map(async (s) => {
    try {
      const feed = await parser.parseURL(s.url);
      for (const it of feed.items.slice(0, 12)) {
        if (!it.link || !it.title) continue;
        items.push({
          title: it.title.trim(),
          link: it.link,
          date: it.isoDate ?? it.pubDate ?? new Date().toISOString(),
          sourceName: s.name,
          lang: s.lang,
          snippet: (it.contentSnippet ?? it.content ?? "").slice(0, 400).replace(/\s+/g, " ").trim(),
        });
      }
    } catch (e) {
      console.error(`[radar] ${s.id} failed: ${(e as Error).message}`);
    }
  }));
  return items;
}

// ── candidate filtering ──────────────────────────────────────────────────────
const EYE_KEYWORDS_EN = [
  "eye", "vision", "ophthalm", "optometr", "retina", "cornea", "cataract", "glaucoma",
  "myopia", "lasik", "smile", "lens", "macula", "presbyo", "dry eye", "screen time",
  "blue light", "uveitis", "amblyo", "astigmat", "refractive",
];
const EYE_KEYWORDS_ET = [
  "silm", "nägem", "prilli", "kontaktlaats", "laser", "katarakt", "glaukoom",
  "lühinägelik", "kaugnägelik", "võrkkest", "sarvkest", "kuiv silm", "ekraan",
];
const EYE_KEYWORDS_RU = [
  "глаз", "зрен", "очк", "линз", "лазер", "катаракт", "глауком",
  "близорук", "дальнозорк", "сетчатк", "роговиц", "сухой глаз", "экран",
];

function matchesEyeKeywords(item: Item): boolean {
  const haystack = (item.title + " " + item.snippet).toLowerCase();
  const list = item.lang === "et" ? EYE_KEYWORDS_ET : item.lang === "ru" ? EYE_KEYWORDS_RU : EYE_KEYWORDS_EN;
  return list.some((kw) => haystack.includes(kw));
}

// ── existing-slug dedupe ─────────────────────────────────────────────────────
function existingSlugs(): Set<string> {
  const dir = path.join(process.cwd(), "content/posts");
  if (!fs.existsSync(dir)) return new Set();
  return new Set(fs.readdirSync(dir).filter((f) => f.endsWith(".mdx")).map((f) => f.replace(/\.mdx$/, "")));
}

// ── Claude scoring + TL;DR ───────────────────────────────────────────────────
type Scored = Item & { score: number; tldr: string; reason: string };

async function scoreAndSummarise(items: Item[], existingSlugCount: number): Promise<Scored[]> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const sample = items.slice(0, 40);
  const prompt = `You are an editorial scout for KSA Silmakeskus, an eye-care clinic in Estonia (laser surgery, ICB, dry eye, kids' vision). I have ${sample.length} candidate articles from RSS feeds. The blog already has ${existingSlugCount} published posts on these topics.

Your job: for EACH candidate, return a JSON line with:
- score (0-10): how editorially valuable for a vision/eye-health blog audience. Peer-reviewed research = 8-10. Industry news with patient relevance = 6-8. General health that mentions eyes = 3-5. Off-topic = 0-2.
- tldr: 60-90 words in the article's ORIGINAL language (en/et/ru). Lead with what's new or interesting; do not editorialize. End with a complete sentence.
- reason: 8-15 words why this is/isn't worth surfacing.

Return one JSON object per line (NDJSON). No markdown, no preamble. Example: {"i":0,"score":7,"tldr":"...","reason":"..."}

Candidates (i = index):
${sample.map((it, i) => `[${i}] (${it.lang}, ${it.sourceName}) ${it.title}\n     ${it.snippet.slice(0, 200)}`).join("\n")}`;

  const resp = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  const scored: Scored[] = [];
  for (const line of text.split("\n")) {
    const trim = line.trim();
    if (!trim.startsWith("{")) continue;
    try {
      const obj = JSON.parse(trim);
      const it = sample[obj.i];
      if (!it) continue;
      scored.push({ ...it, score: obj.score, tldr: obj.tldr, reason: obj.reason });
    } catch { /* skip malformed */ }
  }
  return scored;
}

// ── Slack formatting + posting ───────────────────────────────────────────────
const FLAGS: Record<Source["lang"], string> = { en: "🇬🇧", et: "🇪🇪", ru: "🇷🇺" };

function buildSlackMessage(top: Scored[]): string {
  const today = new Date().toLocaleDateString("et-EE", { day: "numeric", month: "long", year: "numeric" });
  const header = `🛰️  *Blog Radar — ${today}*\nKolm valitud linki silmade ja nägemise teemadel. Loe huvi korral, kommenteeri thread'is.\n`;
  const blocks = top.map((s, i) => {
    const flag = FLAGS[s.lang];
    return `\n*${i + 1}.* ${flag}  *<${s.link}|${s.title}>*\n_${s.sourceName}_\n${s.tldr}`;
  });
  return header + blocks.join("\n");
}

async function postToSlack(text: string): Promise<void> {
  if (DRY_RUN) {
    console.log("\n────── DRY RUN ──────\n" + text + "\n────── END ──────\n");
    return;
  }

  if (SLACK_BOT_TOKEN) {
    const r = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
      body: JSON.stringify({ channel: SLACK_CHANNEL, text, unfurl_links: false, unfurl_media: false }),
    });
    const j = await r.json() as { ok: boolean; error?: string };
    if (!j.ok) throw new Error(`slack chat.postMessage: ${j.error}`);
    console.log(`[radar] posted to ${SLACK_CHANNEL} via bot token`);
    return;
  }

  if (SLACK_WEBHOOK) {
    const r = await fetch(SLACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) throw new Error(`slack webhook ${r.status}: ${await r.text()}`);
    console.log("[radar] posted via webhook");
    return;
  }

  throw new Error("No SLACK_BOT_TOKEN or SLACK_RADAR_WEBHOOK set");
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[radar] fetching ${SOURCES.length} sources...`);
  const all = await fetchAll();
  console.log(`[radar] ${all.length} raw items`);

  const seen = loadSeen();
  const slugs = existingSlugs();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days

  const candidates = all
    .filter((it) => !seen.has(it.link))
    .filter((it) => new Date(it.date).getTime() > cutoff)
    .filter(matchesEyeKeywords)
    .filter((it) => {
      // crude duplicate against existing blog: if title's first 4 words appear in any slug, skip
      const stub = it.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).slice(0, 4).join("-");
      return stub.length < 8 || !Array.from(slugs).some((s) => s.includes(stub));
    });

  console.log(`[radar] ${candidates.length} candidates after filtering`);
  if (candidates.length === 0) {
    console.log("[radar] no candidates today — skipping post");
    return;
  }

  const scored = await scoreAndSummarise(candidates, slugs.size);
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);

  if (top.length === 0) {
    console.log("[radar] nothing scored — skipping post");
    return;
  }

  const text = buildSlackMessage(top);
  await postToSlack(text);

  if (!DRY_RUN) {
    for (const t of top) seen.add(t.link);
    saveSeen(seen);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
