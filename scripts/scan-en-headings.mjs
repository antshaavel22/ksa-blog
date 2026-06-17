// High-recall scan: lang=en posts whose in-body headings are Estonian.
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const dir = "content/posts";
const BRAND = /\b(KSA|Silmakeskus\w*|Flow3?|Schwind|LASIK|SMILE|PRK|TransPRK|DLEK|ICL|RLE)\b/gi;
const ET_CHARS = /[õäöüÕÄÖÜšž]/;
// High-precision Estonian words that do NOT collide with English headings.
const ET_WORD = /\b(ja|või|asemel|kaks|kolm|kõik|kuidas|miks|ning|kuid|koos|ilma|silma|silmad|silmade|silmast|silmi|ravi|ravim|rakk|rakud|rakkude|nägemine|nägemist|prill|prillid|prillideta|lääts|läätsed|teekond|teekonda|edukus|esiosas|asendamine|parandamine|ravimine|paranemise|arhitektuur|tähendab|valida|vananeb|kandmine|tervise|haigus|lapse|laste|enne|pärast|vastu|jaoks|sobib|aitab|hoida|parim|protseduur)\b/i;

function isEtHeading(h) {
  const s = h.replace(BRAND, " ").replace(/[#*_:0-9.,!?()\-–—"']/g, " ").trim();
  if (!s) return false;
  if (ET_CHARS.test(s)) return true;
  if (ET_WORD.test(s)) return true;
  return false;
}

const flagged = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".mdx")) continue;
  let g; try { g = matter(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
  if (String(g.data.lang || "").trim() !== "en") continue;
  const hs = g.content.split("\n").filter(l => /^#{2,4}\s+\S/.test(l)).map(l => l.replace(/^#{2,4}\s+/, "").trim());
  const bad = hs.filter(isEtHeading);
  if (bad.length) flagged.push({ f, total: hs.length, bad });
}
flagged.sort((a, b) => b.bad.length - a.bad.length);
console.log(`lang=en posts with Estonian heading(s): ${flagged.length}`);
let totalBad = 0;
for (const p of flagged) { totalBad += p.bad.length; console.log(`\n${p.f}  (${p.bad.length}/${p.total})`); for (const h of p.bad) console.log(`   • ${h}`); }
console.log(`\nTotal Estonian headings: ${totalBad}`);
