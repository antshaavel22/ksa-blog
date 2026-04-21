/**
 * rename-images-seo.ts
 *
 * Batch-renames all poorly-named uploaded images (image-moXXXXXX.webp)
 * to SEO-friendly names based on the post that references them:
 *   {post-slug-truncated}-ksa-silmakeskus-{timestamp}.webp
 *
 * Usage:
 *   npx tsx scripts/rename-images-seo.ts [--dry-run]
 *
 * With --dry-run: prints planned renames, touches nothing.
 * Without: renames on GitHub + patches MDX files locally.
 */

import * as fs from "fs";
import * as path from "path";

// Load .env.local manually (no dotenv dependency needed)
const envRaw = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf-8") : "";
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

const DRY_RUN = process.argv.includes("--dry-run");
const POSTS_DIR = path.join(process.cwd(), "content/posts");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_REPO = process.env.GITHUB_REPO!;
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/contents`;

// ── Helpers ─────────────────────────────────────────────────────────────────

function slugToKeyword(slug: string): string {
  // Take first 4 meaningful words from slug (strip common stop words)
  const stop = new Set(["kuidas", "mida", "miks", "mis", "kas", "kui", "see", "on", "ja", "ning", "the", "how", "why", "what", "is", "a", "an", "of", "in", "to", "for", "with", "and", "or"]);
  const words = slug.split("-").filter(w => w.length > 2 && !stop.has(w));
  return words.slice(0, 4).join("-").slice(0, 35);
}

async function githubGet(filePath: string) {
  const res = await fetch(`${GITHUB_API}/${filePath}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
    cache: "no-store" as RequestCache,
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ content: string; sha: string }>;
}

async function githubPut(filePath: string, content: string, message: string) {
  const res = await fetch(`${GITHUB_API}/${filePath}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: content.replace(/\n/g, "") }),
  });
  return res.ok;
}

async function githubDelete(filePath: string, sha: string, message: string) {
  const res = await fetch(`${GITHUB_API}/${filePath}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha }),
  });
  return res.ok;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 Scanning posts for poorly-named images${DRY_RUN ? " [DRY RUN]" : ""}...\n`);

  // 1. Find all MDX post files
  const postFiles = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith(".mdx"));

  // 2. Build map: imageName → { postFile, postSlug, fullContent, imagePath }
  type ImageEntry = { postFile: string; postSlug: string; imagePath: string; imageFile: string; ts: string };
  const imageMap = new Map<string, ImageEntry>();

  for (const postFile of postFiles) {
    const content = fs.readFileSync(path.join(POSTS_DIR, postFile), "utf-8");
    const postSlug = postFile.replace(/\.mdx$/, "");

    // Find all /uploads/YYYY/MM/image-moXXXX.webp references
    const matches = [...content.matchAll(/\/uploads\/\d{4}\/\d{2}\/(images?-[a-z0-9]+\.webp)/g)];
    for (const m of matches) {
      const imageFile = m[1]; // e.g. "image-mo88c8ko.webp"
      const imagePath = m[0].slice(1); // e.g. "uploads/2026/04/image-mo88c8ko.webp"
      const ts = imageFile.replace(/^images?-/, "").replace(/\.webp$/, ""); // e.g. "mo88c8ko"

      if (!imageMap.has(imageFile)) {
        imageMap.set(imageFile, { postFile, postSlug, imagePath, imageFile, ts });
      }
    }
  }

  console.log(`📦 Found ${imageMap.size} poorly-named images referenced in posts\n`);

  let renamed = 0;
  let skipped = 0;
  let errors = 0;

  for (const [imageFile, entry] of imageMap) {
    const { postFile, postSlug, imagePath, ts } = entry;
    const keyword = slugToKeyword(postSlug);
    const newImageFile = `${keyword}-ksa-silmakeskus-${ts}.webp`;
    const newImagePath = imagePath.replace(imageFile, newImageFile);
    const newUrl = "/" + newImagePath; // e.g. /uploads/2026/04/new-name.webp
    const oldUrl = "/" + imagePath;

    console.log(`📄 ${postFile}`);
    console.log(`   ${imageFile} → ${newImageFile}`);

    if (DRY_RUN) {
      console.log(`   [dry-run] would rename + patch MDX\n`);
      continue;
    }

    // 3. Rename on GitHub
    const githubPath = `public/${imagePath}`;
    const newGithubPath = `public/${newImagePath}`;

    const fileData = await githubGet(githubPath);
    if (!fileData) {
      console.log(`   ⚠️  Not found on GitHub (may already be renamed or local-only) — skipping\n`);
      skipped++;
      continue;
    }

    const putOk = await githubPut(newGithubPath, fileData.content, `seo-rename: ${imageFile} → ${newImageFile}`);
    if (!putOk) {
      console.log(`   ❌ Failed to write new file to GitHub\n`);
      errors++;
      continue;
    }

    await githubDelete(githubPath, fileData.sha, `seo-rename: remove old ${imageFile}`);

    // 4. Patch MDX file locally
    const mdxPath = path.join(POSTS_DIR, postFile);
    const original = fs.readFileSync(mdxPath, "utf-8");
    const patched = original.replaceAll(oldUrl, newUrl);
    if (patched !== original) {
      fs.writeFileSync(mdxPath, patched, "utf-8");
      console.log(`   ✅ Renamed + MDX patched\n`);
      renamed++;
    } else {
      console.log(`   ⚠️  URL not found in MDX content (frontmatter only?)\n`);
      skipped++;
    }

    // Rate-limit: avoid hammering GitHub API
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n✅ Done — renamed: ${renamed} | skipped: ${skipped} | errors: ${errors}`);
  if (renamed > 0 && !DRY_RUN) {
    console.log(`\n💾 MDX files patched locally. Run:\n   git add content/posts/ && git commit -m "seo: rename blog images to keyword+ksa-silmakeskus" && git push origin main`);
  }
}

main().catch(console.error);
