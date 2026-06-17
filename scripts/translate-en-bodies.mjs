// Translate the Estonian body + Estonian text fields of posts tagged lang:en
// into English (faithful translation, KSA voice), preserving all markdown/MDX
// structure. These are half-translated posts: English title, Estonian body.
//   node scripts/translate-en-bodies.mjs --dry-run [--limit N]
//   node scripts/translate-en-bodies.mjs [--limit N]
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Anthropic from "@anthropic-ai/sdk";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, "utf-8").split("\n")) { const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
const DRY = process.argv.includes("--dry-run");
const LIM = (() => { const i = process.argv.indexOf("--limit"); return i > -1 ? parseInt(process.argv[i + 1]) : Infinity; })();
const dir = "content/posts";
const client = new Anthropic();

const EN_FW = /\b(the|and|is|of|to|for|with|your|you|this|that|are|how|why|what|can|will|from|when|which|their|has|have|was|were|on|in|at|by|as|it|but|not|or)\b/gi;
const ET_FW = /\b(ja|on|ei|see|kui|mis|oma|ka|et|võib|sa|sinu|kõik|ning|või|kuid|sest|aga|siis|nii|veel|juba|olla|tema|nende|seda|selle|need|meie|teie|kes|mida|pärast)\b/gi;
const ET_CHARS = /[õäöüÕÄÖÜšž]/;
function isEnglish(s) { const en = (s.match(EN_FW) || []).length, et = (s.match(ET_FW) || []).length, t = en + et; return t < 4 ? !ET_CHARS.test(s) : en / t > 0.6; }
function structure(b) {
  return {
    h: (b.match(/^#{2,4}\s/gm) || []).length,
    links: (b.match(/\]\(/g) || []).length,
    yt: (b.match(/<YouTubeEmbed/g) || []).length,
    rd: (b.match(/<RendiaEmbed/g) || []).length,
    vm: (b.match(/<VimeoEmbed/g) || []).length,
  };
}
const sameStruct = (a, b) => a.links === b.links && a.yt === b.yt && a.rd === b.rd && a.vm === b.vm && Math.abs(a.h - b.h) <= 0;

async function translateBody(body, title) {
  const prompt = `You are translating a KSA Silmakeskus (Estonian eye clinic) blog article body from Estonian into English. This is a TRANSLATION, not a rewrite.

STRICT RULES:
- Translate ALL Estonian prose into natural, fluent English. Add nothing, remove nothing, invent no facts.
- PRESERVE EXACTLY, unchanged:
  • markdown heading markers (##, ###) — translate the heading TEXT, keep the markers
  • links [text](url) — translate the text, keep the URL byte-for-byte
  • images ![alt](url) — keep entirely unchanged
  • MDX components <YouTubeEmbed .../>, <RendiaEmbed .../>, <VimeoEmbed .../> — keep entirely unchanged
  • bold **x**, italic *x*, bullet/numbered lists, blockquotes, line breaks between paragraphs
- Keep proper names, brand names (KSA, Flow3, Schwind), and numbers exactly.
- Voice: calm, professional, trustworthy — never salesy. No superlatives (best/magic/revolutionary/perfect). Keep medical terms and explain them in plain words, e.g. "cornea (the eye's clear front layer)".
- Output ONLY the translated markdown body. No frontmatter, no code fences, no commentary.

ARTICLE TITLE (already English, for context): ${title}

ESTONIAN BODY:
${body}`;
  const res = await client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 8000, messages: [{ role: "user", content: prompt }] });
  return (res.content[0]?.text || "").replace(/^```(?:markdown|mdx)?\n?/i, "").replace(/\n?```$/i, "").trim();
}
async function translateLine(text) {
  if (!text || isEnglish(text)) return text; // already English → leave
  const res = await client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 400, messages: [{ role: "user", content: `Translate this KSA eye-clinic blog text from Estonian to English. Faithful, calm professional voice, no superlatives, end on a complete sentence. Output ONLY the English text, no quotes:\n\n${text}` }] });
  return (res.content[0]?.text || "").trim().replace(/^["'«»]+|["'«»]+$/g, "").replace(/\s+/g, " ").trim();
}
function setLine(content, key, val) {
  const yaml = val.includes('"') ? `'${val.replace(/'/g, "''")}'` : `"${val}"`;
  const re = new RegExp(`^${key}:.*$(?:\\n[ \\t]+\\S.*$)*`, "m");
  return re.test(content) ? content.replace(re, () => `${key}: ${yaml}`) : content;
}

// Collect the 36
const targets = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".mdx")) continue;
  let g; try { g = matter(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
  if (String(g.data.lang || "").trim() !== "en") continue;
  const en = (g.content.match(EN_FW) || []).length, et = (g.content.match(ET_FW) || []).length;
  if (en + et >= 8 && en / (en + et) < 0.4) targets.push({ f, data: g.data, body: g.content });
}
console.error(`Posts to translate: ${targets.length}${LIM < Infinity ? ` (limiting to ${LIM})` : ""} ${DRY ? "[DRY-RUN]" : "[WRITING]"}`);
const work = targets.slice(0, LIM);

let ok = 0, warn = 0;
const POOL = 4;
async function one(t) {
  try {
    const before = structure(t.body);
    const enBody = await translateBody(t.body, String(t.data.title || ""));
    const after = structure(enBody);
    const structOk = sameStruct(before, after);
    const bodyEnglish = isEnglish(enBody);
    if (!bodyEnglish) { warn++; console.log(`⚠ ${t.f} — output not English, SKIPPED`); return; }
    if (!structOk) { warn++; console.log(`⚠ ${t.f} — structure drift before=${JSON.stringify(before)} after=${JSON.stringify(after)} (still applying body, review)`); }
    // frontmatter text fields
    const exEn = await translateLine(String(t.data.excerpt || ""));
    const seoExEn = await translateLine(String(t.data.seoExcerpt || ""));
    const seoTEn = await translateLine(String(t.data.seoTitle || ""));
    console.log(`\n=== ${t.f} ===`);
    console.log(`  H:${before.h}->${after.h} links:${before.links} yt:${before.yt} rd:${before.rd} vm:${before.vm} | struct ${structOk ? "OK" : "DRIFT"}`);
    console.log(`  body[0:140]: ${enBody.replace(/\n/g, " ").slice(0, 140)}`);
    if (exEn) console.log(`  excerpt: ${exEn.slice(0, 120)}`);
    if (!DRY) {
      const p = path.join(dir, t.f);
      let raw = fs.readFileSync(p, "utf8");
      const parsed = matter(raw);
      let fm = raw.slice(0, raw.length - parsed.content.length); // frontmatter incl. fences + leading
      // rebuild: replace fields in the frontmatter region, then body
      const fmBlock = raw.match(/^---\n[\s\S]*?\n---/)[0];
      let newFm = fmBlock;
      if (exEn && exEn !== String(t.data.excerpt || "")) newFm = setLine(newFm, "excerpt", exEn);
      if (seoExEn && seoExEn !== String(t.data.seoExcerpt || "")) newFm = setLine(newFm, "seoExcerpt", seoExEn);
      if (seoTEn && seoTEn !== String(t.data.seoTitle || "")) newFm = setLine(newFm, "seoTitle", seoTEn);
      fs.writeFileSync(p, `${newFm}\n${enBody}\n`);
    }
    ok++;
  } catch (e) { warn++; console.log(`✗ ${t.f} — ${e.message}`); }
}
for (let i = 0; i < work.length; i += POOL) { await Promise.all(work.slice(i, i + POOL).map(one)); console.error(`  …${Math.min(i + POOL, work.length)}/${work.length}`); }
console.error(`\nDone. ok=${ok} warn=${warn} ${DRY ? "(dry-run)" : "(written)"}`);
