// Find posts whose `lang` field disagrees with the actual body language.
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const dir = "content/posts";
const EN_FW = /\b(the|and|is|of|to|for|with|your|you|this|that|are|how|why|what|can|will|from|when|which|their|has|have|was|were|but|not|or)\b/gi;
const ET_FW = /\b(ja|on|ei|et|kui|võib|kõik|ning|või|kuid|sest|olla|nende|seda|selle|need|mida|pärast|olete|peate|silmade|nägemine|kuidas|miks|sõnul)\b/gi;
function bodyLang(b) {
  const cyr = (b.match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (b.match(/[A-Za-zõäöü]/g) || []).length;
  if (cyr + lat < 30) return "?";
  if (cyr / (cyr + lat) > 0.5) return "ru";
  const en = (b.match(EN_FW) || []).length, et = (b.match(ET_FW) || []).length;
  if (en + et < 6) return "?";
  return en / (en + et) > 0.6 ? "en" : et / (en + et) > 0.6 ? "et" : "?";
}

const bad = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".mdx")) continue;
  let g; try { g = matter(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
  const lang = String(g.data.lang || "").trim();
  const bl = bodyLang(g.content);
  if (bl !== "?" && lang !== bl) bad.push({ f, lang, bodyLang: bl, title: String(g.data.title || "").slice(0, 55) });
}
bad.sort((a, b) => (a.lang + a.bodyLang).localeCompare(b.lang + b.bodyLang));
const by = bad.reduce((a, p) => { const k = `lang=${p.lang}→body=${p.bodyLang}`; a[k] = (a[k] || 0) + 1; return a; }, {});
console.log(`Mismatched posts: ${bad.length}`);
console.log(`Breakdown: ${JSON.stringify(by, null, 0)}`);
for (const p of bad) console.log(`\n  lang=${p.lang} body=${p.bodyLang}  ${p.f}\n     ${p.title}`);
