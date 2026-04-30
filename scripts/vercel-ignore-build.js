const { execFileSync } = require("child_process");

function changedFiles() {
  try {
    const out = execFileSync("git", ["diff", "--name-only", "HEAD^", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

const ignoredOnlyPrefixes = [
  "content/drafts/",
  "public/uploads/",
  ".ai-editor-progress-",
  ".facelift-progress-",
  ".format-progress.json",
  ".triage-progress.json",
  ".radar-seen.json",
];

const ignoredOnlyDirs = [
  ".facelift-diffs/",
];

function canSkip(file) {
  return (
    ignoredOnlyPrefixes.some((prefix) => file.startsWith(prefix)) ||
    ignoredOnlyDirs.some((prefix) => file.startsWith(prefix))
  );
}

const files = changedFiles();

if (files.length > 0 && files.every(canSkip)) {
  console.log(`Skipping Vercel build: only editor draft/upload bookkeeping changed (${files.length} file${files.length === 1 ? "" : "s"}).`);
  process.exit(0);
}

console.log("Running Vercel build: public site code or published content changed.");
process.exit(1);
