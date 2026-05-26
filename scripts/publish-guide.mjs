// Publish all guide chapters: drafts/et → posts, set reviewedBy
import fs from "fs";
import path from "path";

const DRAFTS = "content/drafts/et";
const POSTS = "content/posts";

const files = fs
  .readdirSync(DRAFTS)
  .filter((f) => f.match(/^2026-05-21-laserkirurgia-juhend-/) && f.endsWith(".mdx"))
  .sort();

console.log(`Publishing ${files.length} chapters...\n`);

for (const f of files) {
  const src = path.join(DRAFTS, f);
  const dst = path.join(POSTS, f);
  let content = fs.readFileSync(src, "utf-8");

  // Set reviewedBy
  if (content.includes('reviewedBy: ""')) {
    content = content.replace('reviewedBy: ""', 'reviewedBy: "Dr. Ants Haavel"');
  } else if (!content.match(/reviewedBy:/)) {
    // Insert before --- closing of frontmatter
    content = content.replace(/^---\n/m, '---\nreviewedBy: "Dr. Ants Haavel"\n').replace('---\nreviewedBy:', '\nreviewedBy:');
  }

  fs.writeFileSync(dst, content);
  fs.unlinkSync(src);
  console.log(`  ✓ ${f}`);
}

console.log(`\nDone. ${files.length} chapters moved to content/posts/.`);
