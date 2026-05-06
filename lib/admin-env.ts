export function requireGitHubConfig() {
  const token = process.env.GITHUB_TOKEN?.trim();
  const repo = process.env.GITHUB_REPO?.trim();
  const branch = process.env.GITHUB_BRANCH?.trim() || "main";

  if (!token || !repo) {
    throw new Error("GitHub connection is not configured. Check GITHUB_TOKEN and GITHUB_REPO in Vercel.");
  }

  return { token, repo, branch };
}
