/**
 * ping-search-engines.ts — nudge Google + Bing to re-crawl the sitemap.
 *
 * Google's public ping endpoint was officially deprecated in 2023 but still
 * responds 200 for many properties; Bing's IndexNow replaces the classic ping.
 * We hit both: the classic sitemap ping (cheap, harmless) and IndexNow for Bing.
 *
 * Usage:
 *   npx tsx scripts/ping-search-engines.ts
 *   npx tsx scripts/ping-search-engines.ts --urls url1,url2   # IndexNow specific URLs
 *
 * Env:
 *   INDEXNOW_KEY — 8-128 char hex token. Must also be served at
 *   https://blog.ksa.ee/<INDEXNOW_KEY>.txt (file body = the key itself).
 */
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const SITEMAP = "https://blog.ksa.ee/sitemap.xml";
const HOST = "blog.ksa.ee";
const KEY = process.env.INDEXNOW_KEY;

const args = process.argv.slice(2);
const urlsArg = args.indexOf("--urls") >= 0 ? args[args.indexOf("--urls") + 1] : null;

async function ping(url: string, label: string) {
  try {
    const res = await fetch(url, { method: "GET" });
    console.log(`[${label}] ${res.status} ${res.statusText}`);
  } catch (err) {
    console.log(`[${label}] FAIL: ${(err as Error).message}`);
  }
}

async function indexNow(urls: string[]) {
  if (!KEY) {
    console.log("[IndexNow] skipped — INDEXNOW_KEY not set in .env.local");
    return;
  }
  const body = {
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/indexnow`,
    urlList: urls,
  };
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    console.log(`[IndexNow] ${res.status} ${res.statusText} — ${urls.length} URLs`);
    if (!res.ok) console.log(await res.text());
  } catch (err) {
    console.log(`[IndexNow] FAIL: ${(err as Error).message}`);
  }
}

async function main() {
  // Classic sitemap pings (legacy but still honoured by some crawlers)
  await ping(
    `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`,
    "Google",
  );
  await ping(
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`,
    "Bing",
  );

  // IndexNow — preferred modern path for Bing + Yandex + Seznam
  const urls = urlsArg ? urlsArg.split(",").map((u) => u.trim()) : [SITEMAP];
  await indexNow(urls);

  console.log("Done.");
}

main();
