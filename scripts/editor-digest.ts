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

async function slackDm(userId: string, text: string): Promise<boolean> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return false; // caller falls back to the channel webhook
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel: userId, text, unfurl_links: false, unfurl_media: false }),
  });
  const d = (await r.json()) as { ok: boolean; error?: string };
  if (!d.ok) { console.error(`  Slack error for ${userId}: ${d.error}`); return false; }
  console.log(`  DM sent → ${userId}`);
  return true;
}

/**
 * Editors who are not in Slack (Mia) get the same list by email.
 * Brevo because KSA already sends through it — no new provider to manage.
 */
async function sendEmail(to: string, name: string, subject: string, body: string): Promise<boolean> {
  const key = process.env.BREVO_API_KEY;
  if (!key) { console.log(`  (no BREVO_API_KEY — ${name} not emailed)`); return false; }
  const html = body
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
    .replace(/<(https?:\/\/[^|]+)\|([^>]+)>/g, '<a href="$1">$2</a>')
    .replace(/\n/g, "<br>");
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": key, accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "KSA Blogi", email: process.env.DIGEST_FROM_EMAIL || "info@ksa.ee" },
      to: [{ email: to, name }],
      subject,
      htmlContent: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">${html}</div>`,
    }),
  });
  if (!r.ok) { console.error(`  email to ${to} failed: ${r.status} ${(await r.text()).slice(0, 120)}`); return false; }
  console.log(`  email sent → ${to}`);
  return true;
}

/**
 * Fallback when SLACK_BOT_TOKEN is not configured: an incoming webhook can only
 * post to its own channel, never a DM. So instead of per-editor DMs we post one
 * combined message everyone can read. Less personal, but it ships.
 */
async function slackWebhook(text: string): Promise<boolean> {
  const url = process.env.SLACK_RADAR_WEBHOOK;
  if (!url) { console.log("(no SLACK_BOT_TOKEN and no SLACK_RADAR_WEBHOOK — nothing sent)"); return false; }
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  console.log(r.ok ? "  posted to channel via webhook" : `  webhook failed: ${r.status}`);
  return r.ok;
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

  const combined: string[] = [];
  const note = dbOk ? "" : "\n\n_(Linnukeste seis pole hetkel saadaval — nimekiri sisaldab kõiki selle nädala postitusi.)_";

  for (const ed of EDITORS) {
    const mine = listFor(ed.code, posts, ticks);

    // Not in Slack (Mia) → same list by email. Ants asked for this on
    // 2026-09-07: "send in the future over email, so it is easier".
    if (!ed.slackId) {
      if (!ed.email) continue;
      const body =
        `Tere, ${ed.name}!\n\n` +
        `Viimase 7 päeva postitused, mis ootavad sinu keelekontrolli.\n\n` +
        block(ed.name, mine) +
        `\n\nMärgi loetuks: <${BLOG}/admin|blog.ksa.ee/admin → ✓ Lugemine>` + note;
      console.log(`\n──── ${ed.name} (${mine.length} unread, email) ────\n${body}`);
      if (!DRY) await sendEmail(ed.email, ed.name, `Nädala lugemine — ${mine.length} postitust ootab`, body);
      continue;
    }
    let text =
      `:eyes: *Nädala lugemine — blogi*\n` +
      `Viimase 7 päeva postitused, mis ootavad sinu keelekontrolli.\n\n` +
      block(ed.name, mine) +
      `\n\nMärgi loetuks: <${BLOG}/admin|admin → ✓ Lugemine>`;

    text += note;

    console.log(`\n──── ${ed.name} (${mine.length} unread) ────\n${text}`);
    if (!DRY) {
      const sent = await slackDm(ed.slackId, text);
      if (!sent) combined.push(text);
    }
  }

  // No bot token → one combined channel post instead of individual DMs.
  if (!DRY && combined.length) {
    await slackWebhook(
      `:eyes: *Nädala lugemine — blogi*\n` +
      `_(DM-e ei saa saata — SLACK_BOT_TOKEN puudub, seega kõik ühes sõnumis.)_\n\n` +
      combined.join("\n\n———\n\n"),
    );
  }
  if (DRY) console.log("\n(dry run — nothing sent)");
}

main().catch((e) => { console.error(e); process.exit(1); });
