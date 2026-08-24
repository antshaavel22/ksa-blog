/**
 * Credibility triage for content/posts/*.mdx — REPORT ONLY, deletes nothing.
 *
 * Purpose: surface old posts that no longer belong on a clinic blog carrying a
 * doctor's name, so Dr Haavel can rule on them. Every rule is a SIGNAL, not a
 * verdict — the medical and reputational call is his.
 *
 * Two hard rules baked in:
 *   1. Patient / hero stories are PROTECTED and can never enter a flag group,
 *      however they trip the keyword rules. They are the archive's best asset.
 *   2. Output shows the actual matched sentence, not a regex, so a decision
 *      takes seconds per post instead of opening the file.
 *
 * Usage: node scripts/credibility-triage.mjs [--json out.json]
 */
import fs from "node:fs";
import path from "node:path";

const DIR = "content/posts";

/* ── signals ─────────────────────────────────────────────────────────── */

// Named people/《topics》whose endorsement is a reputational problem for a clinic.
const DISCREDITED = [
  ["Mercola", /\bmercola\b/i],
  ["Paul Thomas (vaccine-sceptic paediatrician)", /paul thomas/i],
  ["anti-vaccine framing", /vaktsiin\w*\s+(oht|kahju|kahtlu)|vaccine\s+(danger|harm|injur)|вакцин\w*\s+(опасн|вред)/i],
  ["chemtrails", /chemtrail/i],
  ["\"big pharma hides\"", /(big pharma|farmaatsiatööstus|фарм\w+ индустри)\w*.{0,40}(varja|peida|hide|скрыва)/i],
];

// Claims a refractive clinic must not appear to endorse.
const PSEUDO = [
  ["Bates method", /bates.?(meetod|method)/i],
  ["eye exercises restore vision", /(silmaharjutus|eye exercis|упражнени\w+ для глаз)\w*.{0,80}(taasta|paranda|восстанов|cure|restore|improve)/i],
  ["vision restored without surgery", /(taasta|paranda)\w*.{0,40}nägemi\w*.{0,40}ilma operatsioonita|(cure|reverse)\w*.{0,25}(myopia|nearsightedness)|восстанов\w+.{0,25}зрение.{0,25}без операции/i],
  ["detox", /\bdetoks|\bdetox\b|\bдетокс/i],
  ["miracle cure", /imerohi|ime-?ravim|miracle (cure|drug)|чудо-?средств/i],
  ["cures disease claim", /(ravi[bv]|lechit|cures?)\s+(kuni\s+)?\d+\s*%|лечат\s+\w+:\s*\d+%/i],
];

// Clickbait framing — "what doctors won't tell you", "the big secret".
const CLICKBAIT = [
  ["\"what doctors won't tell you\"", /(ei räägi|won'?t tell|не расскаж)\w*.{0,30}(sulle|you|вам)|mida (arstid|silmaarstid) sulle ei/i],
  ["\"the big secret\"", /suur saladus|salaparane|the (big|hidden) secret|большой секрет|тайна которую/i],
  ["stat-shock headline", /^\d{1,3}\s*%|(miks|why|почему)\s+\d{1,3}\s*%/i],
];

// General wellness with no eye-care connection.
const OFF_TOPIC = [
  ["keto / fasting", /\bketo\b|intermittent fasting|\bпаст|\bголодани/i],
  ["longevity lifestyle", /longevity|долголети/i],
  ["weight loss", /kaalulangetus|weight loss|похудени/i],
  ["probiotics / allergy", /probiootik|probiotic|пробиотик/i],
  ["supplement-led health claim", /magneesiumipuudus|magnesium deficiency|дефицит магния/i],
];

// Outdated product or expired campaign.
const OUTDATED = [
  ["Flow 2.0 (superseded)", /flow\s?2\.0/i],
  ["expired campaign", /black friday|jõulukampaania|(202[0-3])\.?\s*aasta\s*kampaania/i],
];

// Patient / hero stories — PROTECTED.
const STORY = [
  /kogemuslugu|patsiendilugu|minu lugu|success story|patient story|истори\w+ пациента|мой опыт/i,
  /\b(story|lugu|история)\b/i,
];

/* ── parsing ─────────────────────────────────────────────────────────── */

function parse(file) {
  const raw = fs.readFileSync(file, "utf-8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const fm = m[1];
  const body = m[2];

  const scalar = (k) => {
    // plain or quoted:  key: "value"
    const plain = fm.match(new RegExp(`^${k}:[ \\t]*"?([^"\\n>|].*?)"?[ \\t]*$`, "m"));
    if (plain) return plain[1].trim().replace(/^['"]|['"]$/g, "");
    // folded/literal block:  key: >-\n   line\n   line
    const block = fm.match(new RegExp(`^${k}:[ \\t]*[>|]-?[ \\t]*\\n((?:[ \\t]+.*\\n?)+)`, "m"));
    if (block) return block[1].split("\n").map((l) => l.trim()).filter(Boolean).join(" ");
    return "";
  };

  return {
    file,
    slug: scalar("slug") || path.basename(file, ".mdx"),
    title: scalar("title"),
    excerpt: scalar("excerpt"),
    date: (scalar("date") || "").replace(/['"]/g, ""),
    lang: scalar("lang") || "et",
    medicalReview: /^medicalReview:\s*true/m.test(fm),
    categories: (fm.match(/^categories:\n((?:\s+- .*\n)+)/m) || [, ""])[1],
    body,
  };
}

/**
 * A post that says "blue light glasses aren't a miracle cure" is DEBUNKING the
 * claim — that is exactly the content a clinic should keep. Without this check
 * the keyword rules flag good science writing alongside the real problems.
 */
const NEGATION = /\b(not|aren'?t|isn'?t|no)\b[^.]{0,40}$|\bmyth|\bdebunk|\bfringe\b|pseudoscience|\bei ole\b[^.]{0,30}$|\bei ravi|\bmüüt|\bväärarusaam|\bне явля|\bне сто|\bмиф\b/i;

function isNegated(text, start, end) {
  const before = text.slice(Math.max(0, start - 90), start);
  const after = text.slice(end, end + 90);
  return NEGATION.test(before) || NEGATION.test(after);
}

function evidence(rules, text) {
  const found = [];
  for (const [label, re] of rules) {
    const m = text.match(re);
    if (!m) continue;
    const i = Math.max(0, m.index - 60);
    const snippet = text.slice(i, m.index + m[0].length + 60).replace(/\s+/g, " ").trim();
    found.push({ label, snippet, negated: isNegated(text, m.index, m.index + m[0].length) });
  }
  return found;
}

/* ── run ─────────────────────────────────────────────────────────────── */

const posts = fs.readdirSync(DIR).filter((f) => f.endsWith(".mdx"))
  .map((f) => parse(path.join(DIR, f))).filter(Boolean);

const GROUPS = [
  ["discredited_source", "Discredited source / reputationally risky framing", DISCREDITED],
  ["pseudoscience", "Claim a refractive clinic should not appear to endorse", PSEUDO],
  ["clickbait", "Clickbait framing that undercuts clinical authority", CLICKBAIT],
  ["off_topic", "General wellness, no eye-care connection", OFF_TOPIC],
  ["outdated", "Outdated product or expired campaign", OUTDATED],
];

const flagged = new Map();
let protectedCount = 0;

for (const p of posts) {
  const titleish = `${p.title} ${p.slug} ${p.categories}`;
  const isStory = STORY.some((re) => re.test(titleish));
  if (isStory) { protectedCount++; continue; }          // rule 1: never flag a story

  const haystack = `${p.title}\n${p.excerpt}\n${p.body}`;
  for (const [key, , rules] of GROUPS) {
    const ev = evidence(rules, haystack);
    if (!ev.length) continue;
    // If every hit in this group is the post debunking the claim, it is not a
    // credibility problem — it is the clinic doing its job.
    if (ev.every((e) => e.negated)) continue;
    if (!flagged.has(p.slug)) flagged.set(p.slug, { ...p, reasons: [] });
    flagged.get(p.slug).reasons.push({ group: key, ev });
  }
}

const list = [...flagged.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

console.log(`${posts.length} posts scanned`);
console.log(`patient/hero stories PROTECTED (never flagged): ${protectedCount}`);
console.log(`medicalReview: true on ${posts.filter((p) => p.medicalReview).length}/${posts.length}`);
console.log(`\nflagged for your review: ${list.length}\n`);

const byYear = {};
for (const p of list) { const y = (p.date || "?").slice(0, 4); byYear[y] = (byYear[y] || 0) + 1; }
console.log("by year:", JSON.stringify(byYear));

for (const [key, label] of GROUPS.map(([k, l]) => [k, l])) {
  const inGroup = list.filter((p) => p.reasons.some((r) => r.group === key));
  if (!inGroup.length) continue;
  console.log(`\n\n===== ${label} — ${inGroup.length} post(s) =====`);
  for (const p of inGroup) {
    console.log(`\n  [${p.lang}] ${p.date}  ${p.title || "(no title)"}`);
    console.log(`  /${p.slug}`);
    for (const r of p.reasons.filter((r) => r.group === key)) {
      for (const e of r.ev.filter((x) => !x.negated)) console.log(`     • ${e.label}: …${e.snippet}…`);
    }
  }
}

const j = process.argv.indexOf("--json");
if (j !== -1) {
  fs.writeFileSync(process.argv[j + 1] || "credibility-triage.json",
    JSON.stringify({ scanned: posts.length, protected: protectedCount, candidates: list.map((p) => ({
      slug: p.slug, title: p.title, date: p.date, lang: p.lang, file: p.file,
      groups: [...new Set(p.reasons.map((r) => r.group))],
      evidence: p.reasons.flatMap((r) => r.ev),
    })) }, null, 2));
}
console.log(`\n\nNothing deleted — this is a report. ${list.length} of ${posts.length} flagged.`);
