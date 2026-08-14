// Anti-fabrication check for medical copy.
//
// An excerpt may only use figures that appear in its own article. A generated
// standfirst that invents "86% of patients" would be far worse than a clumsy
// one, so every number in every excerpt is checked against the body.
//
// Spelled-out numerals are handled in all three languages, since a body may say
// "ten times" where the excerpt says "10x".
//
//   node scripts/check-excerpt-numbers.mjs
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { plainBody } from "../lib/excerpt-rules.mjs";

const dir = "content/posts";

const WORDS = {
  1: ["one", "üks", "один"], 2: ["two", "kaks", "два", "две"], 3: ["three", "kolm", "три"],
  4: ["four", "neli", "четыре"], 5: ["five", "viis", "пять"], 6: ["six", "kuus", "шесть"],
  7: ["seven", "seitse", "семь"], 8: ["eight", "kaheksa", "восемь"], 9: ["nine", "üheksa", "девять"],
  10: ["ten", "kümme", "kümmend", "десять", "десят"], 12: ["twelve", "kaksteist", "двенадцать"],
  15: ["fifteen", "viisteist", "пятнадцать"], 20: ["twenty", "kakskümmend", "двадцать"],
  24: ["twenty-four", "kakskümmend neli", "двадцать четыре"],
  30: ["thirty", "kolmkümmend", "тридцать"], 40: ["forty", "nelikümmend", "сорок"],
  50: ["fifty", "viiskümmend", "пятьдесят"], 100: ["hundred", "sada", "сто"],
};

// Years and other harmless context numbers we don't want to flag on.
const IGNORE = new Set(["2024", "2025", "2026"]);

let checked = 0;
const suspect = [];

for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".mdx")) continue;
  let g;
  try { g = matter(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
  const ex = String(g.data.excerpt ?? "").trim();
  if (!ex) continue;
  checked++;

  const body = plainBody(g.content).toLowerCase();
  const nums = [...new Set((ex.match(/\d+(?:[.,]\d+)?/g) || []))];
  const missing = nums.filter((n) => {
    if (IGNORE.has(n)) return false;
    if (body.includes(n)) return false;
    // "10x" in the excerpt vs "ten times" in the body, and similar.
    const word = WORDS[parseInt(n, 10)];
    if (word && word.some((w) => body.includes(w))) return false;
    return true;
  });
  if (missing.length) suspect.push({ f, lang: g.data.lang, missing, ex });
}

console.log(`Checked ${checked} excerpts with figures against their article bodies.\n`);
if (!suspect.length) {
  console.log("  No excerpt uses a figure absent from its own article.");
} else {
  console.log(`  ${suspect.length} excerpt(s) cite a figure not found in the body — review:\n`);
  for (const s of suspect) {
    console.log(`  [${s.lang}] ${s.f}`);
    console.log(`      not in body: ${s.missing.join(", ")}`);
    console.log(`      ${s.ex}\n`);
  }
}
