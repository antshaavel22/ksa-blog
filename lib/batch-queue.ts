/**
 * Client-side batch-edit queue for published posts.
 *
 * When an editor clicks "Salvesta" on a published post, we stage the change
 * locally instead of writing to GitHub immediately. This lets them edit many
 * posts in succession and flush everything as a single commit (= one Vercel
 * build) via `Uuenda kõik`.
 *
 * Drafts still save immediately — they don't trigger live rebuilds.
 *
 * Storage: localStorage (survives tab reload, scoped to browser).
 */

export type QueuedEdit = {
  path: string;       // e.g. "content/posts/foo.mdx"
  content: string;    // full MDX with frontmatter
  title: string;      // for banner display
  stagedAt: number;   // Date.now()
};

const KEY = "ksa-blog-pending-batch";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getQueue(): QueuedEdit[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedEdit[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setQueue(q: QueuedEdit[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
    // Notify other components in this tab
    window.dispatchEvent(new CustomEvent("ksa-batch-queue-change", { detail: q.length }));
  } catch {
    // Quota exceeded or private mode — ignore
  }
}

export function enqueue(edit: Omit<QueuedEdit, "stagedAt">): void {
  const q = getQueue();
  const idx = q.findIndex((e) => e.path === edit.path);
  const next: QueuedEdit = { ...edit, stagedAt: Date.now() };
  if (idx >= 0) q[idx] = next;
  else q.push(next);
  setQueue(q);
}

export function removeFromQueue(path: string): void {
  setQueue(getQueue().filter((e) => e.path !== path));
}

export function clearQueue(): void {
  setQueue([]);
}

export function queueCount(): number {
  return getQueue().length;
}
