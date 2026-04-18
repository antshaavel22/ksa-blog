/**
 * clear-escalations-abc.ts — Clear clusters A+B+C from medical-review-escalated.md.
 *
 * Reads the escalated MD, for each post in CLEAR_NUMBERS set:
 *   - Decode URL-encoded filename
 *   - Set medicalReview: false in frontmatter
 * Then regenerates escalated MD with only cluster-D posts remaining.
 *
 * Cluster assignments (made manually by Claude, confirmed by Ants):
 *   A = KSA brand facts (55k/zero ectasia, 18-45/-9D, 1-week recovery, LASIK 4.5×)
 *   B = published study citations (myopia risks, NAION, Acanthamoeba, glaucoma foods)
 *   C = general post-op drops/timelines/activity restrictions
 *   D = genuinely needs Dr. Haavel review (old WP claims: iridology, baking soda,
 *       dosages, argon laser, specific meds, vaccine claims, etc.)
 */
import fs from "fs";
import path from "path";

const POSTS_DIR = path.join(process.cwd(), "content/posts");
const ESCALATED_FILE = path.join(process.cwd(), "medical-review-escalated.md");

// Post numbers to CLEAR (set medicalReview: false). Everything else stays escalated.
const CLEAR = new Set<number>([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 25, 26, 28,
  40, 41, 43, 44, 45, 46, 47, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58,
  65, 67, 68, 69, 70, 71, 73, 74, 75, 76, 77, 78, 79, 82, 83, 84, 85,
  86, 87, 89, 91, 93, 94, 95, 96, 97, 98, 99,
]);

function parseEscalated(md: string) {
  // Split on "## N. " headers
  const blocks = md.split(/^## (\d+)\. /m).slice(1);
  const entries: Array<{ num: number; title: string; file: string; reason: string; excerpt: string; raw: string }> = [];
  for (let i = 0; i < blocks.length; i += 2) {
    const num = parseInt(blocks[i], 10);
    const body = blocks[i + 1];
    const titleLine = body.split("\n")[0];
    const fileMatch = body.match(/\*\*File:\*\* `([^`]+)`/);
    const reasonMatch = body.match(/\*\*Why flagged:\*\* (.*)/);
    const excerptMatch = body.match(/\*\*Excerpt:\*\* _(.*)_/);
    if (!fileMatch) continue;
    entries.push({
      num,
      title: titleLine.trim(),
      file: fileMatch[1],
      reason: reasonMatch?.[1] ?? "",
      excerpt: excerptMatch?.[1] ?? "",
      raw: `## ${num}. ${body}`.trimEnd(),
    });
  }
  return entries;
}

function setMedicalReviewFalse(fp: string): boolean {
  if (!fs.existsSync(fp)) {
    console.warn(`  ⚠ missing: ${path.basename(fp)}`);
    return false;
  }
  const raw = fs.readFileSync(fp, "utf-8");
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fmMatch) {
    console.warn(`  ⚠ no frontmatter: ${path.basename(fp)}`);
    return false;
  }
  let fm = fmMatch[1];
  if (/^medicalReview:\s*/m.test(fm)) {
    fm = fm.replace(/^medicalReview:\s*.*$/m, "medicalReview: false");
  } else {
    fm = fm.trimEnd() + "\nmedicalReview: false";
  }
  const newRaw = `---\n${fm}\n---\n` + raw.slice(fmMatch[0].length);
  fs.writeFileSync(fp, newRaw);
  return true;
}

function main() {
  const md = fs.readFileSync(ESCALATED_FILE, "utf-8");
  const entries = parseEscalated(md);
  console.log(`Parsed ${entries.length} escalations.`);

  let cleared = 0;
  let missing = 0;
  const remaining: typeof entries = [];

  for (const e of entries) {
    if (CLEAR.has(e.num)) {
      const fp = path.join(POSTS_DIR, e.file);
      if (setMedicalReviewFalse(fp)) cleared++;
      else missing++;
    } else {
      remaining.push(e);
    }
  }

  // Rewrite escalated MD with only remaining (cluster D)
  const newMd = [
    `# Medical Review — Escalated (${remaining.length} posts)`,
    "",
    "These posts contain specific medical claims (dosages, drug names, specific procedures, or unverified old-WP lifestyle claims) that warrant Dr. Haavel's review before final sign-off.",
    "",
    "Clusters A (KSA brand facts), B (published study citations), and C (general post-op timelines) were bulk-cleared — these remaining posts are cluster D.",
    "",
    ...remaining.map((e, i) => {
      const lines = e.raw.split("\n");
      lines[0] = `## ${i + 1}. ${e.title}`;
      return lines.join("\n");
    }),
  ].join("\n");

  fs.writeFileSync(ESCALATED_FILE, newMd);

  console.log(`\nCleared:    ${cleared}`);
  console.log(`Missing:    ${missing}`);
  console.log(`Remaining:  ${remaining.length} (cluster D)`);
  console.log(`Rewrote:    ${ESCALATED_FILE}`);
}

main();
