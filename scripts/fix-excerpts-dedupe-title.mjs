// One-off: detect excerpt that starts with (full or near-full) title text and strip it.
// Then ensure the remaining excerpt ends with sentence punctuation or `...`.
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const POSTS = 'content/posts';
const END_PUNCT = /[.!?…»"')]/;

function normalize(s) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function stripTitlePrefix(excerpt, title) {
  if (!excerpt || !title) return { stripped: excerpt, didStrip: false };
  const ex = excerpt.trim();
  const t = title.trim();
  // Try various prefix lengths of title
  const exNorm = normalize(ex);
  const tNorm = normalize(t);
  if (!exNorm.startsWith(tNorm)) return { stripped: excerpt, didStrip: false };
  // Find original cut point preserving original casing/spacing
  // Approach: take title-length chars and adjust forward to next word boundary
  let cut = t.length;
  // Skip the original title chars (may differ in whitespace) — walk char by char
  let i = 0; // pointer in ex
  let j = 0; // pointer in t
  while (i < ex.length && j < t.length) {
    const ce = ex[i].toLowerCase();
    const ct = t[j].toLowerCase();
    if (ce === ct) { i++; j++; }
    else if (/\s/.test(ce)) { i++; }
    else if (/\s/.test(ct)) { j++; }
    else { break; }
  }
  if (j < t.length) return { stripped: excerpt, didStrip: false };
  let rest = ex.slice(i).trim();
  // Strip leading punctuation
  rest = rest.replace(/^[\s.,:;–—-]+/, '');
  return { stripped: rest, didStrip: true };
}

function ensureEnding(s) {
  const trimmed = s.trim();
  if (!trimmed) return trimmed;
  if (END_PUNCT.test(trimmed.slice(-1))) return trimmed;
  if (trimmed.endsWith('...') || trimmed.endsWith('…')) return trimmed;
  // Try truncate to last sentence
  const matches = [...trimmed.matchAll(/[.!?…][\s»"')]*(?=\s|$)/g)];
  if (matches.length > 0) {
    const m = matches[matches.length - 1];
    const cut = m.index + m[0].length;
    const truncated = trimmed.slice(0, cut).trim();
    if (truncated.length >= trimmed.length * 0.4 && truncated.length >= 50) return truncated;
  }
  return trimmed.replace(/[\s,\-—–]+$/, '') + '...';
}

const files = fs.readdirSync(POSTS).filter(f => f.endsWith('.mdx'));
const changes = [];

for (const f of files) {
  const fp = path.join(POSTS, f);
  const raw = fs.readFileSync(fp, 'utf8');
  let parsed;
  try { parsed = matter(raw); } catch { continue; }
  const data = parsed.data;
  const title = data.title ? String(data.title) : '';
  let changed = false;

  for (const field of ['excerpt', 'seoExcerpt']) {
    if (!data[field]) continue;
    const orig = String(data[field]);
    const { stripped, didStrip } = stripTitlePrefix(orig, title);
    if (!didStrip) continue;
    if (!stripped) continue; // would empty
    const fixed = ensureEnding(stripped);
    if (fixed !== orig) {
      data[field] = fixed;
      changed = true;
      changes.push({ file: f, field, before: orig.slice(0, 80), after: fixed.slice(0, 80) });
    }
  }

  if (changed) fs.writeFileSync(fp, matter.stringify(parsed.content, data), 'utf8');
}

console.log(`Total fixed: ${changes.length}`);
console.log('\nSample (first 10):');
changes.slice(0, 10).forEach(c => {
  console.log(`\n  [${c.field}] ${c.file}`);
  console.log(`    BEFORE: ${c.before}...`);
  console.log(`    AFTER:  ${c.after}`);
});
