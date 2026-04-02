/**
 * generate-redirects.ts
 * Reads all MDX files from content/posts/, extracts slugs from frontmatter,
 * and writes redirects-for-kadri.txt with two sections:
 *   1. Plain-text Nginx/Apache style list
 *   2. Yoast CSV format for WordPress import
 *
 * Usage: npx tsx scripts/generate-redirects.ts
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";

const POSTS_DIR = path.join(process.cwd(), "content/posts");
const OUTPUT_FILE = path.join(process.cwd(), "redirects-for-kadri.txt");
const OLD_BASE = "/blogi";
const NEW_BASE = "https://blog.ksa.ee";

function main() {
  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .sort();

  const slugs: string[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
    const { data } = matter(raw);
    if (data.slug && typeof data.slug === "string") {
      slugs.push(data.slug.trim());
    }
  }

  slugs.sort();

  // ── Section 1: Plain text / Nginx / Apache style ──────────────────────────
  const section1Lines = [
    "# WordPress → blog.ksa.ee Redirects",
    "# Generated: " + new Date().toISOString().split("T")[0],
    "# Total: " + slugs.length + " redirects",
    "#",
    "# Nginx format (add inside server {} block):",
    "# rewrite ^/blogi/([^/]+)$ https://blog.ksa.ee/$1 permanent;",
    "#",
    "# Apache .htaccess format:",
    "# RedirectMatch 301 ^/blogi/(.*)$ https://blog.ksa.ee/$1",
    "#",
    "# Plain list (old path → new URL):",
    "",
    ...slugs.map((slug) => `${OLD_BASE}/${slug} ${NEW_BASE}/${slug} 301`),
  ];

  // ── Section 2: Yoast Redirect Manager CSV ─────────────────────────────────
  const section2Lines = [
    "",
    "# ──────────────────────────────────────────────────────────────────────",
    "# Yoast SEO Premium → Redirects → Import CSV",
    "# Copy everything from the header line below into a .csv file",
    "# ──────────────────────────────────────────────────────────────────────",
    "",
    "old_url,new_url,status_code",
    ...slugs.map((slug) => `/blogi/${slug},${NEW_BASE}/${slug},301`),
  ];

  const output = [...section1Lines, ...section2Lines].join("\n") + "\n";
  fs.writeFileSync(OUTPUT_FILE, output, "utf8");

  console.log(
    `✓ Written ${slugs.length} redirects to redirects-for-kadri.txt`
  );
}

main();
