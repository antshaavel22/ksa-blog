/**
 * Friday editor digest → Slack.
 *
 * Lists posts published in the last 7 days and DMs each editor the ones they
 * are responsible for proof-reading, marking which they have already ticked in
 * the admin's Lugemine tab.
 *
 *   ET → Mia, Silvia, Ants      RU → Jana      EN → Ants
 *
 * Mia Haavel is not in the Slack workspace, so her list is appended to Ants's
 * DM for him to pass on (WhatsApp). She is NOT Mai Hollo — do not route to her.
 *
 *   npx tsx scripts/editor-digest.ts --dry-run   # print, send nothing
 *   npx tsx scripts/editor-digest.ts --force     # ignore the 10:00 local gate
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { EDITORS, editorsForLang, type EditorCode } from "../lib/editors";

const DRY = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const BLOG = "https://blog.ksa.ee";

// GitHub Actions cron is UTC only, and Estonia shifts between EET and EEST, so
// the workflow fires at BOTH 07:00 and 08:00 UTC and we keep only the run that
// is actually 10:00 in Tallinn. Year-round 10:00 without two workflows.
function isTenAmInTallinn(): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Tallinn", hour: "2-digit", hour12: false,
    }).format(new Date()),
  );
  return hour === 10;
}

interface Post { slug: string; title: string; lang: string; date: string }

function recentPosts(days = 7): Post[] {
  const dir = "content/posts";
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const out: Post[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".mdx")) continue;
    let g;
    try { g = matter(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
    const date = String(g.data.date ?? "");
    if (date < cutoff || date > today) continue; // skip future-dated/scheduled
    out.push({
      slug: String(g.data.slug || f.replace(/\.mdx$/, "")),
      title: String(g.data.title ?? "").trim(),
      lang: String(g.data.lang ?? "et").trim().toLowerCase(),
      date,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Ticks already recorded, keyed slug → Set(editor). Empty if DB not configured. */
async function fetchTicks(): Promise<{ map: Record<string, Set<string>>; ok: boolean }> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { map: {}, ok: false };
  try {
    const r = await fetch(`${url}/rest/v1/post_reviews?select=slug,editor`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return { map: {}, ok: false };
    const rows = (await r.json()) as Array<{ slug: string; editor: string }>;
    const map: Record<string, Set<string>> = {};
    for (const row of rows) (map[row.slug] ??= new Set()).add(row.editor);
    return { map, ok: true };
  } catch { return { map: {}, ok: false }; }
}

function listFor(code: EditorCode, posts: Post[], ticks: Record<string, Set<string>>) {
  return posts.filter(
    (p) => editorsForLang(p.lang).some((e) => e.code === code) && !ticks[p.slug]?.has(code),
  );
}

function block(name: string, items: Post[]): string {
  if (!items.length) return `*${name}* — kõik loetud ✅`;
  const lines = items.map((p) => `• <${BLOG}/${p.slug}|${p.title || p.slug}>  _(${p.lang.toUpperCase()}, ${p.date})_`);
  return `*${name}* — ${items.length} lugemata:\n${lines.join("\n")}`;
}

async function slackDm(userId: string, text: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) { console.log("(no SLACK_BOT_TOKEN — not sending)"); return; }
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel: userId, text, unfurl_links: false, unfurl_media: false }),
  });
  const d = (await r.json()) as { ok: boolean; error?: string };
  if (!d.ok) console.error(`  Slack error for ${userId}: ${d.error}`);
  else console.log(`  sent → ${userId}`);
}

async function main() {
  if (!FORCE && !DRY && !isTenAmInTallinn()) {
    console.log("Not 10:00 in Tallinn — skipping (the other cron slot will run).");
    return;
  }
  const posts = recentPosts(7);
  const { map: ticks, ok: dbOk } = await fetchTicks();
  console.log(`${posts.length} posts published in the last 7 days; ticks ${dbOk ? "loaded" : "UNAVAILABLE"}`);

  if (!posts.length) { console.log("Nothing published — no digest sent."); return; }

  const note = dbOk ? "" : "\n\n_(Linnukeste seis pole hetkel saadaval — nimekiri sisaldab kõiki selle nädala postitusi.)_";

  for (const ed of EDITORS) {
    const mine = listFor(ed.code, posts, ticks);
    if (!ed.slackId) continue; // Mia — folded into Ants's message below
    let text =
      `:eyes: *Nädala lugemine — blogi*\n` +
      `Viimase 7 päeva postitused, mis ootavad sinu keelekontrolli.\n\n` +
      block(ed.name, mine) +
      `\n\nMärgi loetuks: <${BLOG}/admin|admin → ✓ Lugemine>`;

    if (ed.code === "A") {
      const mia = listFor("M", posts, ticks);
      text += `\n\n---\n:information_source: *Mia nimekiri* (pole Slackis — palun edasta):\n${block("Mia", mia)}`;
    }
    text += note;

    console.log(`\n──── ${ed.name} (${mine.length} unread) ────\n${text}`);
    if (!DRY) await slackDm(ed.slackId, text);
  }
  if (DRY) console.log("\n(dry run — nothing sent)");
}

main().catch((e) => { console.error(e); process.exit(1); });
