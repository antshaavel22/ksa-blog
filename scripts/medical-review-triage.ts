/**
 * medical-review-triage.ts — Auto-clear the medical-review queue.
 *
 * Master prompt rule: medicalReview: false for 99% of articles. Only true for
 * SPECIFIC dosages (e.g. "2 drops of 0.5% timolol twice daily"), SPECIFIC
 * complication percentages (e.g. "1.3% develop dry eye"), or SPECIFIC
 * contraindication lists.
 *
 * The queue of 222 posts was keyword-flagged — most don't need human review.
 * This script classifies each post via Claude Haiku:
 *   CLEAR    → set frontmatter medicalReview: false, write file
 *   ESCALATE → log to medical-review-escalated.md with quoted excerpt
 *
 * Usage:
 *   npx tsx scripts/medical-review-triage.ts               # dry-run
 *   npx tsx scripts/medical-review-triage.ts --apply       # write changes
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Anthropic from "@anthropic-ai/sdk";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const APPLY = process.argv.includes("--apply");
const POSTS_DIR = path.join(process.cwd(), "content/posts");
const QUEUE_FILE = path.join(process.cwd(), "medical-review-queue.txt");
const ESCALATED_FILE = path.join(process.cwd(), "medical-review-escalated.md");
const PROGRESS_FILE = path.join(process.cwd(), ".triage-progress.json");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You classify eye-clinic blog posts for whether they need medical-expert review before publishing.

ESCALATE only if the post contains ANY of:
- Specific drug dosages (e.g. "2 drops of 0.5% timolol twice daily", "50mg daily")
- Specific complication rates (e.g. "1.3% of patients develop dry eye")
- A list of contraindications (who must NOT have the procedure)
- Specific post-op medication schedules
- Specific diagnostic thresholds (e.g. "IOP > 21 mmHg")

CLEAR everything else, including:
- General education (what is myopia, how laser works)
- Lifestyle tips, nutrition, screen time advice
- Recovery timelines described generally ("about a week")
- Patient stories and testimonials
- Comparisons (glasses vs surgery) without specific figures
- General mentions of "possible side effects" without specific percentages
- Marketing copy about the clinic

Respond with XML only:
<verdict>CLEAR</verdict>
OR
<verdict>ESCALATE</verdict>
<reason>one sentence — what specific medical claim needs review</reason>
<excerpt>the exact quoted sentence containing the claim (max 200 chars)</excerpt>`;

async function classify(title: string, body: string): Promise<{
  verdict: "CLEAR" | "ESCALATE";
  reason?: string;
  excerpt?: string;
}> {
  const truncated = body.length > 8000 ? body.slice(0, 8000) + "\n...[truncated]" : body;
  const msg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `TITLE: ${title}\n\nBODY:\n${truncated}`,
      },
    ],
  });
  const text = (msg.content[0] as { text: string }).text;
  const verdict = /<verdict>\s*ESCALATE\s*<\/verdict>/i.test(text) ? "ESCALATE" : "CLEAR";
  if (verdict === "CLEAR") return { verdict };
  const reason = text.match(/<reason>([\s\S]*?)<\/reason>/i)?.[1]?.trim() ?? "";
  const excerpt = text.match(/<excerpt>([\s\S]*?)<\/excerpt>/i)?.[1]?.trim() ?? "";
  return { verdict, reason, excerpt };
}

function setMedicalReviewFalse(frontmatterText: string): string {
  if (/^medicalReview:\s*/m.test(frontmatterText)) {
    return frontmatterText.replace(/^medicalReview:\s*.*$/m, "medicalReview: false");
  }
  // Append
  return frontmatterText.trimEnd() + "\nmedicalReview: false\n";
}

async function main() {
  const queue = fs
    .readFileSync(QUEUE_FILE, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const progress: Record<string, "CLEAR" | "ESCALATE" | "MISSING" | "ERROR"> =
    fs.existsSync(PROGRESS_FILE) ? JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8")) : {};

  const escalated: Array<{ file: string; title: string; reason: string; excerpt: string }> = [];
  let cleared = 0;
  let escalatedCount = 0;
  let missing = 0;
  let errors = 0;
  let skipped = 0;

  console.log(`Queue: ${queue.length} files  |  apply=${APPLY}`);

  for (let i = 0; i < queue.length; i++) {
    const filename = queue[i];
    if (progress[filename] === "CLEAR") { cleared++; skipped++; continue; }
    if (progress[filename] === "ESCALATE") { escalatedCount++; skipped++; continue; }

    const fp = path.join(POSTS_DIR, filename);
    if (!fs.existsSync(fp)) {
      console.log(`[${i + 1}/${queue.length}] MISSING ${filename}`);
      progress[filename] = "MISSING";
      missing++;
      continue;
    }

    const raw = fs.readFileSync(fp, "utf-8");
    const parsed = matter(raw);
    const title = (parsed.data.title as string) || filename;

    // Already cleared? skip
    if (parsed.data.medicalReview === false) {
      progress[filename] = "CLEAR";
      cleared++;
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
      continue;
    }

    try {
      const result = await classify(title, parsed.content);
      if (result.verdict === "CLEAR") {
        if (APPLY) {
          const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n/);
          if (fmMatch) {
            const newFm = setMedicalReviewFalse(fmMatch[1]);
            const newRaw = `---\n${newFm}\n---\n` + raw.slice(fmMatch[0].length);
            fs.writeFileSync(fp, newRaw);
          }
        }
        cleared++;
        progress[filename] = "CLEAR";
        process.stdout.write(".");
      } else {
        escalated.push({ file: filename, title, reason: result.reason!, excerpt: result.excerpt! });
        escalatedCount++;
        progress[filename] = "ESCALATE";
        process.stdout.write("!");
      }
    } catch (err) {
      console.log(`\n[${i + 1}/${queue.length}] ERROR ${filename}: ${(err as Error).message}`);
      progress[filename] = "ERROR";
      errors++;
    }

    if ((i + 1) % 20 === 0) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
      console.log(`\n  Progress: ${i + 1}/${queue.length} | clear:${cleared} esc:${escalatedCount} miss:${missing} err:${errors}`);
    }
  }

  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

  // Write escalation list
  if (escalated.length > 0) {
    const md = [
      `# Medical Review — Escalated (${escalated.length} posts)`,
      "",
      "These posts contain specific medical claims (dosages, complication rates, contraindications) that warrant Dr. Haavel's review before final sign-off. All others were auto-cleared.",
      "",
      ...escalated.map((e, i) =>
        [
          `## ${i + 1}. ${e.title}`,
          `**File:** \`${e.file}\``,
          `**Why flagged:** ${e.reason}`,
          `**Excerpt:** _${e.excerpt}_`,
          "",
        ].join("\n"),
      ),
    ].join("\n");
    fs.writeFileSync(ESCALATED_FILE, md);
  }

  console.log("\n\n==========================================");
  console.log(`Cleared:    ${cleared}`);
  console.log(`Escalated:  ${escalatedCount}`);
  console.log(`Missing:    ${missing}`);
  console.log(`Errors:     ${errors}`);
  console.log(`Skipped:    ${skipped} (from previous run)`);
  console.log(`Applied:    ${APPLY ? "YES — frontmatter written" : "NO (dry-run)"}`);
  if (escalated.length > 0) console.log(`Escalated list: ${ESCALATED_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
