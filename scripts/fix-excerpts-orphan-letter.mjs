// One-off: clean up excerpts ending with "<single-letter>..." (mid-word cut).
// Example: "...affects nearly e..." → "...affects nearly..."
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const POSTS = 'content/posts';

// Pattern: " <1-2 letter word>..." or " <1-2 letter word>…" at end
const ORPHAN_RE = /\s+[A-Za-zА-Яа-яÕÄÖÜõäöü]{1,2}(?:\.{3}|…)$/;

function cleanOrphan(s) {
  if (!s) return s;
  const trimmed = s.trim();
  if (!ORPHAN_RE.test(trimmed)) return trimmed;
  return trimmed.replace(ORPHAN_RE, '...');
}

const files = fs.readdirSync(POSTS).filter(f => f.endsWith('.mdx'));
let fixed = 0;
const samples = [];

for (const f of files) {
  const fp = path.join(POSTS, f);
  const raw = fs.readFileSync(fp, 'utf8');
  let parsed;
  try { parsed = matter(raw); } catch { continue; }
  const data = parsed.data;
  let changed = false;
  for (const field of ['excerpt', 'seoExcerpt']) {
    if (!data[field]) continue;
    const orig = String(data[field]);
    const cleaned = cleanOrphan(orig);
    if (cleaned !== orig) {
      data[field] = cleaned;
      changed = true;
      if (samples.length < 10) samples.push({ file: f, field, before: orig.slice(-60), after: cleaned.slice(-60) });
    }
  }
  if (changed) {
    fs.writeFileSync(fp, matter.stringify(parsed.content, data), 'utf8');
    fixed++;
  }
}

console.log(`Files fixed: ${fixed}`);
samples.forEach(s => {
  console.log(`\n  [${s.field}] ${s.file}`);
  console.log(`    BEFORE: ...${s.before}`);
  console.log(`    AFTER:  ...${s.after}`);
});
