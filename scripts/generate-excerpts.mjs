// Generate excerpts to the house rule (Ants, 2026-08-14):
//
//   An excerpt is ORIGINAL copy — exactly TWO sentences that catchily summarise
//   the WHOLE article. It is never sentences lifted or lightly reworded from the
//   post body, and it never ends mid-sentence.
//
// Two earlier design mistakes this replaces: the old prompt told the model to
// "lightly adapt the article's own opening" (the opposite of the rule), and it
// only ever saw the first 1800 characters — so it could not summarise the whole
// piece even in principle. Now the model sees the article's arc (head + tail on
// long posts) and is told to write fresh copy.
//
//   node scripts/audit-excerpts.mjs               # see what fails first
//   node scripts/generate-excerpts.mjs --dry-run  # preview, write nothing
//   node scripts/generate-excerpts.mjs            # write into frontmatter
//   node scripts/generate-excerpts.mjs --limit 10 # try a small batch
//   node scripts/generate-excerpts.mjs --all      # regenerate even passing posts
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Anthropic from "@anthropic-ai/sdk";
import { LANG_NAMES as LANG, plainBody, validateExcerpt } from "../lib/excerpt-rules.mjs";
// Prompt, retry strategy and the native-editor polish are shared with the
// admin's ✨ Genereeri button — see lib/excerpt-writer.mjs for why.
import { writeExcerpt as composeExcerpt } from "../lib/excerpt-writer.mjs";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const DRY = process.argv.includes("--dry-run");
const ALL = process.argv.includes("--all");
// --lang et  → work on one language only (Estonian needed its own passes).
const langArg = process.argv.indexOf("--lang");
const ONLY_LANG = langArg > -1 ? process.argv[langArg + 1] : null;
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;
const MODEL = process.env.EXCERPT_MODEL || "claude-sonnet-5";

const dir = "content/posts";
const client = new Anthropic();

// Generation is held to the tighter writing target, not the wider accept-band.
const validate = (ex, lang, body, title) => validateExcerpt(ex, lang, body, { strict: true, title });

function writeExcerpt(content, value) {
  value = value.replace(/\s+/g, " ").trim();
  const yaml = value.includes('"') ? `'${value.replace(/'/g, "''")}'` : `"${value}"`;
  // Replace a multi-line block-scalar excerpt (key + indented continuation
  // lines) as one unit, else the old continuation lines are orphaned.
  const blockRe = /^excerpt:\s*[>|][+-]?\s*\n(?:[ \t]+.*(?:\n|$))+/m;
  if (blockRe.test(content)) return content.replace(blockRe, () => `excerpt: ${yaml}\n`);
  const lineRe = /^excerpt:.*$(?:\n[ \t]+\S.*$)*/m;
  if (lineRe.test(content)) return content.replace(lineRe, () => `excerpt: ${yaml}`);
  return content.replace(/^(title:.*)$/m, (m) => `${m}\nexcerpt: ${yaml}`);
}

// ── collect targets ──────────────────────────────────────────────────────────
const targets = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".mdx")) continue;
  let g;
  try { g = matter(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
  const lang = String(g.data.lang || "").trim();
  if (!LANG[lang]) continue;
  if (ONLY_LANG && lang !== ONLY_LANG) continue;
  const title = String(g.data.title || "").trim();
  const old = String(g.data.excerpt || "").trim();
  const body = plainBody(g.content);
  if (!body) continue;
  const problem = old ? validate(old, lang, body, title) : "missing";
  if (!ALL && !problem) continue;
  targets.push({ f, lang, title, old, body, why: problem ?? "regenerate-all" });
}
targets.sort((a, b) => a.lang.localeCompare(b.lang) || a.f.localeCompare(b.f));
const work = targets.slice(0, LIMIT);
console.error(`Targets: ${work.length}${targets.length > work.length ? ` of ${targets.length}` : ""} — model ${MODEL} ${DRY ? "(DRY-RUN)" : "(WRITING)"}`);

let ok = 0, failed = 0;
const POOL = 6;
const results = [];

async function run(t) {
  try {
    const { excerpt: ex, problem } = await composeExcerpt({
      client, title: t.title, body: t.body, lang: t.lang, model: MODEL,
    });

    if (problem) {
      failed++;
      results.push({ ...t, newEx: ex, status: `FAIL (${problem})` });
      return;
    }
    if (!DRY) {
      const p = path.join(dir, t.f);
      fs.writeFileSync(p, writeExcerpt(fs.readFileSync(p, "utf8"), ex));
    }
    ok++;
    results.push({ ...t, newEx: ex, status: "OK" });
  } catch (e) {
    failed++;
    results.push({ ...t, newEx: "", status: `ERR ${e.message}` });
  }
}

for (let i = 0; i < work.length; i += POOL) {
  await Promise.all(work.slice(i, i + POOL).map(run));
  console.error(`  …${Math.min(i + POOL, work.length)}/${work.length}`);
}

results.sort((a, b) => a.lang.localeCompare(b.lang) || a.f.localeCompare(b.f));
for (const r of results) {
  console.log(`\n[${r.lang.toUpperCase()}] ${r.f}`);
  console.log(`  why: ${r.why}  → ${r.status}`);
  console.log(`  OLD: ${r.old || "(none)"}`);
  console.log(`  NEW: ${r.newEx}`);
}
console.error(`\nDone. OK=${ok} FAIL=${failed} ${DRY ? "(dry-run, nothing written)" : "(written)"}`);
