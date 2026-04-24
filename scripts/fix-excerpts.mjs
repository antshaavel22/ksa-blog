import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const POSTS = 'content/posts';
const END_PUNCT = /[.!?…»"')]/;

function fixExcerpt(ex) {
  const trimmed = ex.trim();
  if (!trimmed) return { fixed: trimmed, action: 'empty' };
  const last = trimmed.slice(-1);
  if (END_PUNCT.test(last)) return { fixed: trimmed, action: 'ok' };
  if (trimmed.endsWith('...') || trimmed.endsWith('…')) return { fixed: trimmed, action: 'ok' };

  // Try truncating to last full sentence
  // Find last occurrence of . ! ? followed by space or end, NOT preceded by initials
  const matches = [...trimmed.matchAll(/[.!?…][\s»"')]*(?=\s|$)/g)];
  if (matches.length > 0) {
    const last = matches[matches.length - 1];
    const cut = last.index + last[0].length;
    const truncated = trimmed.slice(0, cut).trim();
    // Only accept truncation if it keeps at least 40% of content and 50+ chars
    if (truncated.length >= trimmed.length * 0.4 && truncated.length >= 50) {
      return { fixed: truncated, action: 'truncated' };
    }
  }
  // Fallback: append ...
  // Remove any trailing partial word if it looks cut (ends with comma or partial)
  let base = trimmed;
  // Strip trailing whitespace, commas, hyphens
  base = base.replace(/[\s,\-—–]+$/, '');
  return { fixed: base + '...', action: 'ellipsis' };
}

const files = fs.readdirSync(POSTS).filter(f => f.endsWith('.mdx'));
const changes = [];
const stats = { ok: 0, truncated: 0, ellipsis: 0, empty: 0, seoChanged: 0 };

for (const f of files) {
  const fp = path.join(POSTS, f);
  const raw = fs.readFileSync(fp, 'utf8');
  let parsed;
  try { parsed = matter(raw); } catch { continue; }
  const data = parsed.data;
  let changed = false;

  // Fix excerpt
  if (data.excerpt) {
    const r = fixExcerpt(String(data.excerpt));
    stats[r.action]++;
    if (r.action === 'truncated' || r.action === 'ellipsis') {
      data.excerpt = r.fixed;
      changed = true;
      changes.push({ file: f, field: 'excerpt', action: r.action });
    }
  }
  // Fix seoExcerpt if same condition
  if (data.seoExcerpt) {
    const r = fixExcerpt(String(data.seoExcerpt));
    if (r.action === 'truncated' || r.action === 'ellipsis') {
      data.seoExcerpt = r.fixed;
      changed = true;
      stats.seoChanged++;
    }
  }

  if (changed) {
    const out = matter.stringify(parsed.content, data);
    fs.writeFileSync(fp, out, 'utf8');
  }
}

console.log('Stats:', stats);
console.log('Total fixed:', changes.length);
console.log('\nBy action:');
const byAction = {};
changes.forEach(c => byAction[c.action] = (byAction[c.action] || 0) + 1);
console.log(byAction);
console.log('\nSample (first 8):');
changes.slice(0, 8).forEach(c => console.log(`  [${c.action}] ${c.file}`));
