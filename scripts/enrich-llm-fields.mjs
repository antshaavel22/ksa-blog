/**
 * Batch-fill the MISSING LLM/SEO frontmatter fields across content/posts/*.mdx.
 *
 * Same operation as the "✨ SEO + LLM" button in /admin, run over the archive
 * instead of one post at a time. Uses the identical prompt and the identical
 * never-overwrite rule: a field that already has a value is left untouched,
 * so nothing an editor wrote is ever replaced.
 *
 * These fields are NOT rendered as visible article text — faqItems and
 * llmSearchQueries feed JSON-LD and search/LLM discovery only. No post body,
 * title or excerpt is modified.
 *
 * Usage:
 *   node scripts/enrich-llm-fields.mjs --sample 5      # generate, print, write nothing
 *   node scripts/enrich-llm-fields.mjs --limit 50      # write 50 posts
 *   node scripts/enrich-llm-fields.mjs --apply         # write all missing
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const args = process.argv.slice(2);
const SAMPLE = args.includes("--sample") ? Number(args[args.indexOf("--sample") + 1] || 5) : 0;
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1] || 0) : 0;
const APPLY = args.includes("--apply") || LIMIT > 0;
const CONCURRENCY = 6;
// Language quality matters here: these strings are published as structured data
// and get quoted verbatim by search engines and assistants. Haiku produced
// occasional Estonian grammar slips in testing, so the batch defaults to a
// stronger model. Override with --model.
const MODEL = args.includes("--model") ? args[args.indexOf("--model") + 1] : "claude-sonnet-5";

const LANG_LABEL = { et: "Estonian", ru: "Russian", en: "English" };
const client = new Anthropic();

function splitFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  return { fm: m[1], body: m[2] };
}

function fmHas(fm, field) {
  const block = new RegExp(`^${field}:\\s*\\n(?:[ \\t]+- .+\\n(?:[ \\t]+\\w+:.+\\n?)*)+`, "m");
  const inline = new RegExp(`^${field}:[ \\t]*(.+)$`, "m");
  if (block.test(fm)) return true;
  const i = fm.match(inline);
  if (!i) return false;
  const v = i[1].trim();
  return v.length > 0 && v !== '""' && v !== "[]";
}

function yamlQuote(s) {
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").trim()}"`;
}

function appendFaq(fm, items) {
  const lines = items.map((it) => `  - q: ${yamlQuote(it.q)}\n    a: ${yamlQuote(it.a)}`);
  return `${fm.replace(/\s*$/, "")}\nfaqItems:\n${lines.join("\n")}`;
}

function appendQueries(fm, queries) {
  const lines = queries.map((q) => `  - ${yamlQuote(q)}`);
  return `${fm.replace(/\s*$/, "")}\nllmSearchQueries:\n${lines.join("\n")}`;
}

async function enrich(file) {
  const raw = fs.readFileSync(file, "utf-8");
  const parts = splitFrontmatter(raw);
  if (!parts) return { file, status: "no-frontmatter" };
  let { fm, body } = parts;

  const needFaq = !fmHas(fm, "faqItems");
  const needQueries = !fmHas(fm, "llmSearchQueries");
  if (!needFaq && !needQueries) return { file, status: "complete" };

  const lang = (fm.match(/^lang:\s*"?([a-z]{2})"?/m) || [, "et"])[1];
  const title = (fm.match(/^title:\s*"?(.*?)"?\s*$/m) || [, path.basename(file)])[1];
  const langLabel = LANG_LABEL[lang] || "Estonian";
  const bodyTrim = body.length > 4000 ? body.slice(0, 4000) + "…" : body;

  const fields = [needQueries && "llmSearchQueries", needFaq && "faqItems"].filter(Boolean);

  // Prompt kept identical to app/api/admin/enrich-seo/route.ts so batch output
  // and button output cannot drift apart.
  const prompt = `You generate SEO + LLM-search frontmatter for a KSA Silmakeskus (vision clinic) blog post. The post is in ${langLabel}.

Generate ONLY these fields: ${fields.join(", ")}.

Output strict JSON with exactly these top-level keys (omit any not requested). No commentary, no code fences.

FIELD SPECS:
- llmSearchQueries: array of exactly 10 strings — questions or search-style phrases readers might type into Google / Perplexity / ChatGPT to find this post. ${langLabel}. Mix of how/why/what/can-I phrasings. No duplicates.
- faqItems: array of 4–6 objects {q: string, a: string}. ${langLabel}. Q is a real reader question (under 80 chars). A is 1–3 sentences derived from the body — never invent facts. Keep medical claims conservative; cite the body's framing. Write the answer so it stands alone when quoted by a search engine: never refer to "the post", "the article", "postituse järgi", "статья" or similar — state the fact directly.

VOICE rules (KSA): warm, professional, low-key trust. Never use superlatives ("best", "magical", "revolutionary", "лучший", "чудо", "kõige parem"). Cite numbers and procedure names instead of intensifiers. Russian: spell Tallinn as "Таллинн" (two н).

POST TITLE: ${title}

POST BODY:
───
${bodyTrim}
───

Return JSON now.`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });
  // Models that emit a thinking block put the JSON in a later content block.
  const textBlock = resp.content.find((b) => b.type === "text");
  if (!textBlock) return { file, status: "no-text-block" };
  let text = textBlock.text.trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { file, status: "bad-json" };
  }

  const added = [];
  let newFm = fm;
  if (needQueries && Array.isArray(parsed.llmSearchQueries)) {
    const arr = parsed.llmSearchQueries.filter((x) => typeof x === "string" && x.trim()).map((s) => s.trim()).slice(0, 12);
    if (arr.length >= 5) {
      newFm = appendQueries(newFm, arr);
      added.push(`llmSearchQueries(${arr.length})`);
    }
  }
  if (needFaq && Array.isArray(parsed.faqItems)) {
    const arr = parsed.faqItems
      .filter((x) => x && typeof x.q === "string" && typeof x.a === "string" && x.q.trim() && x.a.trim())
      .map((x) => ({ q: x.q.trim(), a: x.a.trim() }))
      .slice(0, 6);
    if (arr.length >= 3) {
      newFm = appendFaq(newFm, arr);
      added.push(`faqItems(${arr.length})`);
    }
  }
  if (!added.length) return { file, status: "nothing-usable" };

  if (APPLY) {
    fs.writeFileSync(file, `---\n${newFm}\n---\n${body}`, "utf-8");
  }
  return { file, status: APPLY ? "written" : "preview", added, lang, parsed };
}

const files = fs
  .readdirSync("content/posts")
  .filter((f) => f.endsWith(".mdx"))
  .map((f) => path.join("content/posts", f));

const todo = files.filter((f) => {
  const parts = splitFrontmatter(fs.readFileSync(f, "utf-8"));
  return parts && (!fmHas(parts.fm, "faqItems") || !fmHas(parts.fm, "llmSearchQueries"));
});

let queue = todo;
if (SAMPLE) queue = todo.slice(0, SAMPLE);
else if (LIMIT) queue = todo.slice(0, LIMIT);

console.log(`${files.length} posts, ${todo.length} missing fields, processing ${queue.length} with ${MODEL}${APPLY ? " (WRITING)" : " (preview only)"}\n`);

const results = [];
let i = 0;
async function worker() {
  while (i < queue.length) {
    const file = queue[i++];
    try {
      const r = await enrich(file);
      results.push(r);
      if (r.status === "written") console.log(`  ok   ${path.basename(file)}  ${r.added.join(" ")}`);
      else if (r.status === "preview") {
        console.log(`\n── ${path.basename(file)} [${r.lang}] ──`);
        if (r.parsed.faqItems) for (const it of r.parsed.faqItems.slice(0, 3)) console.log(`  Q: ${it.q}\n  A: ${it.a}`);
        if (r.parsed.llmSearchQueries) console.log(`  queries: ${r.parsed.llmSearchQueries.slice(0, 3).join(" | ")}`);
      } else console.log(`  ${r.status.padEnd(6)} ${path.basename(file)}`);
    } catch (e) {
      results.push({ file, status: "error", error: String(e).slice(0, 120) });
      console.log(`  ERR  ${path.basename(file)}  ${String(e).slice(0, 120)}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const by = results.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
console.log(`\nsummary: ${JSON.stringify(by)}`);
