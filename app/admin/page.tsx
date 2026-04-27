"use client";

import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { getCategoryLabel, toSlug } from "@/lib/categories";
import SmartCTA from "@/components/SmartCTA";
import type { CtaEntry, CtaLang, CtaLangOverrides } from "@/lib/cta-config";
import type { Funnel } from "@/lib/posts";
import { AUTHORS } from "@/lib/authors";
import { enqueue, getQueue, clearQueue, removeFromQueue, type QueuedEdit } from "@/lib/batch-queue";

// Medical reviewers — only qualified clinicians appear in reviewedBy dropdown
const REVIEWERS = AUTHORS.filter(a =>
  ["dr-ants-haavel", "dr-karl-erik-tillmann", "optometrist-liisi"].includes(a.slug)
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftMeta {
  filename: string;
  path: string;
  title: string;
  excerpt: string;
  lang: string;
  date: string;
  slug?: string;
  featuredImage?: string;
  category?: string;
  status?: string; // "draft" | "medical_review"
  assignedTo?: string; // "silvia" | "jana" | "ants"
  deadline?: string; // "YYYY-MM-DD"
  medicalReview?: boolean;
}

interface PostResult {
  lang: string;
  filename: string;
  title: string;
  excerpt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LANG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  et: { bg: "#edf7d6", text: "#3d6b00", border: "#c5e58a" },
  ru: { bg: "#e8f0ff", text: "#1a3a99", border: "#a8c0f0" },
  en: { bg: "#f3e8ff", text: "#5b21b6", border: "#c4b5fd" },
};

const LANG_NAME: Record<string, string> = { et: "Eesti", ru: "Русский", en: "English" };

const QUOTES = [
  "Behind every published post is someone who paused, thought carefully, and chose to say something true.",
  "Good writing is an act of generosity — you give the reader clarity they didn't have before.",
  "Words heal. That's why we're here.",
  "Every draft is already an act of courage. Publishing it is just the sequel.",
  "Clarity is the highest form of kindness in writing.",
  "You're not just editing text. You're shaping how someone feels about their eyesight.",
  "The best editors don't just fix — they illuminate.",
  "Write to be understood. Read to grow.",
  "Precision in language is precision in thought.",
  "Your reader doesn't have time — so every sentence must earn its place.",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LangBadge({ lang }: { lang: string }) {
  const c = LANG_COLORS[lang] ?? { bg: "#f0f0ec", text: "#5a6b6c", border: "#e6e6e6" };
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>{lang.toUpperCase()}</span>
  );
}

function parseMdx(raw: string): { frontmatter: string; body: string } | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  return { frontmatter: match[1], body: match[2] };
}

function getFmField(fm: string, key: string): string {
  const m = fm.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?`, "m"));
  return m ? m[1].trim() : "";
}

function setFmField(fm: string, key: string, value: string): string {
  // If value contains double quotes, use YAML single-quoted style (simpler, no
  // backslash-escape dance) — single quotes only need doubling inside. This
  // avoids the classic "\"" truncation bug where titles like
  //   'Understanding the "Setting Sun Eyes" Phenomenon'
  // got corrupted to `title: "Understanding the \"` when a downstream regex
  // matched across the backslash-escape boundary.
  const hasDouble = value.includes('"');
  const line = hasDouble
    ? `${key}: '${value.replace(/'/g, "''")}'`
    : `${key}: "${value}"`;
  const re = new RegExp(`^${key}:.*$`, "m");
  // Use function replacement so `$` chars in value can never be interpreted
  // as backreferences (`$&`, `$'`, `$\``, etc.).
  return re.test(fm) ? fm.replace(re, () => line) : fm + `\n${line}`;
}

// Write a YAML list field (e.g. categories) — replaces any existing key:…value with
// a proper YAML block list so gray-matter always parses it as string[].
function setCategoriesField(fm: string, slugsOrSlug: string | string[]): string {
  const slugs = Array.isArray(slugsOrSlug) ? slugsOrSlug : [slugsOrSlug];
  if (slugs.length === 0) return fm;
  // Convert slugs back to display labels: "flow-protseduur" → "Flow Protseduur"
  const labels = slugs.map(s => s.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
  const block = `categories:\n${labels.map(l => `  - ${l}`).join("\n")}`;
  const blockRe = /^categories:\s*\n(?:[ \t]+-[ \t]+.+\n?)*/m;
  const inlineRe = /^categories:.*$/m;
  if (blockRe.test(fm)) return fm.replace(blockRe, block + "\n");
  if (inlineRe.test(fm)) return fm.replace(inlineRe, block);
  return fm + `\n${block}`;
}

function getFmCategories(fm: string): string[] {
  // Block list: categories:\n  - Foo\n  - Bar
  const blockMatch = fm.match(/^categories:\s*\n((?:[ \t]+-[ \t]+.+\n?)+)/m);
  if (blockMatch) {
    return blockMatch[1]
      .split("\n")
      .map(line => line.replace(/^[ \t]+-[ \t]+/, "").trim())
      .filter(Boolean)
      .map(cat => toSlug(cat));
  }
  // Inline scalar or quoted
  const inlineMatch = fm.match(/^categories:\s*["']?([^"'\n\[\]]+)["']?/m);
  if (inlineMatch) {
    const val = inlineMatch[1].replace(/^-\s*/, "").trim();
    return val ? [toSlug(val)] : [];
  }
  return [];
}

function buildMdx(frontmatter: string, body: string): string {
  return `---\n${frontmatter}\n---\n${body}`;
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

function DailyGreeting() {
  const [quote, setQuote] = useState("");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    setQuote(QUOTES[seed % QUOTES.length]);
  }, []);

  if (!visible || !quote) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg,#f4fae8,#edf7f0)",
      borderBottom: "1px solid #d4e8a8",
      padding: "12px 28px",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <span style={{ fontSize: 18 }}>✦</span>
      <p style={{ margin: 0, fontSize: 13, color: "#3a5a10", fontStyle: "italic", flex: 1 }}>
        &ldquo;{quote}&rdquo;
      </p>
      <button onClick={() => setVisible(false)} style={{
        background: "none", border: "none", color: "#9ab860",
        cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0,
      }}>×</button>
    </div>
  );
}

// ─── Draft Editor ─────────────────────────────────────────────────────────────

const WEB3FORMS_KEY = "10f4c27e-17d4-4a75-b4e5-20fc162d1564";

const ASSIGNEE_EMAILS: Record<string, string> = {
  silvia: "haavelants@me.com", // placeholder
  jana: "haavelants@me.com",   // placeholder
  ants: "haavelants@me.com",
};

const ASSIGNEE_LABELS: Record<string, string> = {
  silvia: "Silvia Johanna Haavel",
  jana: "Jana",
  ants: "Dr. Ants Haavel",
};

async function sendEmail(to: string, subject: string, message: string) {
  await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject, message, email: to }),
  });
}

// Compress image in the browser using Canvas before uploading
// Shared by DraftEditor (cover photo) and FormattingToolbar (inline body images)
async function compressImageClient(file: File, maxWidth = 1400, quality = 0.82): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => { if (blob) resolve({ blob, width: w, height: h }); else reject(new Error("Canvas compression failed")); },
        "image/webp", quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

function DraftEditor({ draft, onBack, onPublished, isPublished }: {
  draft: DraftMeta;
  onBack: () => void;
  onPublished: () => void;
  isPublished?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [frontmatter, setFrontmatter] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [postDate, setPostDate] = useState("");
  const [postSlug, setPostSlug] = useState("");
  const [youtubeInput, setYoutubeInput] = useState("");
  const [vimeoInput, setVimeoInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState("");
  const [unpublishing, setUnpublishing] = useState(false);
  const [unpublished, setUnpublished] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);       // "Update live" for published posts
  const [updateCountdown, setUpdateCountdown] = useState(0); // >0 shows countdown bar
  const [error, setError] = useState("");
  // Language switcher — tracks current lang and active file path (may change when lang moved)
  const [currentLang, setCurrentLang] = useState(draft.lang ?? "et");
  const [activePath, setActivePath] = useState(draft.path);
  const [movingLang, setMovingLang] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; sisters: number } | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<{ original: { name: string; sizeKB: number; width: number; height: number }; optimized: { sizeKB: number; width: number; height: number; format: string } } | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState(""); // raw.githubusercontent.com — editor preview only, NOT saved to frontmatter
  const [showPreview, setShowPreview] = useState(false);
  const [focalPoint, setFocalPoint] = useState(getFmField(frontmatter, "imageFocalPoint") || "center center");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [renamingImage, setRenamingImage] = useState(false);
  const [imageRenameInput, setImageRenameInput] = useState("");
  const [coverSeoName, setCoverSeoName] = useState(""); // optional pre-upload SEO name for cover photo

  // Review panel state
  const [langChecked, setLangChecked] = useState(false);
  const [needsMedical, setNeedsMedical] = useState<"yes" | "no" | null>(null);
  const [medicalSent, setMedicalSent] = useState(false);
  const [sendingMedical, setSendingMedical] = useState(false);

  // Assignment state
  const [assignedTo, setAssignedTo] = useState(draft.assignedTo ?? "");
  const [deadline, setDeadline] = useState(draft.deadline ?? "");
  const [reviewedBy, setReviewedBy] = useState("");
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    setLoaded(false); setError(""); setPublished(false); setSaved(false);
    const endpoint = isPublished
      ? `/api/admin/post?path=${encodeURIComponent(activePath)}`
      : `/api/admin/draft?path=${encodeURIComponent(activePath)}`;
    fetch(endpoint)
      .then(r => r.ok ? r.json() : fetch(`/api/admin/draft?path=${encodeURIComponent(activePath)}`).then(r2 => r2.json()))
      .then((d: { content?: string; error?: string }) => {
        if (d.error) { setError(d.error); return; }
        const raw = d.content ?? "";
        const parsed = parseMdx(raw);
        if (parsed) {
          setFrontmatter(parsed.frontmatter);
          setTitle(getFmField(parsed.frontmatter, "title"));
          setFeaturedImage(getFmField(parsed.frontmatter, "featuredImage"));
          setPostDate(getFmField(parsed.frontmatter, "date") || new Date().toISOString().split("T")[0]);
          setPostSlug(getFmField(parsed.frontmatter, "slug") || draft.filename.replace(/\.mdx?$/, ""));
          setSelectedCategories(getFmCategories(parsed.frontmatter));
          setReviewedBy(getFmField(parsed.frontmatter, "reviewedBy"));
          setBody(parsed.body.trimStart());
        } else { setBody(raw); }
        setLoaded(true);
      })
      .catch(e => setError((e as Error).message));
  }, [draft.path]); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeLang(toLang: string) {
    if (toLang === currentLang || movingLang) return;
    if (!confirm(`Muuda keel ${currentLang.toUpperCase()} → ${toLang.toUpperCase()}?\n\nMustandi fail liigub uude kausta. Muudatused salvestatakse automaatselt.`)) return;
    setMovingLang(true);
    try {
      const newFm = setFmField(frontmatter, "lang", toLang);
      const content = buildMdx(newFm, body);
      if (isPublished) {
        // Published posts: just update lang in frontmatter, no file move
        await fetch(`/api/admin/post?path=${encodeURIComponent(activePath)}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        setFrontmatter(newFm);
        setCurrentLang(toLang);
        setSaved(true); setTimeout(() => setSaved(false), 3000);
      } else {
        // Draft: move file to new lang folder
        const res = await fetch("/api/admin/move-lang", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromPath: activePath, toLang, content }),
        });
        const d = await res.json() as { ok?: boolean; newPath?: string; error?: string };
        if (d.error) { alert("Viga: " + d.error); return; }
        setActivePath(d.newPath ?? activePath);
        setFrontmatter(newFm);
        setCurrentLang(toLang);
        setSaved(true); setTimeout(() => setSaved(false), 3000);
      }
    } finally { setMovingLang(false); }
  }

  function buildFm(extraMedical?: boolean) {
    let fm = setFmField(frontmatter, "title", title);
    fm = setFmField(fm, "featuredImage", featuredImage);
    fm = setFmField(fm, "date", postDate);
    fm = setFmField(fm, "lang", currentLang);
    if (selectedCategories.length > 0) fm = setCategoriesField(fm, selectedCategories);
    if (focalPoint && focalPoint !== "center center") {
      fm = setFmField(fm, "imageFocalPoint", focalPoint);
    }
    if (assignedTo) fm = setFmField(fm, "assignedTo", assignedTo);
    if (deadline) fm = setFmField(fm, "deadline", deadline);
    if (reviewedBy) fm = setFmField(fm, "reviewedBy", reviewedBy);
    if (extraMedical) {
      fm = setFmField(fm, "medicalReview", "true");
      fm = setFmField(fm, "status", "medical_review");
    }
    return fm;
  }

  async function syncImage() {
    if (!featuredImage) return;
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch("/api/admin/sync-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: activePath, featuredImage }),
      });
      const d = await res.json() as { synced?: string[]; sistersFound?: number };
      setSyncResult({ synced: d.synced?.length ?? 0, sisters: d.sistersFound ?? 0 });
      setTimeout(() => setSyncResult(null), 5000);
    } finally { setSyncing(false); }
  }

  async function generateImage() {
    setGeneratingImage(true); setGeneratedPrompt("");
    try {
      const res = await fetch("/api/admin/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, excerpt: getFmField(frontmatter, "excerpt"), lang: draft.lang }),
      });
      const d = await res.json() as { ok?: boolean; imageUrl?: string; prompt?: string; note?: string; error?: string };
      if (d.error) { alert("Viga: " + d.error); return; }
      if (d.imageUrl) {
        setFeaturedImage(d.imageUrl);
      }
      if (d.prompt) setGeneratedPrompt(d.prompt);
    } finally { setGeneratingImage(false); }
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true); setUploadInfo(null);
    try {
      const originalSizeKB = Math.round(file.size / 1024);
      const originalWidth = await new Promise<number>((res) => {
        const img = new Image(); const url = URL.createObjectURL(file);
        img.onload = () => { URL.revokeObjectURL(url); res(img.width); };
        img.onerror = () => { URL.revokeObjectURL(url); res(0); };
        img.src = url;
      });

      // Compress client-side first — avoids Next.js 4.5 MB body limit
      const { blob, width: outW, height: outH } = await compressImageClient(file);
      const compressedSizeKB = Math.round(blob.size / 1024);

      // Use SEO name if Mia typed one, otherwise fall back to original file name
      const nameToUse = coverSeoName.trim() || file.name;
      const formData = new FormData();
      formData.append("image", blob, nameToUse.replace(/\.[^.]+$/, "") + ".webp");
      formData.append("originalName", nameToUse);
      formData.append("originalSizeKB", String(originalSizeKB));
      formData.append("originalWidth", String(originalWidth));

      const res = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
      const text = await res.text();
      let d: { ok?: boolean; url?: string; previewUrl?: string; error?: string };
      try { d = JSON.parse(text); } catch { throw new Error(text.slice(0, 120)); }
      if (d.error) { alert("Viga: " + d.error); return; }

      const newImageUrl = d.url ?? "";
      const newPreviewUrl = d.previewUrl ?? newImageUrl;

      // Set state for visual update
      setFeaturedImage(newImageUrl);
      setUploadPreviewUrl(newPreviewUrl);
      setUploadInfo({
        original: { name: file.name, sizeKB: originalSizeKB, width: originalWidth, height: 0 },
        optimized: { sizeKB: compressedSizeKB, width: outW, height: outH, format: "webp" },
      });

      // NO AUTO-SAVE. The image file is uploaded to GitHub (public/uploads/...),
      // but the post frontmatter update stays local until the user clicks Save /
      // Uuenda live. This avoids the classic bug where rapid image uploads race
      // auto-saves against each other — each auto-save used a stale `body` React
      // closure and wiped out earlier uploads' changes.
      // File is safe on GitHub; only the reference needs saving, and that happens
      // in buildFm() / buildMdx() at save time with fresh state.
    } catch (err) { alert("Üleslaadimine ebaõnnestus: " + (err as Error).message); }
    finally { setUploadingImage(false); e.target.value = ""; setCoverSeoName(""); }
  }

  // Upload an inline body image (called from FormattingToolbar image button)
  // Returns the production URL to insert as markdown, or null on failure
  async function uploadBodyImage(file: File): Promise<string | null> {
    try {
      const { blob } = await compressImageClient(file);
      const formData = new FormData();
      formData.append("image", blob, file.name.replace(/\.[^.]+$/, "") + ".webp");
      formData.append("originalName", file.name);
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
      const d = await res.json() as { ok?: boolean; url?: string; error?: string };
      if (d.error || !d.url) { alert("Pildi üleslaadimine ebaõnnestus: " + (d.error ?? "unknown")); return null; }
      return d.url;
    } catch (err) {
      alert("Pildi üleslaadimine ebaõnnestus: " + (err as Error).message);
      return null;
    }
  }

  async function doRenameImage() {
    const newName = imageRenameInput.trim();
    if (!newName || !featuredImage) return;

    // Extract the GitHub path from the URL: /uploads/YYYY/MM/old-name.webp
    const urlPath = featuredImage.startsWith("/") ? featuredImage : new URL(featuredImage).pathname;
    const githubPath = `public${urlPath}`; // "public/uploads/2026/04/old-name.webp"
    const ext = urlPath.split(".").pop() ?? "webp";
    const dir = urlPath.substring(0, urlPath.lastIndexOf("/") + 1); // "/uploads/2026/04/"
    const newFilename = `${newName}.${ext}`;
    const newUrlPath = `${dir}${newFilename}`;
    const newGithubPath = `public${newUrlPath}`;

    setUploadingImage(true);
    setRenamingImage(false);
    try {
      const res = await fetch("/api/admin/rename-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath: githubPath, newPath: newGithubPath }),
      });
      const d = await res.json() as { ok?: boolean; url?: string; error?: string };
      if (d.error) { alert("Ümbernimetamine ebaõnnestus: " + d.error); return; }
      const newUrl = d.url ?? newUrlPath;
      setFeaturedImage(newUrl);
      setUploadPreviewUrl(newUrl);
      setSaved(false);
    } catch (err) {
      alert("Ümbernimetamine ebaõnnestus: " + (err as Error).message);
    } finally { setUploadingImage(false); }
  }

  // Round-trip content through the server-side YAML parser (same gray-matter
  // instance Next.js build uses). Returns null if valid, an error string if not.
  // This is the last line of defence: invalid frontmatter NEVER reaches GitHub
  // and therefore never breaks a Vercel build.
  async function validateContent(content: string): Promise<string | null> {
    try {
      const res = await fetch("/api/admin/validate-frontmatter", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      return d.ok ? null : (d.error ?? "Tundmatu viga frontmatter'is");
    } catch {
      // If validation API itself is unreachable, don't block saves — fall through
      return null;
    }
  }

  async function save() {
    if (saving) return; // prevent concurrent saves
    setSaving(true); setSaved(false);
    const content = buildMdx(buildFm(), body);
    const badYaml = await validateContent(content);
    if (badYaml) {
      alert("⚠️ Ei saa salvestada — frontmatter on katki:\n\n" + badYaml + "\n\nTõenäoliselt sisaldab pealkiri või mõni muu väli veidrat jutumärki. Paranda tekst ja proovi uuesti.");
      setSaving(false);
      return;
    }
    try {
      if (isPublished) {
        // Published posts: stage into batch queue instead of immediate GitHub write.
        // Editor can Salvesta on many posts, then flush all in one commit via "Uuenda kõik".
        enqueue({ path: activePath, content, title });
        setSaved(true); setTimeout(() => setSaved(false), 3000);
      } else {
        // Drafts: save immediately (doesn't trigger a live rebuild anyway)
        const res = await fetch(`/api/admin/draft?path=${encodeURIComponent(activePath)}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const d = await res.json() as { ok?: boolean; error?: string };
        if (d.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
        else if (d.error) { alert("Salvestamine ebaõnnestus: " + d.error); }
      }
    } catch (err) {
      alert("Võrguühenduse viga: " + (err as Error).message);
    } finally { setSaving(false); }
  }

  async function updateLive() {
    // With the batch-queue system, "Uuenda live" now stages the edit the same
    // way Salvesta does. Editor flushes everything via the top-of-page banner.
    setUpdating(true); setSaved(false);
    const content = buildMdx(buildFm(), body);
    const badYaml = await validateContent(content);
    if (badYaml) {
      alert("⚠️ Ei saa järjekorda lisada — frontmatter on katki:\n\n" + badYaml + "\n\nTõenäoliselt sisaldab pealkiri või mõni muu väli veidrat jutumärki. Paranda tekst ja proovi uuesti.");
      setUpdating(false);
      return;
    }
    try {
      enqueue({ path: activePath, content, title });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Viga järjekorda lisamisel: " + (err as Error).message);
    } finally { setUpdating(false); }
  }

  async function publish() {
    if (!reviewedBy) {
      setError("⚠️ Ei saa avaldada — meditsiiniline läbivaataja (reviewedBy) on kohustuslik. Vali sticky-riba allservas.");
      return;
    }
    setPublishing(true); setError("");
    // Build the final content from current React state — this is the source of truth.
    // We pass it directly to the publish API so it never has to read from the stale filesystem.
    const finalContent = buildMdx(buildFm(), body);
    const badYaml = await validateContent(finalContent);
    if (badYaml) {
      setError("⚠️ Ei saa avaldada — frontmatter on katki: " + badYaml + ". Paranda pealkiri/tekst ja proovi uuesti.");
      setPublishing(false);
      return;
    }
    // Also save to GitHub draft (keeps draft in sync before publish deletes it)
    await fetch(`/api/admin/draft?path=${encodeURIComponent(activePath)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: finalContent }),
    });
    // Then publish — send the content directly so publish API uses it verbatim
    try {
      const res = await fetch("/api/admin/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: activePath, content: finalContent }),
      });
      if (res.status === 401 || res.redirected || !res.headers.get("content-type")?.includes("application/json")) {
        setError("Sessioon aegus — palun logi uuesti sisse (/admin/login)");
        return;
      }
      const d = await res.json() as { ok?: boolean; slug?: string; needsRedeploy?: boolean; error?: string };
      if (d.ok) { setPublished(true); setPublishedSlug(d.slug ?? ""); onPublished(); }
      else { setError(d.error ?? "Midagi läks valesti"); }
    } catch (err) {
      setError("Viga: " + (err as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  async function unpublish() {
    if (!confirm(`Kas oled kindel, et soovid postituse "${title}" eemaldada avalikust vaatest?\nPostitus liigub tagasi mustandite alla.`)) return;
    setUnpublishing(true); setError("");
    try {
      const res = await fetch("/api/admin/unpublish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: activePath }),
      });
      // If the session expired the server returns a login redirect (non-JSON HTML).
      // Detect that before calling .json() so the button doesn't freeze forever.
      if (res.status === 401 || res.redirected || !res.headers.get("content-type")?.includes("application/json")) {
        setError("Sessioon aegus — palun logi uuesti sisse (/admin/login)");
        return;
      }
      const d = await res.json() as { ok?: boolean; draftPath?: string; error?: string };
      if (d.ok) { setUnpublished(true); setTimeout(() => { onBack(); }, 1800); }
      else { setError(d.error ?? "Eemaldamine ebaõnnestus"); }
    } catch (err) {
      setError("Viga: " + (err as Error).message);
    } finally {
      setUnpublishing(false);
    }
  }

  async function deleteDraft() {
    if (!confirm(`Kustuta mustand "${title}" jäädavalt?\n\nSeda ei saa tagasi võtta!`)) return;
    setDeleting(true); setError("");
    try {
      const res = await fetch(`/api/admin/draft?path=${encodeURIComponent(activePath)}`, {
        method: "DELETE",
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.ok) { onBack(); }
      else { setError(d.error ?? "Kustutamine ebaõnnestus"); }
    } catch (err) {
      setError((err as Error).message);
    } finally { setDeleting(false); }
  }

  async function sendToMedicalReview() {
    setSendingMedical(true);
    // Save draft with medicalReview flag first
    const fm = buildFm(true);
    await fetch(`/api/admin/draft?path=${encodeURIComponent(activePath)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: buildMdx(fm, body) }),
    });
    setFrontmatter(fm);
    // Send email
    await sendEmail(
      "haavelants@me.com",
      `Arsti kontroll vajalik: ${title}`,
      `Tere, Dr. Haavel!\n\nPostitus vajab arsti ülevaadet enne avaldamist.\n\nPealkiri: ${title}\nKeel: ${draft.lang.toUpperCase()}\nLink: https://blog.ksa.ee/admin\n\n— KSA Blog Admin`
    );
    setSendingMedical(false);
    setMedicalSent(true);
  }

  async function notifyAssignee() {
    if (!assignedTo) return;
    setNotifying(true);
    const email = ASSIGNEE_EMAILS[assignedTo];
    const name = ASSIGNEE_LABELS[assignedTo];
    await sendEmail(
      email,
      `KSA Blogi ülesanne: ${title}`,
      `Tere, ${name}!\n\nSulle on määratud ülesanne KSA blogis.\n\nPostitus: ${title}\nKeel: ${draft.lang.toUpperCase()}${deadline ? `\nTähtaeg: ${deadline}` : ""}\nLink: https://blog.ksa.ee/admin\n\n— KSA Blog Admin`
    );
    setNotifying(false);
    setNotified(true);
    setTimeout(() => setNotified(false), 3000);
  }

  // ── Unpublished screen ───────────────────────────────────────────────────
  if (unpublished) {
    return (
      <div style={{ maxWidth: 600, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>📦</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a", margin: "0 0 10px" }}>
          Postitus eemaldatud avalikust vaatest
        </h2>
        <p style={{ color: "#9a9a9a", fontSize: 15, marginBottom: 28 }}>
          Postitus on nüüd mustandina tagasi. Läheb naasmisele automaatselt…
        </p>
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (published) {
    return <PublishSuccessScreen slug={publishedSlug} onBack={onBack} />;
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!loaded && !error) {
    return <div style={{ textAlign: "center", padding: "80px 24px", color: "#9a9a9a", fontSize: 16 }}>Laen…</div>;
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 120px" }}>
      {/* Breadcrumb nav */}
      <div style={{
        padding: "16px 0 14px", display: "flex", alignItems: "center",
        gap: 10, borderBottom: "1px solid #f0f0ec", marginBottom: 24, flexWrap: "wrap",
      }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", fontSize: 14, color: "#5a6b6c",
          cursor: "pointer", fontWeight: 600, padding: 0, display: "flex", alignItems: "center", gap: 5,
        }}>← {isPublished ? "Avaldatud" : "Mustandid"}</button>
        <span style={{ color: "#d0d0cc", fontSize: 16 }}>›</span>

        {/* Interactive language switcher */}
        <div style={{ display: "flex", gap: 3 }} title="Vaheta keelt — fail liigub õigesse kausta">
          {(["et", "ru", "en"] as const).map(l => (
            <button
              key={l}
              onClick={() => changeLang(l)}
              disabled={movingLang}
              style={{
                padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                letterSpacing: "0.05em", textTransform: "uppercase",
                border: `1.5px solid ${currentLang === l ? LANG_COLORS[l]?.border : "#e6e6e6"}`,
                background: currentLang === l ? LANG_COLORS[l]?.bg : "white",
                color: currentLang === l ? LANG_COLORS[l]?.text : "#b0b0aa",
                cursor: movingLang ? "wait" : currentLang === l ? "default" : "pointer",
                transition: "all 0.15s",
              }}
            >{l.toUpperCase()}</button>
          ))}
          {movingLang && <span style={{ fontSize: 11, color: "#9a9a9a", alignSelf: "center", marginLeft: 4 }}>liigutan…</span>}
        </div>
        <span style={{ fontSize: 13, color: "#9a9a9a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
          {draft.title || draft.filename}
        </span>
        {isPublished && postSlug && (
          <a
            href={`https://blog.ksa.ee/${postSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 13, color: "#87be23", fontWeight: 700,
              textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
              padding: "5px 12px", border: "1.5px solid #c5e58a", borderRadius: 20,
              whiteSpace: "nowrap", flexShrink: 0,
            }}
          >Vaata blogis ↗</a>
        )}
      </div>

      {error && (
        <div style={{ background: "#fff0f0", border: "1px solid #fcc", borderRadius: 12, padding: "12px 16px", color: "#b91c1c", marginBottom: 20 }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Preview panel ── */}
      {showPreview && (
        <PostPreview
          title={title}
          body={body}
          featuredImage={uploadPreviewUrl || featuredImage}
          category={selectedCategories[0] ? getCategoryLabel(selectedCategories[0], currentLang as "et"|"ru"|"en") : ""}
          date={postDate}
          author={getFmField(frontmatter, "author")}
          lang={draft.lang}
          onClose={() => setShowPreview(false)}
          onPublish={!isPublished ? publish : undefined}
          publishing={publishing}
        />
      )}

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Pealkiri..."
        style={{
          width: "100%", padding: "14px 0", fontSize: 26, fontWeight: 800,
          color: "#1a1a1a", border: "none", borderBottom: "2px solid #f0f0ec",
          background: "transparent", outline: "none", boxSizing: "border-box",
          marginBottom: 24, fontFamily: "inherit",
        }}
        onFocus={e => { e.target.style.borderBottomColor = "#87be23"; }}
        onBlur={e => { e.target.style.borderBottomColor = "#f0f0ec"; }}
      />

      {/* Media fields */}
      <div style={{
        background: "white", border: "1.5px solid #e6e6e6", borderRadius: 16,
        padding: "0", marginBottom: 20, display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Publish date */}
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #f0f0ec" }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#5a6b6c", display: "block", marginBottom: 8 }}>
            📅 Kuupäev
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="date"
              value={postDate}
              onChange={e => setPostDate(e.target.value)}
              style={{
                padding: "10px 14px", border: "1.5px solid #e6e6e6",
                borderRadius: 10, fontSize: 13, outline: "none", background: "white",
                fontFamily: "inherit", color: "#1a1a1a", cursor: "pointer",
              }}
              onFocus={e => { e.target.style.borderColor = "#87be23"; }}
              onBlur={e => { e.target.style.borderColor = "#e6e6e6"; }}
            />
            <span style={{ fontSize: 12, color: "#9a9a9a" }}>
              {postDate > new Date().toISOString().split("T")[0]
                ? "⏰ Ajastatud — ilmub sellel kuupäeval"
                : postDate < new Date().toISOString().split("T")[0]
                ? "📜 Mineviku kuupäev"
                : "📅 Täna"}
            </span>
          </div>
        </div>

        {/* Featured image */}
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #f0f0ec" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#5a6b6c" }}>
              🖼 Kaanepilt
              {isPublished && (
                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: "#87be23", textTransform: "none", letterSpacing: 0 }}>
                  · Lae uus pilt üles → Salvesta → live ~2 min
                </span>
              )}
            </label>
            {/* SEO name field — optional, set before uploading */}
            <div style={{ marginBottom: 6 }}>
              <input
                type="text"
                value={coverSeoName}
                onChange={e => setCoverSeoName(e.target.value.toLowerCase().replace(/[äöüõ]/g, (c: string) => ({ ä: "a", ö: "o", ü: "u", õ: "o" })[c] ?? c).replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))}
                placeholder="pildi-seo-nimi (valikuline — enne üleslaadimist)"
                style={{
                  width: "100%", padding: "6px 10px", border: "1.5px solid #e6e6e6",
                  borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "inherit",
                  boxSizing: "border-box", color: "#1a1a1a",
                }}
                onFocus={e => { e.target.style.borderColor = "#87be23"; }}
                onBlur={e => { e.target.style.borderColor = "#e6e6e6"; }}
              />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {/* Upload from computer */}
              <label
                style={{
                  padding: "4px 12px", borderRadius: 8, border: "1.5px solid #3b82f6",
                  background: uploadingImage ? "#f0f0ec" : "white",
                  color: uploadingImage ? "#9a9a9a" : "#3b82f6",
                  fontSize: 11, fontWeight: 700, cursor: uploadingImage ? "wait" : "pointer",
                  fontFamily: "inherit", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4,
                }}
              >
                {uploadingImage ? "Laen üles..." : "📁 Lae pilt üles"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,.jpg,.jpeg,.png,.webp,.gif,.avif,.heic"
                  onChange={uploadImage}
                  style={{ display: "none" }}
                  disabled={uploadingImage}
                />
              </label>
              {/* AI generate */}
              <button
                type="button"
                onClick={generateImage}
                disabled={generatingImage || !title}
                style={{
                  padding: "4px 12px", borderRadius: 8, border: "1.5px solid #87be23",
                  background: generatingImage ? "#f0f0ec" : "white",
                  color: generatingImage ? "#9a9a9a" : "#87be23",
                  fontSize: 11, fontWeight: 700, cursor: generatingImage || !title ? "wait" : "pointer",
                  fontFamily: "inherit", whiteSpace: "nowrap",
                }}
              >
                {generatingImage ? "Genereerin..." : "✨ AI pilt"}
              </button>
            </div>
          </div>

          {/* Upload result info */}
          {uploadInfo && (
            <div style={{ marginBottom: 8, padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", fontSize: 11, color: "#166534" }}>
              <strong>Optimeeritud:</strong> {uploadInfo.original.name} ({uploadInfo.original.width}x{uploadInfo.original.height}, {uploadInfo.original.sizeKB} KB)
              → {uploadInfo.optimized.width}x{uploadInfo.optimized.height} WebP, <strong>{uploadInfo.optimized.sizeKB} KB</strong>
              {uploadInfo.original.sizeKB > uploadInfo.optimized.sizeKB && (
                <span> ({Math.round((1 - uploadInfo.optimized.sizeKB / uploadInfo.original.sizeKB) * 100)}% väiksem)</span>
              )}
            </div>
          )}

          {generatedPrompt && !process.env.NEXT_PUBLIC_HAS_REPLICATE && (
            <div style={{ marginBottom: 8, padding: "10px 12px", background: "#f9f9f7", borderRadius: 8, border: "1px solid #e6e6e6" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#5a6b6c", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI prompt (kopeeri Midjourney/DALL-E)</p>
              <p style={{ fontSize: 12, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>{generatedPrompt}</p>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(generatedPrompt)}
                style={{ marginTop: 6, fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid #e6e6e6", background: "white", cursor: "pointer", color: "#5a6b6c" }}
              >Kopeeri prompt</button>
            </div>
          )}

          {/* URL input + upload drop hint */}
          <div style={{ position: "relative" }}>
            <input
              type="url"
              value={featuredImage}
              onChange={e => { setFeaturedImage(e.target.value); setUploadInfo(null); }}
              placeholder="Kleebi URL või kasuta ülalolevat nuppu pildi üleslaadimiseks"
              style={{
                width: "100%", padding: "10px 14px", border: "1.5px solid #e6e6e6",
                borderRadius: 10, fontSize: 13, outline: "none", background: "white",
                boxSizing: "border-box", fontFamily: "inherit", color: "#1a1a1a",
              }}
              onFocus={e => { e.target.style.borderColor = "#87be23"; }}
              onBlur={e => { e.target.style.borderColor = "#e6e6e6"; }}
            />
          </div>
          {featuredImage && (
            <>
              {/* Drag-to-reposition crop control */}
              <DragCrop
                src={uploadPreviewUrl || featuredImage}
                focalPoint={focalPoint}
                onFocalPointChange={setFocalPoint}
              />

              {uploadPreviewUrl && uploadPreviewUrl !== featuredImage && (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6b7280" }}>
                  ⏳ Eelvaade — pilt ilmub blogis pärast ~2 min deploymenti. Salvestatud: <code style={{ fontSize: 10 }}>{featuredImage}</code>
                </p>
              )}
              {featuredImage && featuredImage.includes("/uploads/") && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  {renamingImage ? (
                    <>
                      <input
                        type="text"
                        value={imageRenameInput}
                        onChange={e => setImageRenameInput(e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase())}
                        placeholder="uus-failinimi-ilma-laiendita"
                        style={{ flex: 1, padding: "6px 10px", border: "1.5px solid #87be23", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "inherit" }}
                        onKeyDown={e => { if (e.key === "Enter") doRenameImage(); if (e.key === "Escape") setRenamingImage(false); }}
                        autoFocus
                      />
                      <button type="button" onClick={doRenameImage} disabled={!imageRenameInput.trim()}
                        style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#87be23", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        Salvesta
                      </button>
                      <button type="button" onClick={() => setRenamingImage(false)}
                        style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e6e6e6", background: "white", fontSize: 12, cursor: "pointer" }}>
                        Tühista
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => {
                      const current = featuredImage.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
                      setImageRenameInput(current);
                      setRenamingImage(true);
                    }}
                      style={{ fontSize: 11, color: "#5a6b6c", background: "none", border: "1px solid #e6e6e6", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
                      ✏️ Nimeta ümber
                    </button>
                  )}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={syncImage}
                  disabled={syncing}
                  style={{
                    padding: "6px 14px", borderRadius: 8, border: "1.5px solid #e6e6e6",
                    background: syncing ? "#f0f0ec" : "white", color: "#5a6b6c", fontSize: 12, fontWeight: 600,
                    cursor: syncing ? "wait" : "pointer", fontFamily: "inherit",
                  }}
                >
                  {syncing ? "Sünkroonin..." : "Sünkrooni pilt sõsarartiklitele"}
                </button>
                <button
                  type="button"
                  onClick={() => { setFeaturedImage(""); setUploadPreviewUrl(""); setUploadInfo(null); }}
                  style={{
                    padding: "6px 14px", borderRadius: 8, border: "1.5px solid #fca5a5",
                    background: "white", color: "#b91c1c", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Eemalda pilt
                </button>
              </div>
              {syncResult && (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: syncResult.synced > 0 ? "#3d6b00" : "#9a9a9a" }}>
                  {syncResult.sisters === 0
                    ? "Sõsarartikleid ei leitud"
                    : `${syncResult.synced}/${syncResult.sisters} sõsarartiklit uuendatud`}
                </p>
              )}
            </>
          )}
        </div>

        {/* YouTube embed */}
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #f0f0ec" }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#5a6b6c", display: "block", marginBottom: 8 }}>
            ▶ YouTube video
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="url"
              value={youtubeInput}
              onChange={e => setYoutubeInput(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              style={{
                flex: 1, padding: "10px 14px", border: "1.5px solid #e6e6e6",
                borderRadius: 10, fontSize: 13, outline: "none", background: "white",
                fontFamily: "inherit", color: "#1a1a1a",
              }}
              onFocus={e => { e.target.style.borderColor = "#87be23"; }}
              onBlur={e => { e.target.style.borderColor = "#e6e6e6"; }}
            />
            <button
              type="button"
              disabled={!youtubeInput.trim()}
              onClick={() => {
                const tag = `\n<YouTubeEmbed url="${youtubeInput.trim()}" />\n`;
                setBody(prev => prev + tag);
                setYoutubeInput("");
              }}
              style={{
                padding: "10px 16px", borderRadius: 10, border: "none",
                background: youtubeInput.trim() ? "#87be23" : "#e6e6e6",
                color: youtubeInput.trim() ? "white" : "#9a9a9a",
                fontSize: 13, fontWeight: 700, cursor: youtubeInput.trim() ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
              }}
            >Lisa artiklisse →</button>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9a9a9a" }}>
            Video lisatakse artikli lõppu. Saad selle tekstis ümber tõsta.
          </p>
        </div>

        {/* Vimeo embed */}
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #f0f0ec" }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#5a6b6c", display: "block", marginBottom: 8 }}>
            ▶ Vimeo video
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="url"
              value={vimeoInput}
              onChange={e => setVimeoInput(e.target.value)}
              placeholder="https://vimeo.com/..."
              style={{
                flex: 1, padding: "10px 14px", border: "1.5px solid #e6e6e6",
                borderRadius: 10, fontSize: 13, outline: "none", background: "white",
                fontFamily: "inherit", color: "#1a1a1a",
              }}
              onFocus={e => { e.target.style.borderColor = "#87be23"; }}
              onBlur={e => { e.target.style.borderColor = "#e6e6e6"; }}
            />
            <button
              type="button"
              disabled={!vimeoInput.trim()}
              onClick={() => {
                const tag = `\n<VimeoEmbed url="${vimeoInput.trim()}" />\n`;
                setBody(prev => prev + tag);
                setVimeoInput("");
              }}
              style={{
                padding: "10px 16px", borderRadius: 10, border: "none",
                background: vimeoInput.trim() ? "#87be23" : "#e6e6e6",
                color: vimeoInput.trim() ? "white" : "#9a9a9a",
                fontSize: 13, fontWeight: 700, cursor: vimeoInput.trim() ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
              }}
            >Lisa artiklisse →</button>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9a9a9a" }}>
            Toetab nii avalikke kui ka privaatseid Vimeo linke (nt vimeo.com/123/abc).
          </p>
        </div>

        {/* Category selector */}
        <div style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#5a6b6c" }}>
              🏷 Kategooriad
            </label>
            {selectedCategories.length > 0 && (
              <span style={{ fontSize: 11, color: "#3d6b00", fontWeight: 700, background: "#f0fde4", padding: "2px 9px", borderRadius: 12, border: "1px solid #c5e58a" }}>
                {selectedCategories.length > 1 ? `${selectedCategories.length} valitud` : "✓ valitud"}
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {([
              { slug: "silmad-ja-tervis",          et: "Silmad ja Tervis",          ru: "Глаза и Здоровье",       en: "Eyes & Health" },
              { slug: "huvitavad-faktid",           et: "Huvitavad faktid",           ru: "Интересные факты",       en: "Interesting Facts" },
              { slug: "elustiil",                   et: "Elustiil",                   ru: "Стиль жизни",            en: "Lifestyle" },
              { slug: "edulood",                    et: "Edulood",                    ru: "Истории успеха",         en: "Success Stories" },
              { slug: "kogemuslood",                et: "Kogemuslood",                ru: "Истории пациентов",      en: "Patient Stories" },
              { slug: "nagemise-korrigeerimine",    et: "Nägemise korrigeerimine",    ru: "Коррекция зрения",       en: "Vision Correction" },
              { slug: "flow-protseduur",            et: "Flow Protseduur",            ru: "Процедура Flow",         en: "Flow Procedure" },
              { slug: "silmade-tervis-nipid",       et: "Silmade tervis & nipid",     ru: "Здоровье глаз",          en: "Eye Health & Tips" },
              { slug: "tehnoloogia",                et: "Tehnoloogia",                ru: "Технология",             en: "Technology" },
              { slug: "ksa-silmakeskus",            et: "KSA Silmakeskus",            ru: "Глазной центр KSA",      en: "KSA Vision Center" },
            ] as const).map(cat => {
              const label = cat[currentLang as "et" | "ru" | "en"] ?? cat.et;
              const isActive = selectedCategories.includes(cat.slug);
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => setSelectedCategories(prev =>
                    prev.includes(cat.slug)
                      ? prev.filter(s => s !== cat.slug)
                      : prev.length >= 5 ? prev : [...prev, cat.slug]
                  )}
                  style={{
                    padding: "6px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    border: `1.5px solid ${isActive ? "#87be23" : "#e6e6e6"}`,
                    background: isActive ? "#f0fde4" : "#fafaf8",
                    color: isActive ? "#3d6b00" : "#5a6b6c",
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                  }}
                >{isActive ? `✓ ${label}` : label}</button>
              );
            })}
          </div>
          {!selectedCategories.length && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#f59e0b" }}>
              ⚠ Kategooria on valimata — artikkel ilmub ilma sildita
            </p>
          )}
          {selectedCategories.length >= 5 && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#3d6b00" }}>
              Maksimaalselt 5 kategooriat valitud
            </p>
          )}
        </div>
      </div>

      {/* Formatting toolbar + Body textarea */}
      <FormattingToolbar
        body={body}
        setBody={setBody}
        onUploadBodyImage={uploadBodyImage}
        onFormatBlogRules={async () => {
          if (!body.trim()) {
            alert("Artikli tekst on tühi — pole midagi vormindada.");
            return null;
          }
          const res = await fetch("/api/admin/format-body", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              body,
              excerpt: getFmField(frontmatter, "excerpt"),
              seoExcerpt: getFmField(frontmatter, "seoExcerpt"),
              title,
              lang: draft.lang,
            }),
          });
          if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            alert(`Vormindamine ebaõnnestus: ${e.error ?? res.status}`);
            return null;
          }
          const data = (await res.json()) as {
            body: string;
            excerpt: string;
            seoExcerpt: string;
            stats: { before: number; after: number; addedHeadings: number };
          };
          const msg =
            `Vorminda blogi reeglite järgi?\n\n` +
            `• Tekst: ${data.stats.before} → ${data.stats.after} sõna\n` +
            `• Uusi H2 pealkirju: ${data.stats.addedHeadings}\n` +
            `• Katkendlikud lühikirjeldused parandatud\n\n` +
            `Rakendan muudatused?`;
          if (!confirm(msg)) return null;
          setBody(data.body);
          let fm = setFmField(frontmatter, "excerpt", data.excerpt);
          fm = setFmField(fm, "seoExcerpt", data.seoExcerpt);
          setFrontmatter(fm);
          return data.body;
        }}
      />

      {/* Review Panel — shown only for drafts */}
      {!isPublished && (
        <div style={{
          background: "white", border: "1.5px solid #e6e6e6", borderRadius: 18,
          padding: "20px 22px", marginTop: 24, marginBottom: 8,
        }}>
          <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: "#1a1a1a" }}>
            Kvaliteedikontroll
          </p>

          {/* Language check */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#1a1a1a", cursor: "pointer", marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={langChecked}
              onChange={e => setLangChecked(e.target.checked)}
              style={{ width: 18, height: 18, cursor: "pointer" }}
            />
            ✓ Keelekontroll tehtud
          </label>

          {/* Medical review */}
          <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "#5a6b6c" }}>
            Kas arsti kontroll on vajalik?
          </p>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            {(["yes", "no"] as const).map(v => (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="medicalReview"
                  value={v}
                  checked={needsMedical === v}
                  onChange={() => setNeedsMedical(v)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                {v === "yes" ? "Jah" : "Ei"}
              </label>
            ))}
          </div>

          {/* Conditional action buttons */}
          {medicalSent ? (
            <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 12, padding: "12px 16px", fontSize: 14, color: "#7a5800", fontWeight: 600 }}>
              🏥 Saadetud Dr. Haaveli lauale ✓
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {langChecked && needsMedical === "no" && !reviewedBy && (
                <div style={{
                  background: "#fee2e2", border: "1.5px solid #fca5a5", borderRadius: 10,
                  padding: "10px 14px", fontSize: 13, color: "#991b1b", fontWeight: 700,
                }}>
                  ⚠ Enne avaldamist vali all sticky-riba väljal <u>&ldquo;Läbi vaadanud&rdquo;</u> meditsiiniline kontrollija.
                </div>
              )}
              {langChecked && needsMedical === "no" && (
                <button
                  onClick={() => {
                    if (!reviewedBy) {
                      alert("⚠️ Ei saa avaldada — vali all sticky-riba väljal 'Läbi vaadanud' meditsiiniline kontrollija.");
                      const el = document.querySelector('select[data-reviewedby]') as HTMLSelectElement | null;
                      if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
                      return;
                    }
                    publish();
                  }}
                  disabled={publishing}
                  title={reviewedBy ? "Avalda postitus live'i" : "Vali enne avaldamist 'Läbi vaadanud' väli all"}
                  style={{
                    padding: "11px 28px", border: "none", borderRadius: 12,
                    background: publishing
                      ? "#c5dfa0"
                      : reviewedBy ? "#87be23" : "#d4d4d0",
                    color: "white",
                    fontSize: 15, fontWeight: 800,
                    cursor: publishing ? "not-allowed" : "pointer",
                    alignSelf: "flex-start",
                  }}
                >
                  {publishing ? "Avaldan…" : reviewedBy ? "✓ Avalda" : "🔒 Avalda (nõuab kontrollijat)"}
                </button>
              )}
              {langChecked && needsMedical === "yes" && (
                <button onClick={sendToMedicalReview} disabled={sendingMedical} style={{
                  padding: "11px 28px", border: "none", borderRadius: 12,
                  background: sendingMedical ? "#ffe082" : "#f59e0b", color: "white",
                  fontSize: 15, fontWeight: 800, cursor: sendingMedical ? "not-allowed" : "pointer",
                }}>
                  {sendingMedical ? "Saadan…" : "🏥 Suuna arsti lauale"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sticky action bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "white", borderTop: "1px solid #e6e6e6",
        padding: "14px 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 12, zIndex: 100,
        boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
      }}>
        {/* Left: assignment */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6b6c" }}>Vastutaja:</span>
          <select
            value={assignedTo}
            onChange={e => setAssignedTo(e.target.value)}
            style={{
              padding: "7px 12px", border: "1.5px solid #e6e6e6", borderRadius: 10,
              fontSize: 13, background: "white", color: "#1a1a1a", outline: "none", cursor: "pointer",
            }}
          >
            <option value="">— vali —</option>
            <option value="silvia">Silvia Johanna Haavel</option>
            <option value="jana">Jana</option>
            <option value="ants">Dr. Ants Haavel</option>
          </select>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6b6c" }}>Tähtaeg:</span>
          <input
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            style={{
              padding: "7px 12px", border: "1.5px solid #e6e6e6", borderRadius: 10,
              fontSize: 13, background: "white", color: "#1a1a1a", outline: "none", cursor: "pointer",
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color: reviewedBy ? "#5a6b6c" : "#b91c1c" }}>
            Läbi vaadanud{!reviewedBy && " *"}:
          </span>
          <select
            data-reviewedby
            value={reviewedBy}
            onChange={e => setReviewedBy(e.target.value)}
            style={{
              padding: "7px 12px",
              border: `1.5px solid ${reviewedBy ? "#e6e6e6" : "#fca5a5"}`,
              borderRadius: 10,
              fontSize: 13, background: reviewedBy ? "white" : "#fef2f2",
              color: "#1a1a1a", outline: "none", cursor: "pointer",
            }}
          >
            <option value="">— kohustuslik —</option>
            {REVIEWERS.map(r => (
              <option key={r.slug} value={r.displayName}>{r.displayName}</option>
            ))}
          </select>
          {assignedTo && (
            <button onClick={notifyAssignee} disabled={notifying} style={{
              padding: "7px 14px", border: "1.5px solid #e6e6e6", borderRadius: 10,
              background: "white", fontSize: 13, fontWeight: 700, cursor: notifying ? "not-allowed" : "pointer",
              color: notified ? "#3d6b00" : "#5a6b6c",
            }}>
              {notified ? "✓ Teavitatud" : notifying ? "Saadan…" : "Teavita"}
            </button>
          )}
        </div>

        {/* Right: preview / save / publish / unpublish */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {saved && <span style={{ fontSize: 14, color: "#3d6b00", fontWeight: 600 }}>✓ Salvestatud</span>}
          <button onClick={() => setShowPreview(v => !v)} style={{
            padding: "11px 18px", border: "2px solid #e6e4df", borderRadius: 12,
            background: showPreview ? "#f0fdf4" : "white",
            borderColor: showPreview ? "#87be23" : "#e6e4df",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
            color: showPreview ? "#3d6b00" : "#5a6b6c",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {showPreview ? "✏️ Redigeeri" : "👁 Eelvaade"}
          </button>
          {/* For drafts: plain Salvesta. For published posts: Salvesta is just a quiet save. */}
          {!isPublished && (
            <>
              <button onClick={save} disabled={saving} style={{
                padding: "11px 22px", border: "2px solid #e6e6e6", borderRadius: 12,
                background: "white", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                color: "#5a6b6c",
              }}>{saving ? "Salvestab…" : "Salvesta"}</button>
              <button onClick={deleteDraft} disabled={deleting} title="Kustuta mustand jäädavalt" style={{
                padding: "11px 16px", border: "2px solid #fca5a5", borderRadius: 12,
                background: "white", fontSize: 14, fontWeight: 700,
                cursor: deleting ? "not-allowed" : "pointer",
                color: deleting ? "#9a9a9a" : "#b91c1c",
              }}>{deleting ? "…" : "🗑"}</button>
            </>
          )}
          {isPublished ? (
            <>
              <button onClick={save} disabled={saving} style={{
                padding: "11px 20px", border: "2px solid #e6e6e6", borderRadius: 12,
                background: "white", fontSize: 13, fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer", color: "#5a6b6c",
              }} title="Salvesta muudatused ilma live uuendamata">
                {saving ? "Salvestab…" : "💾 Salvesta"}
              </button>
              <button onClick={updateLive} disabled={updating} style={{
                padding: "11px 24px", border: "none", borderRadius: 12,
                background: updating ? "#c5dfa0" : "#87be23",
                color: "white", fontSize: 14, fontWeight: 800,
                cursor: updating ? "not-allowed" : "pointer",
              }} title="Lisab muudatuse järjekorda — flušši ülevalt 'Uuenda kõik' nupust">
                {updating ? "Lisan…" : "📦 Lisa järjekorda"}
              </button>
              <button onClick={unpublish} disabled={unpublishing} style={{
                padding: "11px 20px", border: "2px solid #fca5a5", borderRadius: 12,
                background: "white", fontSize: 13, fontWeight: 600,
                cursor: unpublishing ? "not-allowed" : "pointer",
                color: unpublishing ? "#9a9a9a" : "#b91c1c",
              }}>{unpublishing ? "Eemaldan…" : "↩ Eemalda"}</button>
            </>
          ) : (
            <button onClick={publish} disabled={publishing} style={{
              padding: "11px 28px", border: "none", borderRadius: 12,
              background: publishing ? "#c5dfa0" : "#87be23", color: "white",
              fontSize: 15, fontWeight: 800, cursor: publishing ? "not-allowed" : "pointer",
              letterSpacing: "0.01em",
            }}>{publishing ? "Avaldan…" : "✓ Avalda"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Formatting toolbar ───────────────────────────────────────────────────────
// Wraps the body textarea with B / I / Link / H2 / H3 buttons.
// Operates on the selected text range using document.execCommand-style logic.

function FormattingToolbar({
  body, setBody, onUploadBodyImage, onFormatBlogRules,
}: {
  body: string;
  setBody: React.Dispatch<React.SetStateAction<string>>;
  onUploadBodyImage?: (file: File) => Promise<string | null>;
  onFormatBlogRules?: () => Promise<string | null>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [uploadingBodyImg, setUploadingBodyImg] = useState(false);
  const [formatting, setFormatting] = useState(false);

  function wrap(before: string, after: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = body.slice(start, end) || "tekst";
    const newBody = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(newBody);
    // Restore selection after state update
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function wrapLine(prefix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    // Find line start
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    const line = body.slice(lineStart, body.indexOf("\n", start) === -1 ? body.length : body.indexOf("\n", start));
    // Toggle: if line already starts with prefix, remove it; else add it
    let newLine: string;
    if (line.startsWith(prefix)) {
      newLine = line.slice(prefix.length);
    } else {
      // Remove any other heading prefix first
      newLine = prefix + line.replace(/^#{1,4}\s*/, "");
    }
    const lineEnd = body.indexOf("\n", start) === -1 ? body.length : body.indexOf("\n", start);
    const newBody = body.slice(0, lineStart) + newLine + body.slice(lineEnd);
    setBody(newBody);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length); });
  }

  function insertLink() {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = body.slice(start, end) || "tekst";
    const href = prompt("Link URL:", "https://");
    if (!href) return;
    const md = `[${selected}](${href})`;
    const newBody = body.slice(0, start) + md + body.slice(end);
    setBody(newBody);
    requestAnimationFrame(() => { el.focus(); });
  }

  async function handleImageFile(file: File) {
    if (!onUploadBodyImage) return;
    const el = textareaRef.current;
    const cursorPos = el?.selectionStart ?? -1; // -1 = append to end
    setUploadingBodyImg(true);
    try {
      const url = await onUploadBodyImage(file);
      if (!url) return;
      const altText = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      const md = `\n![${altText}](${url})\n`;
      // IMPORTANT: use functional setter — multiple rapid uploads race against
      // each other if we read `body` from closure. Each call must compose on
      // top of the latest state, not the state when this handler was scheduled.
      let insertedAt = 0;
      setBody(prev => {
        const pos = cursorPos >= 0 && cursorPos <= prev.length ? cursorPos : prev.length;
        insertedAt = pos + md.length;
        return prev.slice(0, pos) + md + prev.slice(pos);
      });
      requestAnimationFrame(() => {
        if (el) { el.focus(); el.setSelectionRange(insertedAt, insertedAt); }
      });
    } finally {
      setUploadingBodyImg(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  }

  const btnStyle: React.CSSProperties = {
    padding: "5px 10px", border: "1px solid #e6e6e6", borderRadius: 7,
    background: "white", color: "#5a6b6c", fontSize: 12, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit", lineHeight: 1,
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4,
        padding: "6px 10px", background: "#f9f9f7", border: "1.5px solid #e6e6e6",
        borderBottom: "none", borderRadius: "12px 12px 0 0",
      }}>
        <button type="button" title="Paks tekst (Ctrl+B)" style={btnStyle} onClick={() => wrap("**", "**")}><strong>B</strong></button>
        <button type="button" title="Kaldkiri (Ctrl+I)" style={btnStyle} onClick={() => wrap("*", "*")}><em>I</em></button>
        <button type="button" title="Pealkiri H2" style={btnStyle} onClick={() => wrapLine("## ")}>H2</button>
        <button type="button" title="Pealkiri H3" style={btnStyle} onClick={() => wrapLine("### ")}>H3</button>
        <button type="button" title="Lisa link" style={{ ...btnStyle, display: "flex", alignItems: "center", gap: 4 }} onClick={insertLink}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Link
        </button>
        <button type="button" title="Loetelu punkt" style={btnStyle} onClick={() => wrap("\n- ", "")}>• List</button>
        {onUploadBodyImage && (
          <>
            <button
              type="button"
              title="Lisa pilt artiklisse"
              style={{
                ...btnStyle,
                display: "flex", alignItems: "center", gap: 4,
                opacity: uploadingBodyImg ? 0.5 : 1,
                cursor: uploadingBodyImg ? "not-allowed" : "pointer",
              }}
              disabled={uploadingBodyImg}
              onClick={() => imgInputRef.current?.click()}
            >
              {uploadingBodyImg ? (
                <span style={{ fontSize: 11 }}>⏳</span>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              )}
              Pilt
            </button>
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
            />
          </>
        )}
        {onFormatBlogRules && (
          <button
            type="button"
            title="Vorminda tekst blogi standardiga (H2-d, lõigud, lühikirjeldus)"
            disabled={formatting}
            onClick={async () => {
              setFormatting(true);
              try { await onFormatBlogRules(); } finally { setFormatting(false); }
            }}
            style={{
              ...btnStyle,
              display: "flex", alignItems: "center", gap: 4,
              background: formatting ? "#f0fde4" : "#87be23",
              color: formatting ? "#3d6b00" : "white",
              border: "1px solid #87be23",
              opacity: formatting ? 0.7 : 1,
              cursor: formatting ? "wait" : "pointer",
            }}
          >
            {formatting ? "⏳ Vormindan…" : "✨ Vorminda"}
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#c0c0b8", alignSelf: "center", paddingRight: 4 }}>Markdown</span>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Artikli tekst..."
        rows={22}
        spellCheck
        style={{
          width: "100%", padding: "16px", fontSize: 15, lineHeight: 1.75,
          color: "#1a1a1a", border: "1.5px solid #e6e6e6", borderRadius: "0 0 16px 16px",
          background: "white", outline: "none", resize: "vertical",
          boxSizing: "border-box", fontFamily: "inherit", minHeight: 400,
        }}
        onFocus={e => {
          e.target.style.borderColor = "#87be23";
          const prev = e.target.previousElementSibling as HTMLElement | null;
          if (prev) { prev.style.borderColor = "#87be23"; prev.style.borderBottomColor = "transparent"; }
        }}
        onBlur={e => {
          e.target.style.borderColor = "#e6e6e6";
          const prev = e.target.previousElementSibling as HTMLElement | null;
          if (prev) { prev.style.borderColor = "#e6e6e6"; prev.style.borderBottomColor = "transparent"; }
        }}
      />
    </div>
  );
}

// ─── Drag-to-reposition crop control ─────────────────────────────────────────
// Editor drags the image inside a fixed-aspect-ratio frame.
// Internally tracks X/Y as percentages (0–100) → CSS object-position.

function DragCrop({
  src,
  focalPoint,
  onFocalPointChange,
}: {
  src: string;
  focalPoint: string;
  onFocalPointChange: (fp: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startPct = useRef({ x: 50, y: 50 });

  // Parse current focalPoint ("X% Y%" or named e.g. "center center")
  function parsePct(fp: string): { x: number; y: number } {
    const named: Record<string, number> = { left: 0, center: 50, right: 100, top: 0, bottom: 100 };
    const parts = fp.trim().split(/\s+/);
    const parseOne = (s: string) => {
      if (s.endsWith("%")) return parseFloat(s);
      return named[s] ?? 50;
    };
    if (parts.length === 1) return { x: parseOne(parts[0]), y: 50 };
    return { x: parseOne(parts[0]), y: parseOne(parts[1]) };
  }

  function toCssValue(pct: { x: number; y: number }): string {
    return `${Math.round(pct.x)}% ${Math.round(pct.y)}%`;
  }

  const pct = parsePct(focalPoint);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    isDragging.current = true;
    startMouse.current = { x: e.clientX, y: e.clientY };
    startPct.current = parsePct(focalPoint);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Drag direction: dragging right moves focal point left (image shifts right)
    const dxPct = ((e.clientX - startMouse.current.x) / rect.width) * 100;
    const dyPct = ((e.clientY - startMouse.current.y) / rect.height) * 100;
    const newX = Math.max(0, Math.min(100, startPct.current.x - dxPct));
    const newY = Math.max(0, Math.min(100, startPct.current.y - dyPct));
    onFocalPointChange(toCssValue({ x: newX, y: newY }));
  }

  function onMouseUp() {
    isDragging.current = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  // Touch support
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    isDragging.current = true;
    startMouse.current = { x: t.clientX, y: t.clientY };
    startPct.current = parsePct(focalPoint);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!isDragging.current || !containerRef.current) return;
    const t = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const dxPct = ((t.clientX - startMouse.current.x) / rect.width) * 100;
    const dyPct = ((t.clientY - startMouse.current.y) / rect.height) * 100;
    const newX = Math.max(0, Math.min(100, startPct.current.x - dxPct));
    const newY = Math.max(0, Math.min(100, startPct.current.y - dyPct));
    onFocalPointChange(toCssValue({ x: newX, y: newY }));
  }

  function onTouchEnd() { isDragging.current = false; }

  return (
    <div style={{ marginTop: 8 }}>
      {/* Crop frame — 3:2 ratio, same as PostCard */}
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          width: "100%", aspectRatio: "3/2", borderRadius: 8,
          border: "1px solid #e6e6e6", overflow: "hidden",
          position: "relative", background: "#f5f2ec",
          cursor: "grab", userSelect: "none",
        }}
        title="Lohista pilti, et valida kärpimisel nähtav osa"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            width: "100%", height: "100%",
            objectFit: "cover",
            objectPosition: `${Math.round(pct.x)}% ${Math.round(pct.y)}%`,
            display: "block", pointerEvents: "none",
          }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        {/* Drag hint overlay */}
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          opacity: 0, transition: "opacity 0.2s",
          pointerEvents: "none",
        }} className="drag-hint">
          <span style={{
            background: "rgba(0,0,0,0.55)", color: "white",
            padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
          }}>✥ Lohista</span>
        </div>
      </div>

      {/* Hint text + focal point readout */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 5 }}>
        <p style={{ margin: 0, fontSize: 11, color: "#9a9a9a" }}>
          ✥ <strong>Lohista</strong> pilti, et valida nähtav osa · kaart kärbitakse 3:2 suhtes
        </p>
        <button
          type="button"
          onClick={() => onFocalPointChange("50% 50%")}
          title="Lähtesta keskmisele"
          style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 6,
            border: "1px solid #e6e6e6", background: "white",
            color: "#9a9a9a", cursor: "pointer", fontFamily: "inherit",
            visibility: focalPoint === "50% 50%" || focalPoint === "center center" ? "hidden" : "visible",
          }}
        >Lähtesta</button>
      </div>

      <style>{`
        div[title="Lohista pilti, et valida kärpimisel nähtav osa"]:hover .drag-hint { opacity: 1 !important; }
        div[title="Lohista pilti, et valida kärpimisel nähtav osa"]:active { cursor: grabbing !important; }
      `}</style>
    </div>
  );
}

// ─── Markdown → HTML renderer (client-side, no dependencies) ─────────────────

function mdToHtml(md: string): string {
  if (!md) return "";
  let html = md
    // YouTubeEmbed MDX component → responsive iframe
    .replace(/<YouTubeEmbed\s+url=["']([^"']+)["']\s*\/?>/gi, (_, url) => {
      const videoId = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)?.[1];
      if (!videoId) return "";
      return `<div style="position:relative;padding-bottom:56.25%;height:0;margin:2rem 0;border-radius:16px;overflow:hidden"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe></div>`;
    })
    // VimeoEmbed MDX component → responsive iframe
    .replace(/<VimeoEmbed\s+(?:id|url)=["']([^"']+)["']\s*\/?>/gi, (_, src) => {
      // Match either bare ID, vimeo.com/ID[/HASH], or player.vimeo.com/video/ID
      const m = src.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/);
      if (!m) return "";
      const id = m[1];
      const hash = m[2];
      const playerSrc = hash
        ? `https://player.vimeo.com/video/${id}?h=${hash}`
        : `https://player.vimeo.com/video/${id}`;
      return `<div style="position:relative;padding-bottom:56.25%;height:0;margin:2rem 0;border-radius:16px;overflow:hidden;background:#000"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" src="${playerSrc}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
    })
    // RendiaEmbed MDX component → placeholder (actual embed loads on published page)
    .replace(/<RendiaEmbed\s+id=["']([^"']+)["'][^/]*\/?>/gi, (_, id) => {
      return `<div style="position:relative;padding-bottom:56.25%;height:0;margin:2rem 0;border-radius:16px;overflow:hidden;background:#0a0a0a;display:flex;align-items:center;justify-content:center"><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px"><svg width="48" height="48" viewBox="0 0 24 24" fill="white" opacity="0.4"><path d="M8 5v14l11-7z"/></svg><span style="color:rgba(255,255,255,0.5);font-size:12px;font-family:sans-serif">Rendia video — nähtav avaldatud lehel</span><span style="color:rgba(255,255,255,0.3);font-size:11px;font-family:monospace">${id.slice(0, 8)}…</span></div></div>`;
    })
    // Headings
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Blockquote
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // HR
    .replace(/^---+$/gm, "<hr>")
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Images (before links)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="border-radius:16px;width:100%;height:auto;margin:2rem 0">')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#87BE23;text-decoration:underline">$1</a>')
    // Unordered lists
    .replace(/^[\-\*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul style="list-style:disc;padding-left:1.5rem;margin-bottom:1.375rem">${s}</ul>`)
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Code inline
    .replace(/`([^`]+)`/g, '<code style="background:#f0f0ec;border-radius:4px;padding:2px 6px;font-size:0.875em">$1</code>')
    // Double newlines → paragraphs
    .split(/\n\n+/)
    .map(block => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h[1-6]|ul|ol|blockquote|hr|img|figure|div|iframe)/.test(trimmed)) return trimmed;
      return `<p style="font-size:1.0625rem;font-weight:300;line-height:1.8;margin-bottom:1.375rem;color:#111">${trimmed.replace(/\n/g, " ")}</p>`;
    })
    .join("\n");
  return html;
}

// ─── Post Preview Component ───────────────────────────────────────────────────

function PostPreview({
  title, body, featuredImage, category, date, author, lang,
  onClose, onPublish, publishing,
}: {
  title: string; body: string; featuredImage: string;
  category: string; date: string; author: string; lang: string;
  onClose: () => void; onPublish?: () => void; publishing?: boolean;
}) {
  const dateLocale = lang === "ru" ? "ru-RU" : lang === "en" ? "en-GB" : "et-EE";
  const dateFormatted = date
    ? new Date(date).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })
    : "";
  const wordCount = body.trim().split(/\s+/).length;
  const readMins = Math.max(1, Math.round(wordCount / 200));
  const htmlBody = mdToHtml(body);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#FEFEFE", overflowY: "auto",
      fontFamily: "inherit",
    }}>
      {/* Preview banner */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#1a1a1a", color: "white",
        padding: "10px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            background: "#87be23", color: "white",
            fontSize: 11, fontWeight: 800, padding: "3px 10px",
            borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.08em",
          }}>Eelvaade</span>
          <span style={{ fontSize: 13, color: "#9a9a9a", fontWeight: 300 }}>
            See on eelvaade — postitus pole veel avaldatud
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            padding: "8px 18px", borderRadius: 10, border: "1.5px solid #444",
            background: "transparent", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            ✏️ Tagasi redigeerima
          </button>
          {onPublish && (
            <button onClick={onPublish} disabled={publishing} style={{
              padding: "8px 20px", borderRadius: 10, border: "none",
              background: publishing ? "#c5dfa0" : "#87be23",
              color: "white", fontSize: 13, fontWeight: 800,
              cursor: publishing ? "not-allowed" : "pointer",
              boxShadow: "0 2px 10px rgba(135,190,35,0.3)",
            }}>
              {publishing ? "Avaldan…" : "✓ Avalda see postitus"}
            </button>
          )}
        </div>
      </div>

      {/* Simulated blog nav */}
      <div style={{
        borderBottom: "1px solid #E6E4DF", padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 60, maxWidth: 1140, margin: "0 auto",
      }}>
        <span style={{ fontSize: 14, color: "#5a6b6c", fontWeight: 300 }}>← ksa.ee</span>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>KSA <span style={{ color: "#87be23" }}>Blog</span></span>
        <span style={{
          padding: "8px 20px", borderRadius: 99, background: "#87be23",
          color: "white", fontSize: 13, fontWeight: 700,
        }}>Broneeri aeg</span>
      </div>

      {/* Article content */}
      <article style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 120px" }}>
        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9a9a9a", marginBottom: 32 }}>
          <span>Blog</span>
          {category && <><span>›</span><span style={{ color: "#87be23" }}>{category}</span></>}
        </nav>

        {/* Header */}
        <header style={{ marginBottom: 32 }}>
          {category && (
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#87be23", display: "block", marginBottom: 12 }}>
              {category}
            </span>
          )}
          <h1 style={{
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 600,
            letterSpacing: "-0.03em", lineHeight: 1.15,
            margin: "0 0 16px", color: "#000",
          }}>{title || "Pealkiri puudub"}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "#9a9a9a", flexWrap: "wrap" }}>
            {dateFormatted && <span>{dateFormatted}</span>}
            {author && <><span>·</span><span>{author}</span></>}
            <span>·</span>
            <span>{readMins} min</span>
          </div>
        </header>

        {/* Featured image */}
        {featuredImage && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 32, aspectRatio: "16/9", background: "#F5F2EC" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={featuredImage}
              alt={title}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        )}

        {/* Body */}
        <div
          className="prose-ksa"
          dangerouslySetInnerHTML={{ __html: htmlBody }}
        />

        {/* CTA preview */}
        <div style={{
          marginTop: 40, padding: "24px 28px", background: "#f8fdf0",
          border: "1.5px solid #c5e58a", borderRadius: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}>
          <div>
            <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15 }}>Kas sinu nägemine vajab kontrolli?</p>
            <p style={{ margin: 0, fontSize: 13, color: "#5a6b6c", fontWeight: 300 }}>Tee tasuta kiirtest — 2 minutit.</p>
          </div>
          <span style={{
            padding: "12px 24px", borderRadius: 99, background: "#87be23",
            color: "white", fontSize: 14, fontWeight: 700,
          }}>Tee kiirtest →</span>
        </div>
      </article>
    </div>
  );
}

// ─── Publish Success Screen ───────────────────────────────────────────────────

function PublishSuccessScreen({ slug, onBack }: { slug: string; onBack: () => void }) {
  const blogUrl = `https://blog.ksa.ee/${slug}`;

  return (
    <div style={{ maxWidth: 520, margin: "60px auto", padding: "0 24px", textAlign: "center" }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a", margin: "0 0 8px" }}>
        Postitus avaldatud!
      </h2>
      <p style={{ color: "#6b7280", fontSize: 15, marginBottom: 28, fontWeight: 300 }}>
        Fail on GitHubis ja blogi ehitab end uuesti (~2 min). Võid kohe edasi töötada.
      </p>

      {/* Info box */}
      <div style={{
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
        borderRadius: 14, padding: "14px 18px", marginBottom: 24, textAlign: "left",
      }}>
        <p style={{ margin: 0, fontSize: 13, color: "#166534", lineHeight: 1.6 }}>
          Kui avad linki kohe ja näed 404 — see on normaalne. Vercel lõpetab ehitamise paari minutiga ja postitus ilmub automaatselt.
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={onBack} style={{
          padding: "13px 24px", border: "2px solid #e6e6e6", borderRadius: 14,
          background: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", color: "#5a6b6c",
        }}>← Tagasi</button>
        {slug && (
          <a
            href={blogUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "13px 24px", borderRadius: 14,
              background: "#87be23",
              color: "white", fontSize: 15, fontWeight: 700, textDecoration: "none",
              boxShadow: "0 4px 16px rgba(135,190,35,0.25)",
            }}
          >Vaata postitust →</a>
        )}
      </div>
    </div>
  );
}

// ─── Drafts List ──────────────────────────────────────────────────────────────

function DraftsTab() {
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [langFilter, setLangFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DraftMeta | null>(null);

  const loadDrafts = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/drafts")
      .then(r => r.json())
      .then((d: { drafts?: DraftMeta[] }) => { setDrafts(d.drafts ?? []); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  const filtered = drafts.filter(d => {
    if (langFilter !== "all" && d.lang !== langFilter) return false;
    if (search.trim()) return d.title.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  if (selected) {
    return <DraftEditor draft={selected} onBack={() => { setSelected(null); loadDrafts(); }} onPublished={loadDrafts} />;
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 60px" }}>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {(["all", "et", "ru", "en"] as const).map(l => (
          <button key={l} onClick={() => setLangFilter(l)} style={{
            padding: "8px 18px", borderRadius: 24, border: "2px solid",
            borderColor: langFilter === l ? "#87be23" : "#e6e6e6",
            background: langFilter === l ? "#87be23" : "white",
            color: langFilter === l ? "white" : "#5a6b6c",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>
            {l === "all" ? `Kõik (${drafts.length})` : `${l.toUpperCase()} (${drafts.filter(d => d.lang === l).length})`}
          </button>
        ))}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Otsi pealkirja..."
          style={{
            flex: 1, minWidth: 180, padding: "8px 14px", border: "2px solid #e6e6e6",
            borderRadius: 24, fontSize: 14, outline: "none", background: "white",
          }}
        />
      </div>

      {/* States */}
      {loading && <div style={{ textAlign: "center", padding: "60px 0", color: "#9a9a9a", fontSize: 15 }}>Laen mustandeid…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p style={{ color: "#9a9a9a", fontSize: 15 }}>
            {drafts.length === 0 ? "Mustandeid pole veel. Loo uus!" : "Otsing ei andnud tulemusi."}
          </p>
        </div>
      )}

      {/* Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(draft => (
          <div key={draft.path} style={{
            background: "white", border: "2px solid #f0f0ec", borderRadius: 18,
            padding: "18px 20px", display: "flex", alignItems: "center", gap: 16,
            cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#87be23"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 16px rgba(135,190,35,0.12)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#f0f0ec"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
            onClick={() => setSelected(draft)}
          >
            <LangBadge lang={draft.lang} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {draft.title || "(pealkiri puudub)"}
                </p>
                {draft.status === "medical_review" && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                    background: "#fff3e0", color: "#e65100", border: "1px solid #ffcc80", flexShrink: 0 }}>
                    🏥 Arsti laud
                  </span>
                )}
                {draft.deadline && draft.deadline < new Date().toISOString().split("T")[0] && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                    background: "#ffebee", color: "#c62828", border: "1px solid #ef9a9a", flexShrink: 0 }}>
                    ⚠ Tähtaeg ületatud
                  </span>
                )}
                {draft.deadline && draft.deadline >= new Date().toISOString().split("T")[0] && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
                    background: "#f5f5f5", color: "#666", border: "1px solid #ddd", flexShrink: 0 }}>
                    📅 {draft.deadline}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#9a9a9a", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {draft.excerpt}
                </p>
                {draft.assignedTo && (
                  <span style={{ fontSize: 11, color: "#9a9a9a", background: "#f5f5f5",
                    padding: "1px 7px", borderRadius: 6, flexShrink: 0, whiteSpace: "nowrap" }}>
                    {ASSIGNEE_LABELS[draft.assignedTo] ?? draft.assignedTo}
                  </span>
                )}
              </div>
            </div>
            <div style={{ color: "#87be23", fontSize: 20, fontWeight: 800, flexShrink: 0 }}>→</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Published Posts Tab ──────────────────────────────────────────────────────

function PublishedTab() {
  const [posts, setPosts] = useState<DraftMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [langFilter, setLangFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DraftMeta | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid" | "preview">("list");
  const [quickEditDatePath, setQuickEditDatePath] = useState<string | null>(null);
  const [quickDateValue, setQuickDateValue] = useState("");
  const [quickDateSaving, setQuickDateSaving] = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  async function saveQuickDate(post: DraftMeta, newDate: string) {
    if (!newDate || newDate === post.date) { setQuickEditDatePath(null); return; }
    setQuickDateSaving(true);
    try {
      const endpoint = `/api/admin/post?path=${encodeURIComponent(post.path)}`;
      const readRes = await fetch(endpoint);
      if (!readRes.ok) throw new Error("Lugemine ebaõnnestus");
      const { content } = await readRes.json() as { content: string };
      // Update date field in frontmatter
      const updated = content.replace(/^date:\s*.+$/m, `date: "${newDate}"`);
      // Stage into batch queue — flushed together via "Uuenda kõik"
      enqueue({ path: post.path, content: updated, title: post.title });
      // Update local state so card reflects new date immediately
      setPosts(prev => prev.map(p => p.path === post.path ? { ...p, date: newDate } : p));
    } catch (err) {
      alert("Kuupäeva muutmine ebaõnnestus: " + (err as Error).message);
    } finally {
      setQuickDateSaving(false);
      setQuickEditDatePath(null);
    }
  }

  const loadPosts = useCallback(() => {
    setLoading(true); setFailed(false);
    fetch("/api/admin/posts")
      .then(r => { if (!r.ok) throw new Error("not ok"); return r.json(); })
      .then((d: { posts?: DraftMeta[] }) => { setPosts(d.posts ?? []); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // Duplicate detection: group by normalised title, flag any group with 2+ posts
  const titleGroups: Record<string, string[]> = {};
  posts.forEach(p => {
    const key = p.title.toLowerCase().replace(/[^a-z0-9äöüõа-яё]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!titleGroups[key]) titleGroups[key] = [];
    titleGroups[key].push(p.path);
  });
  const duplicatePaths = new Set<string>();
  Object.values(titleGroups).forEach(paths => { if (paths.length > 1) paths.forEach(p => duplicatePaths.add(p)); });

  const q = search.trim().toLowerCase();
  const filtered = posts.filter(p => {
    if (langFilter !== "all" && p.lang !== langFilter) return false;
    if (q) return (
      p.title.toLowerCase().includes(q) ||
      (p.excerpt ?? "").toLowerCase().includes(q) ||
      (p.slug ?? "").toLowerCase().includes(q)
    );
    return true;
  });

  if (selected) {
    return <DraftEditor draft={selected} onBack={() => setSelected(null)} onPublished={loadPosts} isPublished={true} />;
  }

  return (
    <div style={{ maxWidth: viewMode === "preview" ? "100%" : viewMode === "grid" ? 1140 : 760, margin: "0 auto", padding: viewMode === "preview" ? "24px 20px 0" : "24px 20px 60px" }}>
      {/* ── Top bar: lang filters | count | view toggle ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {/* Lang filter pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
          {(["all", "et", "ru", "en"] as const).map(l => (
            <button key={l} onClick={() => setLangFilter(l)} style={{
              padding: "6px 16px", borderRadius: 20, border: "1.5px solid",
              borderColor: langFilter === l ? "#87be23" : "#e6e6e6",
              background: langFilter === l ? "#87be23" : "white",
              color: langFilter === l ? "white" : "#5a6b6c",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              {l === "all" ? "Kõik" : l.toUpperCase()}
            </button>
          ))}
          <span style={{ fontSize: 13, color: "#9a9a9a", alignSelf: "center", marginLeft: 4 }}>
            {filtered.length} artiklit{langFilter !== "all" ? ` (${posts.length} kokku)` : ""}
          </span>
          {duplicatePaths.size > 0 && (
            <span style={{ fontSize: 12, background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, padding: "4px 10px", color: "#856404", fontWeight: 600 }}>
              ⚠ {duplicatePaths.size} duplikaati
            </span>
          )}
        </div>
        {/* View mode toggle */}
        <div style={{ display: "flex", border: "1.5px solid #e6e6e6", borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
          {([
            { v: "list", label: "Nimekiri" },
            { v: "grid", label: "Kaardid" },
            { v: "preview", label: "Live" },
          ] as const).map(({ v, label }) => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              padding: "6px 14px", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: viewMode === v ? "#87be23" : "white",
              color: viewMode === v ? "white" : "#9a9a9a",
            }}>{label}</button>
          ))}
        </div>
      </div>
      <Stats7dTile />
      {/* Search row */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Otsi pealkirja, väljavõtet või slug'i…"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "9px 16px", border: "1.5px solid #e6e6e6", borderRadius: 10,
            fontSize: 13, outline: "none", background: "white", color: "#1a1a1a",
          }}
          onFocus={e => { e.target.style.borderColor = "#87be23"; }}
          onBlur={e => { e.target.style.borderColor = "#e6e6e6"; }}
        />
      </div>

      {loading && <div style={{ textAlign: "center", padding: "60px 0", color: "#9a9a9a", fontSize: 15 }}>Laen postitusi…</div>}
      {!loading && failed && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9a9a9a", fontSize: 15 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔌</div>
          Avaldatud postituste laadimine ebaõnnestus
        </div>
      )}
      {!loading && !failed && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p style={{ color: "#9a9a9a", fontSize: 15 }}>{posts.length === 0 ? "Avaldatud postitusi ei leitud." : "Otsing ei andnud tulemusi."}</p>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map(post => {
            const isDup = duplicatePaths.has(post.path);
            const isHovered = hoveredPath === post.path;
            return (
              <div key={post.path} style={{
                background: "white",
                border: `1.5px solid ${isDup ? "#ffc107" : isHovered ? "#87be23" : "#f0f0ec"}`,
                borderRadius: 12, padding: "12px 18px",
                display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer",
                boxShadow: isHovered ? "0 2px 16px rgba(135,190,35,0.10)" : "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
                onMouseEnter={() => setHoveredPath(post.path)}
                onMouseLeave={() => setHoveredPath(null)}
                onClick={() => setSelected(post)}
              >
                <LangBadge lang={post.lang} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {post.title || "(pealkiri puudub)"}
                    </p>
                    {isDup && <span style={{ fontSize: 10, background: "#ffc107", color: "#000", borderRadius: 4, padding: "1px 5px", fontWeight: 800, flexShrink: 0 }}>DUPLIKAAT</span>}
                  </div>
                </div>
                {post.category && (
                  <span style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 600, color: "#3d6b00",
                    background: "#edf7d6", border: "1px solid #c5e58a",
                    borderRadius: 20, padding: "2px 10px",
                  }}>{post.category}</span>
                )}
                <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
                  {quickEditDatePath === post.path ? (
                    <input
                      type="date"
                      value={quickDateValue}
                      autoFocus
                      onChange={e => setQuickDateValue(e.target.value)}
                      onBlur={() => saveQuickDate(post, quickDateValue)}
                      onKeyDown={e => {
                        if (e.key === "Enter") saveQuickDate(post, quickDateValue);
                        if (e.key === "Escape") setQuickEditDatePath(null);
                      }}
                      style={{ fontSize: 11, border: "1.5px solid #87be23", borderRadius: 6, padding: "2px 6px", outline: "none" }}
                    />
                  ) : (
                    <span
                      title="Klõpsa kuupäeva muutmiseks"
                      onClick={() => { setQuickEditDatePath(post.path); setQuickDateValue(post.date ?? ""); }}
                      style={{ fontSize: 11, color: "#b0b0aa", cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 2 }}
                    >
                      {post.date}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: isHovered ? "#87be23" : "#9a9a9a", fontWeight: 700, flexShrink: 0, transition: "color 0.15s" }}>Redigeeri →</span>
              </div>
            );
          })}
        </div>
      )}

      {/* GRID / EDITORIAL CARD VIEW */}
      {viewMode === "grid" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {filtered.map(post => {
            const isDup = duplicatePaths.has(post.path);
            const isHovered = hoveredPath === post.path;
            const liveUrl = `https://blog.ksa.ee/${post.slug ?? post.path.replace(/^content\/posts\//, "").replace(/\.mdx?$/, "")}`;
            const excerptOrCat = post.excerpt || post.category || "";
            return (
              <article key={post.path} style={{
                background: "white",
                border: `1.5px solid ${isDup ? "#ffc107" : isHovered ? "#87be23" : "#ebebeb"}`,
                borderRadius: 16, overflow: "hidden", cursor: "pointer",
                boxShadow: isHovered ? "0 8px 32px rgba(0,0,0,0.12)" : "0 1px 4px rgba(0,0,0,0.04)",
                display: "flex", flexDirection: "column",
                transform: isHovered ? "translateY(-2px)" : "none",
                transition: "box-shadow 0.18s, border-color 0.18s, transform 0.18s",
              }}
                onMouseEnter={() => setHoveredPath(post.path)}
                onMouseLeave={() => setHoveredPath(null)}
                onClick={() => setSelected(post)}
              >
                {/* Thumbnail with hover overlay */}
                <div style={{ position: "relative", aspectRatio: "3/2", background: "#f5f2ec", overflow: "hidden", flexShrink: 0 }}>
                  {post.featuredImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.featuredImage} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 36, opacity: 0.35 }}>👁</span>
                    </div>
                  )}
                  {/* Hover edit overlay */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0.42)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: isHovered ? 1 : 0,
                    transition: "opacity 0.18s",
                    pointerEvents: "none",
                  }}>
                    <span style={{ color: "white", fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>✎ Redigeeri</span>
                  </div>
                  {/* Lang badge top-left */}
                  <div style={{ position: "absolute", top: 10, left: 10 }}>
                    <LangBadge lang={post.lang} />
                  </div>
                  {/* Duplicate badge top-right */}
                  {isDup && (
                    <span style={{
                      position: "absolute", top: 10, right: 10,
                      fontSize: 10, background: "#ffc107", color: "#000",
                      borderRadius: 6, padding: "2px 7px", fontWeight: 800,
                    }}>DUPLIKAAT</span>
                  )}
                </div>

                {/* Card body */}
                <div style={{ padding: "14px 16px 12px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <p style={{
                    margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.35,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    {post.title || "(pealkiri puudub)"}
                  </p>
                  <p style={{
                    margin: "0 0 12px", fontSize: 12, color: "#9a9a9a", lineHeight: 1.5, flex: 1,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    {excerptOrCat}
                  </p>

                  {/* Footer */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div onClick={e => e.stopPropagation()}>
                      {quickEditDatePath === post.path ? (
                        <input
                          type="date"
                          value={quickDateValue}
                          autoFocus
                          onChange={e => setQuickDateValue(e.target.value)}
                          onBlur={() => saveQuickDate(post, quickDateValue)}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveQuickDate(post, quickDateValue);
                            if (e.key === "Escape") setQuickEditDatePath(null);
                          }}
                          style={{ fontSize: 11, border: "1.5px solid #87be23", borderRadius: 6, padding: "2px 6px", outline: "none", color: "#1a1a1a" }}
                        />
                      ) : (
                        <span
                          title="Klõpsa kuupäeva muutmiseks"
                          onClick={() => { setQuickEditDatePath(post.path); setQuickDateValue(post.date ?? ""); }}
                          style={{ fontSize: 11, color: "#b0b0aa", cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 2 }}
                        >
                          {post.date}
                        </span>
                      )}
                    </div>
                    <a href={liveUrl} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: 11, color: "#5a6b6c", textDecoration: "none", padding: "3px 9px", border: "1px solid #e6e6e6", borderRadius: 6, fontWeight: 600 }}>
                      Live ↗
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* LIVE PREVIEW — iframe of blog.ksa.ee */}
      {viewMode === "preview" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontSize: 13, color: "#9a9a9a" }}>
              Live blogi — muudatused ilmuvad peale järgmist deploy&apos;i (~2 min pärast salvestamist)
            </p>
            <a
              href="https://blog.ksa.ee"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: "#87be23", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}
            >
              Ava uues aknas ↗
            </a>
          </div>
          <div style={{ border: "2px solid #e6e6e6", borderRadius: 16, overflow: "hidden", background: "#f5f2ec" }}>
            <div style={{ background: "#f0ede8", borderBottom: "1px solid #e6e6e6", padding: "8px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", gap: 5 }}>
                {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              </div>
              <div style={{ flex: 1, background: "white", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "#9a9a9a", border: "1px solid #e6e6e6" }}>
                blog.ksa.ee
              </div>
              <a href="https://blog.ksa.ee" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: "#5a6b6c", textDecoration: "none", fontWeight: 600 }}>↗</a>
            </div>
            <iframe
              src="https://blog.ksa.ee"
              title="KSA Blog live preview"
              style={{ width: "100%", height: "calc(100vh - 240px)", minHeight: 600, border: "none", display: "block" }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Write New ────────────────────────────────────────────────────────────────

function WriteTab() {
  // ── Mode selection ────────────────────────────────────────────────────────
  const [mode, setMode] = useState<"choose" | "direct" | "ai">("choose");

  // ── Direct save state ─────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [lang, setLang] = useState("et");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedFile, setSavedFile] = useState<{ filename: string; title: string; lang: string } | null>(null);

  // ── AI generation state ───────────────────────────────────────────────────
  const [brief, setBrief] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlFetching, setUrlFetching] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [languages, setLanguages] = useState(["et", "ru", "en"]);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<PostResult[]>([]);
  const [genError, setGenError] = useState("");

  function toggleLang(l: string) {
    setLanguages(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  }

  function resetAll() {
    setMode("choose"); setTitle(""); setBody(""); setLang("et");
    setSaving(false); setSaveError(""); setSavedFile(null);
    setBrief(""); setUrlInput(""); setUrlError(""); setLanguages(["et", "ru", "en"]);
    setGenerating(false); setResults([]); setGenError("");
  }

  // ── Direct save handler ───────────────────────────────────────────────────
  async function saveDirect(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true); setSaveError("");
    try {
      const res = await fetch("/api/admin/save-raw-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), lang }),
      });
      let d: { ok?: boolean; filename?: string; title?: string; lang?: string; error?: string };
      try { d = await res.json(); } catch { throw new Error(`Server viga (${res.status})`); }
      if (!res.ok || d.error) { setSaveError(d.error ?? `HTTP ${res.status}`); return; }
      setSavedFile({
        filename: d.filename ?? `${title.trim().slice(0, 40)}.mdx`,
        title: d.title ?? title.trim(),
        lang: d.lang ?? lang,
      });
    } catch (err) {
      console.error("saveDirect error:", err);
      setSaveError((err as Error).message ?? "Tundmatu viga");
    }
    finally { setSaving(false); }
  }

  // ── AI generation handlers ────────────────────────────────────────────────
  async function fetchUrl() {
    if (!urlInput.trim()) return;
    setUrlFetching(true); setUrlError("");
    try {
      const res = await fetch(`/api/admin/fetch-url?url=${encodeURIComponent(urlInput.trim())}`);
      const d = await res.json() as { text?: string; title?: string; error?: string };
      if (d.error) { setUrlError(d.error); return; }
      setBrief(`Allikas: ${d.title ?? urlInput}\nURL: ${urlInput}\n\n${d.text ?? ""}`);
    } catch (e) { setUrlError((e as Error).message); }
    finally { setUrlFetching(false); }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setBrief(`Fail: ${file.name}\n\n${ev.target?.result as string}`); };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    if (!brief.trim() || languages.length === 0) return;
    setGenerating(true); setGenError(""); setResults([]);
    try {
      const res = await fetch("/api/write-post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief.trim(), languages }),
      });
      const d = await res.json() as { results?: PostResult[]; errors?: { lang: string; error: string }[] };
      setResults(d.results ?? []);
      if ((d.results ?? []).length === 0) setGenError("Genereerimine ebaõnnestus. Proovi uuesti.");
    } catch (e) { setGenError((e as Error).message); }
    finally { setGenerating(false); }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE: Choose
  // ═══════════════════════════════════════════════════════════════════════════
  if (mode === "choose") {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px" }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#000", textAlign: "center", marginBottom: 8 }}>
          Uus postitus
        </h2>
        <p style={{ color: "#9a9a9a", textAlign: "center", marginBottom: 40, fontSize: 15, fontWeight: 300 }}>
          Kuidas soovid luua?
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Option 1: Direct — paste your own text */}
          <button onClick={() => setMode("direct")} style={{
            padding: "28px 28px", border: "2px solid #87be23", borderRadius: 20,
            background: "#f8fdf0", cursor: "pointer", textAlign: "left",
            display: "flex", alignItems: "center", gap: 20, transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(135,190,35,0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
          >
            <span style={{ fontSize: 40, lineHeight: 1 }}>📝</span>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#1a1a1a" }}>Salvesta otse mustandiks</p>
              <p style={{ margin: 0, fontSize: 14, color: "#6b7280", fontWeight: 300 }}>
                Kirjuta või kleebi oma tekst — läheb mustandisse täpselt nii nagu on
              </p>
            </div>
          </button>

          {/* Option 2: AI generation */}
          <button onClick={() => setMode("ai")} style={{
            padding: "28px 28px", border: "2px solid #e6e4df", borderRadius: 20,
            background: "white", cursor: "pointer", textAlign: "left",
            display: "flex", alignItems: "center", gap: 20, transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#c4b5fd"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(139,92,246,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e6e4df"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
          >
            <span style={{ fontSize: 40, lineHeight: 1 }}>🤖</span>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#1a1a1a" }}>AI kirjutab</p>
              <p style={{ margin: 0, fontSize: 14, color: "#6b7280", fontWeight: 300 }}>
                Anna idee, link või märkmed — AI genereerib artikli
              </p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE: Direct — saved successfully
  // ═══════════════════════════════════════════════════════════════════════════
  if (mode === "direct" && savedFile) {
    const langColor = LANG_COLORS[savedFile.lang ?? "et"] ?? LANG_COLORS.et;
    const langLabel = (savedFile.lang ?? "et").toUpperCase();
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", margin: "0 0 8px" }}>
          Mustand salvestatud!
        </h2>
        <p style={{ color: "#9a9a9a", fontSize: 14, marginBottom: 28, fontWeight: 300 }}>
          Tekst on nüüd mustandites täpselt nii nagu kirjutasid.
        </p>

        <div style={{
          background: "white", border: `2px solid ${langColor.border}`, borderRadius: 16,
          padding: "18px 22px", display: "flex", alignItems: "center", gap: 14, marginBottom: 28, textAlign: "left",
        }}>
          <span style={{
            padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: langColor.bg, color: langColor.text, border: `1px solid ${langColor.border}`,
            flexShrink: 0,
          }}>{langLabel}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: "#1a1a1a",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {savedFile.title ?? "(pealkiri)"}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#9a9a9a", fontWeight: 300 }}>
              {savedFile.filename ?? "mustand"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setSavedFile(null); setTitle(""); setBody(""); }} style={{
            flex: 1, padding: "14px", border: "2px solid #87be23", borderRadius: 14,
            background: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", color: "#3d6b00",
          }}>+ Kirjuta veel</button>
          <button onClick={resetAll} style={{
            flex: 1, padding: "14px", border: "2px solid #e6e4df", borderRadius: 14,
            background: "white", fontSize: 15, fontWeight: 600, cursor: "pointer", color: "#6b7280",
          }}>← Tagasi</button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE: Direct — editor
  // ═══════════════════════════════════════════════════════════════════════════
  if (mode === "direct") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 80px" }}>
        <button onClick={resetAll} style={{
          background: "none", border: "none", color: "#9a9a9a", cursor: "pointer",
          fontSize: 14, fontWeight: 600, marginBottom: 24, padding: 0,
        }}>← Tagasi</button>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#000", marginBottom: 4 }}>
          Salvesta otse mustandiks
        </h2>
        <p style={{ color: "#9a9a9a", fontSize: 14, marginBottom: 28, fontWeight: 300 }}>
          Tekst läheb mustandisse täpselt nii nagu kirjutad — ilma AI töötluseta.
        </p>

        <form onSubmit={saveDirect}>
          {/* Title */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Pealkiri *
            </label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Artikli pealkiri"
              style={{
                width: "100%", padding: "14px 16px", fontSize: 16, fontWeight: 600,
                border: "2px solid #e6e4df", borderRadius: 14, background: "white",
                outline: "none", fontFamily: "inherit", boxSizing: "border-box",
              }}
              onFocus={e => { e.target.style.borderColor = "#87be23"; }}
              onBlur={e => { e.target.style.borderColor = "#e6e4df"; }}
            />
          </div>

          {/* Language */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Keel
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["et", "ru", "en"] as const).map(l => {
                const on = lang === l;
                const c = LANG_COLORS[l];
                return (
                  <button key={l} type="button" onClick={() => setLang(l)} style={{
                    flex: 1, padding: "12px 0", border: `2px solid ${on ? c.border : "#e6e4df"}`,
                    borderRadius: 12, background: on ? c.bg : "white", color: on ? c.text : "#9a9a9a",
                    fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {LANG_NAME[l]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Tekst * <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— Markdown on toetatud (## pealkiri, **paks**, *kaldkiri*)</span>
            </label>
            <textarea value={body} onChange={e => setBody(e.target.value)}
              placeholder="Kirjuta või kleebi oma tekst siia...&#10;&#10;Tekst läheb mustandisse täpselt nii nagu on."
              rows={18} spellCheck
              style={{
                width: "100%", padding: "16px", fontSize: 15, lineHeight: 1.75,
                border: "2px solid #e6e4df", borderRadius: 16, background: "white",
                outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
              }}
              onFocus={e => { e.target.style.borderColor = "#87be23"; }}
              onBlur={e => { e.target.style.borderColor = "#e6e4df"; }}
            />
            {body.trim() && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9a9a9a", fontWeight: 300, textAlign: "right" }}>
                ~{body.trim().split(/\s+/).length} sõna
              </p>
            )}
          </div>

          {saveError && <p style={{ color: "#b91c1c", fontSize: 14, marginBottom: 12 }}>⚠ {saveError}</p>}

          <button type="submit" disabled={saving || !title.trim() || !body.trim()} style={{
            width: "100%", padding: "18px", border: "none", borderRadius: 16,
            background: saving || !title.trim() || !body.trim() ? "#d1d5db" : "#87be23",
            color: "white", fontSize: 17, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer",
            transition: "all 0.15s",
            boxShadow: saving || !title.trim() || !body.trim() ? "none" : "0 4px 16px rgba(135,190,35,0.22)",
          }}>
            {saving ? "Salvestan…" : "💾 Salvesta mustandiks"}
          </button>
        </form>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE: AI — results
  // ═══════════════════════════════════════════════════════════════════════════
  if (mode === "ai" && results.length > 0) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", margin: "0 0 8px" }}>
            {results.length} postitus{results.length !== 1 ? "t" : ""} loodud!
          </h2>
          <p style={{ color: "#9a9a9a", fontSize: 14, fontWeight: 300 }}>
            Need ootavad nüüd toimetaja ülevaatust &quot;Mustandid&quot; all.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {results.map(r => (
            <div key={r.lang} style={{
              background: "white", border: "2px solid #f0f0ec", borderRadius: 16, padding: "16px 18px",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <LangBadge lang={r.lang} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{r.title}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#9a9a9a" }}>{r.excerpt?.slice(0, 80)}…</p>
              </div>
            </div>
          ))}
        </div>

        <button onClick={resetAll} style={{
          width: "100%", padding: "15px", border: "2px solid #e6e4df", borderRadius: 14,
          background: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", color: "#5a6b6c",
        }}>← Tagasi</button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE: AI — editor
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 80px" }}>
      <button onClick={resetAll} style={{
        background: "none", border: "none", color: "#9a9a9a", cursor: "pointer",
        fontSize: 14, fontWeight: 600, marginBottom: 24, padding: 0,
      }}>← Tagasi</button>

      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#000", marginBottom: 4 }}>
        AI kirjutab artikli
      </h2>
      <p style={{ color: "#9a9a9a", fontSize: 14, marginBottom: 28, fontWeight: 300 }}>
        Anna idee, link, fail või märkmed — AI kirjutab valmis artikli.
      </p>

      {/* Source inputs: URL + file upload */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, display: "flex", gap: 8 }}>
          <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); fetchUrl(); } }}
            placeholder="Kleebi link (valikuline)…"
            style={{ flex: 1, padding: "10px 14px", border: "2px solid #e6e4df", borderRadius: 12, fontSize: 13, outline: "none", fontFamily: "inherit" }}
          />
          <button onClick={fetchUrl} disabled={urlFetching || !urlInput.trim()} style={{
            padding: "10px 14px", border: "none", borderRadius: 12,
            background: urlFetching ? "#d1d5db" : "#5a6b6c", color: "white",
            fontSize: 13, fontWeight: 700, cursor: urlFetching ? "not-allowed" : "pointer",
          }}>{urlFetching ? "…" : "Tõmba"}</button>
        </div>
        <label style={{
          padding: "10px 14px", border: "2px solid #e6e4df", borderRadius: 12,
          background: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#5a6b6c",
          display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
        }}>
          📁 Fail
          <input type="file" accept=".txt,.md,.mdx,.csv" onChange={handleFile} style={{ display: "none" }} />
        </label>
      </div>
      {urlError && <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>⚠ {urlError}</p>}

      <form onSubmit={generate}>
        {/* Brief */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Idee / märkmed / sisu
          </label>
          <textarea value={brief} onChange={e => setBrief(e.target.value)}
            placeholder="Kirjuta idee, märkmed või kleebi tekst mille põhjal AI artikli kirjutab…"
            rows={10} spellCheck
            style={{
              width: "100%", padding: "16px", fontSize: 15, lineHeight: 1.7,
              border: "2px solid #e6e4df", borderRadius: 16, background: "white",
              outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
            }}
            onFocus={e => { e.target.style.borderColor = "#87be23"; }}
            onBlur={e => { e.target.style.borderColor = "#e6e4df"; }}
          />
        </div>

        {/* Language */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Keeled
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["et", "ru", "en"] as const).map(l => {
              const on = languages.includes(l);
              const c = LANG_COLORS[l];
              return (
                <button key={l} type="button" onClick={() => toggleLang(l)} style={{
                  flex: 1, padding: "12px 0", border: `2px solid ${on ? c.border : "#e6e4df"}`,
                  borderRadius: 12, background: on ? c.bg : "white", color: on ? c.text : "#9a9a9a",
                  fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                }}>
                  {LANG_NAME[l]}
                  {on && <span style={{ display: "block", fontSize: 16 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {genError && <p style={{ color: "#b91c1c", fontSize: 14, marginBottom: 12 }}>⚠ {genError}</p>}

        <button type="submit" disabled={generating || !brief.trim() || languages.length === 0} style={{
          width: "100%", padding: "18px", border: "none", borderRadius: 16,
          background: generating || !brief.trim() || languages.length === 0 ? "#d1d5db" : "#7c3aed",
          color: "white", fontSize: 17, fontWeight: 800, cursor: generating ? "not-allowed" : "pointer",
          transition: "all 0.15s",
        }}>
          {generating ? `AI kirjutab ${languages.length} postitust…` : `🤖 Genereeri ${languages.length > 1 ? `${languages.length} postitust` : "postitus"}`}
        </button>
      </form>
    </div>
  );
}

// ─── Prompt Tab ───────────────────────────────────────────────────────────────

function PromptTab() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/prompt")
      .then(r => r.json())
      .then((d: { content?: string; error?: string }) => {
        if (d.content) setContent(d.content);
        else setError(d.error ?? "Viga laadimisel");
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true); setSaved(false); setError("");
    try {
      const res = await fetch("/api/admin/prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (d.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
      else setError(d.error ?? "Salvestamine ebaõnnestus");
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 20px 120px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "#1a1a1a" }}>
            📝 Sisureeglid — AI kirjutamisjuhend
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "#9a9a9a", lineHeight: 1.5, maxWidth: 560 }}>
            See prompt käivitub iga kord kui AI kirjutab uue postituse — mustandid, skautimisest saadud artiklid, partii genereerimine.
            Muuda neid reegleid vastavalt vajadusele ja salvesta. Muutused jõustuvad kohe.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          {saved && <span style={{ fontSize: 14, color: "#3d6b00", fontWeight: 600 }}>✓ Salvestatud</span>}
          {error && <span style={{ fontSize: 13, color: "#b91c1c" }}>⚠ {error}</span>}
          <button onClick={save} disabled={saving || loading} style={{
            padding: "10px 24px", border: "none", borderRadius: 12,
            background: saving ? "#c5dfa0" : "#87be23", color: "white",
            fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
          }}>{saving ? "Salvestab…" : "Salvesta muudatused"}</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9a9a9a" }}>Laen…</div>
      ) : (
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          spellCheck={false}
          style={{
            width: "100%", minHeight: 700, padding: "20px", fontSize: 13,
            lineHeight: 1.65, color: "#1a1a1a", border: "2px solid #e6e6e6",
            borderRadius: 16, background: "white", outline: "none",
            resize: "vertical", boxSizing: "border-box",
            fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",
          }}
          onFocus={e => { e.target.style.borderColor = "#87be23"; }}
          onBlur={e => { e.target.style.borderColor = "#e6e6e6"; }}
        />
      )}

      <div style={{ marginTop: 14, padding: "14px 18px", background: "#f9f9f7", borderRadius: 12, border: "1px solid #e6e6e6" }}>
        <p style={{ margin: 0, fontSize: 13, color: "#5a6b6c", lineHeight: 1.6 }}>
          <strong>Kuidas toimib:</strong> AI loeb seda dokumenti enne iga uue artikli kirjutamist.
          Keelereegleid, tooni, meditsiinilise keele poliitikat ja struktuurijuhiseid saad siin täiendada.
          Muudatused jõustuvad koheselt — järgmine genereeritud mustand järgib juba uusi reegleid.
        </p>
      </div>
    </div>
  );
}

// ─── Help Tab ─────────────────────────────────────────────────────────────────

function HelpTab() {
  const s = {
    h2: { fontSize: 18, fontWeight: 800, color: "#1a1a1a", margin: "32px 0 10px", paddingBottom: 8, borderBottom: "1px solid #f0f0ec" } as React.CSSProperties,
    h3: { fontSize: 14, fontWeight: 700, color: "#1a1a1a", margin: "20px 0 6px" } as React.CSSProperties,
    p: { fontSize: 14, color: "#5a6b6c", lineHeight: 1.7, margin: "0 0 10px" } as React.CSSProperties,
    tip: { background: "#f4fae8", border: "1px solid #d4e8a8", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#3a5a10", margin: "10px 0" } as React.CSSProperties,
    table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13, margin: "10px 0" },
    th: { textAlign: "left" as const, padding: "8px 12px", background: "#f5f3ee", fontWeight: 700, color: "#5a6b6c", borderRadius: 0 },
    td: { padding: "8px 12px", borderBottom: "1px solid #f0f0ec", color: "#1a1a1a", verticalAlign: "top" as const },
    code: { background: "#f0f0ec", borderRadius: 4, padding: "1px 6px", fontFamily: "monospace", fontSize: 12, color: "#1a1a1a" } as React.CSSProperties,
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "8px 20px 80px" }}>

      {/* Intro */}
      <div style={{ background: "linear-gradient(135deg,#f4fae8,#edf7f0)", borderRadius: 16, padding: "20px 24px", margin: "24px 0 0" }}>
        <p style={{ margin: 0, fontSize: 15, color: "#3a5a10", lineHeight: 1.6 }}>
          <strong>KSA Blogi toimetajad:</strong> Silvia Johanna Haavel (ET) · Jana (RU, EN)<br />
          <strong>Aadress:</strong> blog.ksa.ee/admin &nbsp;·&nbsp; <strong>Parool:</strong> küsi Antsult
        </p>
      </div>

      {/* Section 1 */}
      <h2 style={s.h2}>1. Mustandi avaldamine</h2>
      <p style={s.p}>Mustandid asuvad <strong>Mustandid</strong> vahekaardil. Kõik mustandid kirjutab Ants käsitsi — nii on kvaliteet ja faktid kontrolli all.</p>
      <table style={s.table}>
        <tbody>
          {[
            ["1", "Vali keelefilter", "ET · RU · EN"],
            ["2", "Klõpsa mustandil", "Avaneb redaktor"],
            ["3", "Kontrolli pealkiri, kuupäev, pilt, tekst", "Paranda vajadusel"],
            ["4", "Salvesta", "Jätab mustandiks"],
            ["5", "✓ Avalda", "Ilmub kohe blogis"],
          ].map(([n, action, result]) => (
            <tr key={n}>
              <td style={{ ...s.td, width: 28, fontWeight: 800, color: "#87be23" }}>{n}</td>
              <td style={{ ...s.td, fontWeight: 600 }}>{action}</td>
              <td style={{ ...s.td, color: "#9a9a9a" }}>{result}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={s.tip}>
        💡 <strong>Ajastamine:</strong> märgi tulevane kuupäev — postitus ilmub automaatselt sellel päeval.<br />
        💡 <strong>Tagasiajastamine:</strong> märgi möödunud kuupäev — postitus ilmub ajaloos õiges kohas.
      </div>

      {/* Section 2 */}
      <h2 style={s.h2}>2. Uue postituse kirjutamine</h2>
      <p style={s.p}>Klõpsa vahekaardil <strong>Kirjuta uus</strong>. Vali sisu allikas:</p>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Viis</th>
            <th style={s.th}>Millal kasutada</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Kirjuta ise", "Tead täpselt mida tahad öelda"],
            ["Kleebi URL", "Leidsid hea artikli — süsteem loeb & kirjutab KSA vaatenurgast"],
            ["Laadi fail", "Sul on olemasolev tekst (Word, PDF)"],
          ].map(([v, k]) => (
            <tr key={v}>
              <td style={{ ...s.td, fontWeight: 600, whiteSpace: "nowrap" }}>{v}</td>
              <td style={s.td}>{k}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={s.p}>Seejärel kirjuta lühikokkuvõte, vali keeled (ET / RU / EN — saab kõik 3 korraga) → <strong>Genereeri</strong>. ~30 sekundit ja mustand on valmis.</p>

      {/* Section 3 */}
      <h2 style={s.h2}>3. Pilt ja video</h2>
      <h3 style={s.h3}>Kaanepilt — optimaalne suurus</h3>
      <table style={s.table}>
        <tbody>
          {[
            ["Kuvasuhe", "3:2 (nt 1500 × 1000 px)"],
            ["Maksimaalne laius", "1400 px (süsteem pakib suurema automaatselt kokku)"],
            ["Formaat", "WebP eelistatud, aga JPEG/PNG sobib (teisendatakse WebP-ks)"],
            ["Faili suurus enne üleslaadimist", "Alla 1 MB piisab — süsteem pakib ~150–300 KB-ni"],
            ["Kvaliteet", "80–85% (süsteem kasutab 0.82)"],
          ].map(([k, v]) => (
            <tr key={k}>
              <td style={{ ...s.td, fontWeight: 600, width: "45%" }}>{k}</td>
              <td style={s.td}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={s.tip}>
        💡 <strong>Lihtne reegel:</strong> pane <strong>1500×1000 JPEG alla 1 MB</strong> — süsteem teeb ülejäänu. Pärast üleslaadimist saab pilti 3:2 kaadris lohistada, et õige osa oleks nähtav.
      </div>
      <div style={s.tip}>
        ⚡ <strong>Mitu pilti korraga:</strong> laadi kõik pildid üles järjest — iga pildi üleslaadimine EI salvesta enam automaatselt, nii et saad töötada kiiresti. Kui kõik on paigas, klõpsa <strong>Salvesta</strong> või <strong>Uuenda live</strong> üks kord — kõik muudatused salvestuvad koos. Nii ei kao ükski pilt vahepeal ära.
      </div>
      <h3 style={s.h3}>Pildi allikas</h3>
      <p style={s.p}>Laadi oma pilt üles, või kleebi URL <strong>Pildiaadress</strong> lahtrisse. KSA pildid leiab: <span style={s.code}>ksa.ee/wp-content/uploads/…</span></p>
      <h3 style={s.h3}>Pilt teksti sees</h3>
      <p style={s.p}>Redaktoris kasuta tööriistariba nuppu <strong>🖼 Pilt</strong> — laadib üles ja lisab pildi kursori asukohta.</p>
      <h3 style={s.h3}>Pildi SEO nimi</h3>
      <p style={s.p}>Enne pildi üleslaadimist kirjuta <strong>pildi-seo-nimi</strong> lahtrisse (nt <span style={s.code}>ksa-laseroperatsioon-kornea</span>). Pilt saab automaatselt SEO-sõbraliku faili nime kujul <span style={s.code}>ksa-laseroperatsioon-kornea-ksa-silmakeskus.webp</span>. Kui jätad tühjaks, kasutatakse faili originaalnime.</p>
      <h3 style={s.h3}>YouTube video</h3>
      <p style={s.p}>Kleebi YouTube link redaktori ülaosas olevasse lahtrisse → <strong>Lisa video</strong>. Video ilmub teksti sisse.</p>
      <h3 style={s.h3}>Rendia video</h3>
      <p style={s.p}>Lisa Rendia patsiendiharidusvideo artiklisse MDX komponendiga: <span style={s.code}>{"<RendiaEmbed id=\"UUID\" />"}</span>. UUID leiad Rendia Embed Managerist (<strong>{"</>"}  nupust</strong>). Eelvaates näed tumedat kohahoidjat — päris video ilmub avaldatud lehel.</p>
      <h3 style={s.h3}>Otsing blogis</h3>
      <p style={s.p}>Blogi otsinguikoon (🔍) on igas lehe päises — viib <span style={s.code}>blog.ksa.ee/otsing</span> lehele, kus saab otsida kõigist 930+ artiklist pealkirja, väljavõtte, kategooria ja märksõnade järgi. Keelefilter (ET / RU / EN) on samuti olemas.</p>

      {/* Section 3.5 — Delete */}
      <h2 style={s.h2}>4. Artikli kustutamine</h2>
      <p style={s.p}>Blogis on kaks seisundit: <strong>mustand</strong> (ei ole avalikus blogis) ja <strong>avaldatud</strong> (nähtav blog.ksa.ee-s). Kustutamise loogika erineb vastavalt.</p>

      <h3 style={s.h3}>A) Mustandi kustutamine</h3>
      <table style={s.table}>
        <tbody>
          {[
            ["1", "Ava Mustandid vahekaart", "Vali keel (ET · RU · EN)"],
            ["2", "Klõpsa mustandil", "Avaneb redaktor"],
            ["3", "Klõpsa prügikasti ikoon (🗑)", "Päises paremal"],
            ["4", "Kinnita kustutamine", "Fail kaob jäädavalt"],
          ].map(([n, action, result]) => (
            <tr key={n}>
              <td style={{ ...s.td, width: 28, fontWeight: 800, color: "#b91c1c" }}>{n}</td>
              <td style={{ ...s.td, fontWeight: 600 }}>{action}</td>
              <td style={{ ...s.td, color: "#9a9a9a" }}>{result}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={s.h3}>B) Avaldatud artikli kustutamine</h3>
      <p style={s.p}>Avaldatud artiklit ei saa otse kustutada — kaheastmeline protsess:</p>
      <table style={s.table}>
        <tbody>
          {[
            ["1", "Ava Avaldatud vahekaart", "Leia artikkel (Nimekiri või Koduleht vaade)"],
            ["2", "Klõpsa artiklil — avaneb redaktor", ""],
            ["3", "Klõpsa ↩ Eemalda (all paremal)", "Artikkel kaob blogist ja liigub tagasi mustanditesse"],
            ["4", "Mine Mustandid vahekaardile", "Leia sama artikkel"],
            ["5", "Ava see ja klõpsa 🗑", "Fail kaob jäädavalt"],
          ].map(([n, action, result]) => (
            <tr key={n}>
              <td style={{ ...s.td, width: 28, fontWeight: 800, color: "#b91c1c" }}>{n}</td>
              <td style={{ ...s.td, fontWeight: 600 }}>{action}</td>
              <td style={{ ...s.td, color: "#9a9a9a" }}>{result}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={s.tip}>
        💡 <strong>Millal ainult eemaldada (mitte kustutada)?</strong> Kui artikkel on ajutiselt ebatäpne või vajab ümbertöötamist — jätab see mustanditesse, et saad hiljem uuesti avaldada. Täielik kustutamine on pöördumatu.
      </div>
      <div style={s.tip}>
        ⚠️ <strong>Ettevaatust:</strong> kustutatud artikli URL (blog.ksa.ee/slug) annab edaspidi 404. Kui artikkel on olnud avalikus blogis kaua, võib sellele olla väliseid linke — kaalu enne kustutamist, kas eemaldamine (mustandiks) on ohutum.
      </div>

      {/* Section 5 */}
      <h2 style={s.h2}>5. Nipid</h2>
      <table style={s.table}>
        <tbody>
          {[
            ["Postitus vajab arsti kinnitust", "Lisa märge tekstis + teavita Antsu"],
            ["Viga avaldatud postituses", "Teavita Antsu — ta parandab faili otse"],
            ["Mustand on halb", "Kustuta mustand (vt. 4A) → kirjuta uus"],
            ["Avaldatud artikkel on dubleeritud või vale", "Eemalda → kustuta mustand (vt. 4B)"],
            ["Taha postitus ajutiselt peita", "Muuda kuupäev tulevikku — kaob avalikust vaatest"],
          ].map(([olukord, lahendus]) => (
            <tr key={olukord}>
              <td style={{ ...s.td, fontWeight: 600, width: "45%" }}>{olukord}</td>
              <td style={s.td}>{lahendus}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Section 6 — Keyboard shortcuts on blog.ksa.ee */}
      <h2 style={s.h2}>6. Klaviatuuri otseteed artiklilehel</h2>
      <p style={s.p}>
        Kui loed artiklit blog.ksa.ee-s, liiguvad nooleklahvid lehel nii:
      </p>
      <table style={s.table}>
        <tbody>
          {[
            ["→ (parem nool)", "Järgmine artikkel samas keeles (vanem)"],
            ["← (vasak nool)", "Eelmine artikkel samas keeles (uuem)"],
            ["↑ (üles)", "Tagasi lehe ülaosa"],
            ["↓ (alla)", "Hüppa Smart CTA-le (broneerimiskast)"],
          ].map(([key, action]) => (
            <tr key={key}>
              <td style={{ ...s.td, fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap", width: "38%" }}>{key}</td>
              <td style={s.td}>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={s.tip}>
        💡 Sequents järgib kuupäeva: parem nool = vanemad artiklid, vasak nool = uuemad. Otseteed ei tööta, kui kirjutad tekstikasti ega siis, kui hoiad all ⌘/Ctrl/Alt/Shift.
      </div>

      {/* Section 7 */}
      <h2 style={s.h2}>7. Mida süsteem teeb automaatselt</h2>
      <table style={s.table}>
        <tbody>
          {[
            ["Iga avaldamine", "Sitemap uueneb, Schema JSON-LD lisatakse automaatselt"],
            ["Pildi üleslaadimine", "Pakitakse WebP-ks (~150–300 KB), säilitab fookuspunkti"],
            ["Tuleviku kuupäev", "Postitus ilmub õigel päeval ilma sinupoolse tegevuseta"],
          ].map(([trigger, action]) => (
            <tr key={trigger}>
              <td style={{ ...s.td, fontWeight: 600, whiteSpace: "nowrap", width: "38%" }}>{trigger}</td>
              <td style={s.td}>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
}

// ─── CTA Tab ──────────────────────────────────────────────────────────────────

function CTATab() {
  return <CTATabInner />;
}

// ─── Root Admin Page ──────────────────────────────────────────────────────────

// Bumped whenever we ship a critical admin-side fix. Bump this constant to
// force browsers with stale JS bundles to reload on their next visit. This is
// the single belt between "I shipped a fix" and "the editor is actually using
// it" — without this, a long-open tab can keep writing with old buggy code.
const ADMIN_BUILD = "2026-04-23-1";

export default function AdminPage() {
  const [tab, setTab] = useState<"drafts" | "published" | "write" | "cta" | "prompt" | "help">("drafts");

  // Force-reload when the deployed admin build is newer than the one loaded.
  // Runs once on mount + every 5 min — picks up mid-session deploys too.
  useEffect(() => {
    function check() {
      const stored = localStorage.getItem("ksa_admin_build");
      if (stored && stored !== ADMIN_BUILD) {
        localStorage.setItem("ksa_admin_build", ADMIN_BUILD);
        // Hard reload, bypassing cache
        window.location.reload();
        return;
      }
      if (!stored) localStorage.setItem("ksa_admin_build", ADMIN_BUILD);
    }
    check();
    const iv = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  async function logout() {
    await fetch("/api/admin/logout");
    window.location.href = "/admin/login";
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f7", fontFamily: "inherit" }}>
      {/* Header */}
      <div style={{
        background: "white", borderBottom: "1px solid #e6e6e6",
        padding: "0 24px", display: "flex", alignItems: "stretch",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 24, borderRight: "1px solid #f0f0ec" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: "#87be23",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="white"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#87be23", letterSpacing: "0.12em", textTransform: "uppercase" }}>KSA Blog</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>Admin</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", flex: 1, paddingLeft: 8 }}>
          {([
            { id: "drafts", label: "Mustandid" },
            { id: "published", label: "Avaldatud" },
            { id: "write", label: "Kirjuta uus" },
            { id: "cta", label: "CTA-d" },
            { id: "prompt", label: "Sisureeglid" },
            { id: "help", label: "Juhend" },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "0 20px", border: "none",
              borderBottom: tab === t.id ? "3px solid #87be23" : "3px solid transparent",
              background: "none",
              color: tab === t.id ? "#87be23" : "#9a9a9a",
              fontSize: 14, fontWeight: 700,
              cursor: "pointer", minHeight: 56, transition: "color 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="https://blog.ksa.ee" style={{ fontSize: 13, color: "#9a9a9a", textDecoration: "none" }}>← Blog</a>
          <button onClick={logout} style={{
            padding: "6px 14px", border: "1px solid #e6e6e6", borderRadius: 8,
            background: "white", color: "#9a9a9a", fontSize: 13, cursor: "pointer",
          }}>Logi välja</button>
        </div>
      </div>

      <BatchQueueBanner />

      <DailyGreeting />

      {tab === "drafts" ? <DraftsTab /> : tab === "published" ? <PublishedTab /> : tab === "write" ? <WriteTab /> : tab === "cta" ? <CTATab /> : tab === "prompt" ? <PromptTab /> : <HelpTab />}
    </div>
  );
}

// ─── Batch-edit queue banner ──────────────────────────────────────────────────
// Shows count of staged published-post edits + single-click flush via one
// GitHub commit (= one Vercel rebuild). Dismissible individual rows, cancel all.

function BatchQueueBanner() {
  const [queue, setLocalQueue] = useState<QueuedEdit[]>([]);
  const [flushing, setFlushing] = useState(false);
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    setLocalQueue(getQueue());
    function onChange() { setLocalQueue(getQueue()); }
    window.addEventListener("ksa-batch-queue-change", onChange);
    window.addEventListener("storage", onChange); // cross-tab sync
    return () => {
      window.removeEventListener("ksa-batch-queue-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  async function flushAll() {
    if (!queue.length || flushing) return;
    if (!confirm(`Saadan ${queue.length} muudatust live'i ühe commitina. Vercel ehitab uuesti ~2 min. Jätkan?`)) return;
    setFlushing(true);
    try {
      const res = await fetch("/api/admin/batch-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: queue.map(q => ({ path: q.path, content: q.content })),
          message: `Batch edit: ${queue.length} post${queue.length === 1 ? "" : "s"}`,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; commit?: string };
      if (!res.ok || !data.ok) {
        alert(`Uuendamine ebaõnnestus: ${data.error ?? res.status}`);
        return;
      }
      clearQueue();
      setLocalQueue([]);
      setOpen(false);
      setCountdown(120);
      const tick = setInterval(() => {
        setCountdown(prev => { if (prev <= 1) { clearInterval(tick); return 0; } return prev - 1; });
      }, 1000);
    } catch (err) {
      alert("Võrguviga: " + (err as Error).message);
    } finally {
      setFlushing(false);
    }
  }

  function cancelAll() {
    if (!confirm(`Tühistan ${queue.length} järjekorras muudatust. Kindel?`)) return;
    clearQueue();
    setLocalQueue([]);
    setOpen(false);
  }

  if (countdown > 0) {
    return (
      <div style={{
        background: "#e7f6d5", borderBottom: "1.5px solid #87be23",
        padding: "10px 24px", color: "#3d6b00", fontSize: 13, fontWeight: 700,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        ✓ Muudatused saadetud live'i. Vercel ehitab uuesti — {countdown}s
      </div>
    );
  }

  if (!queue.length) return null;

  return (
    <div style={{
      background: "#fff8e1", borderBottom: "1.5px solid #ffd54f",
      position: "sticky", top: 0, zIndex: 90,
    }}>
      <div style={{
        padding: "10px 24px", display: "flex", alignItems: "center",
        gap: 12, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#7a5800" }}>
          📦 {queue.length} muudatus{queue.length === 1 ? "" : "t"} järjekorras
        </span>
        <button
          onClick={() => setOpen(!open)}
          style={{
            padding: "5px 10px", border: "1px solid #e6c568", borderRadius: 7,
            background: "white", color: "#7a5800", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
        >
          {open ? "Peida" : "Näita"} nimekirja
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={cancelAll}
            disabled={flushing}
            style={{
              padding: "7px 14px", border: "1px solid #e6c568", borderRadius: 8,
              background: "white", color: "#7a5800", fontSize: 13, fontWeight: 700,
              cursor: flushing ? "not-allowed" : "pointer", opacity: flushing ? 0.5 : 1,
            }}
          >
            ✕ Tühista kõik
          </button>
          <button
            onClick={flushAll}
            disabled={flushing}
            style={{
              padding: "7px 16px", border: "none", borderRadius: 8,
              background: flushing ? "#c5dfa0" : "#87be23", color: "white",
              fontSize: 13, fontWeight: 800, cursor: flushing ? "not-allowed" : "pointer",
            }}
          >
            {flushing ? "Saadan…" : `✓ Uuenda kõik live (${queue.length})`}
          </button>
        </div>
      </div>
      {open && (
        <div style={{ padding: "0 24px 12px", borderTop: "1px dashed #e6c568" }}>
          {queue.map((q) => (
            <div key={q.path} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "6px 0", borderBottom: "1px solid #fef3c5", fontSize: 13,
            }}>
              <span style={{ flex: 1, color: "#1a1a1a" }}>{q.title || q.path}</span>
              <span style={{ color: "#9a9a9a", fontSize: 11 }}>{q.path.replace("content/posts/", "")}</span>
              <button
                onClick={() => { removeFromQueue(q.path); setLocalQueue(getQueue()); }}
                style={{
                  padding: "3px 8px", border: "1px solid #e6c568", borderRadius: 6,
                  background: "white", color: "#7a5800", fontSize: 11, cursor: "pointer",
                }}
              >
                eemalda
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type StatsRow = { slug: string; views: number; cta_views: number; cta_clicks: number; ctr_pct: number };

function Stats7dTile() {
  const [rows, setRows] = useState<StatsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stats-7d")
      .then(r => r.json())
      .then((d: { rows?: StatsRow[] }) => setRows(d.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const totalViews = rows.reduce((s, r) => s + (r.views ?? 0), 0);
  const totalCtaViews = rows.reduce((s, r) => s + (r.cta_views ?? 0), 0);
  const totalCtaClicks = rows.reduce((s, r) => s + (r.cta_clicks ?? 0), 0);
  const overallCtr = totalCtaViews > 0 ? Math.round((totalCtaClicks / totalCtaViews) * 1000) / 10 : 0;
  const top = expanded ? rows : rows.slice(0, 5);

  return (
    <div style={{
      background: "white", border: "1.5px solid #f0f0ec", borderRadius: 12,
      padding: 16, marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9a9a9a", fontWeight: 600 }}>
            Viimased 7 päeva
          </div>
          <div style={{ fontSize: 18, fontWeight: 500, marginTop: 4, color: "#1a1a1a" }}>
            {loading ? "…" : `${totalViews} vaatamist · ${overallCtr}% CTR`}
          </div>
        </div>
        {rows.length > 5 && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            style={{ background: "none", border: 0, color: "#87be23", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
          >
            {expanded ? "Näita vähem" : `Näita kõiki (${rows.length})`}
          </button>
        )}
      </div>
      {!loading && rows.length === 0 && (
        <div style={{ fontSize: 13, color: "#9a9a9a" }}>
          Statistika saadaval pärast esimesi külastusi (või Supabase pole konfigureeritud).
        </div>
      )}
      {top.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {top.map(r => (
            <div key={r.slug} style={{
              display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12,
              fontSize: 12, color: "#5a6b6c",
              padding: "6px 10px", background: "#fafaf7", borderRadius: 8,
            }}>
              <span style={{ fontFamily: "monospace", color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.slug}</span>
              <span>{r.views} vaat.</span>
              <span>{r.cta_clicks}/{r.cta_views} CTA</span>
              <span style={{ fontWeight: 600, color: r.ctr_pct >= 5 ? "#87be23" : "#5a6b6c" }}>{r.ctr_pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CTA Tab Inner ────────────────────────────────────────────────────────────

const FUNNEL_ORDER: Funnel[] = ["flow3", "audit", "kids", "dryeye", "general"];
const FUNNEL_LABELS: Record<Funnel, string> = {
  flow3: "Flow3",
  audit: "Audit",
  kids: "Lapsed",
  dryeye: "Kuiv silm",
  general: "Üldine",
};

function CTATabInner() {
  const [config, setConfig] = useState<Record<Funnel, CtaEntry> | null>(null);
  const [initial, setInitial] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [funnel, setFunnel] = useState<Funnel>("flow3");
  const [lang, setLang] = useState<CtaLang>("et");
  const [previewSlug] = useState("preview");

  useEffect(() => {
    fetch("/api/admin/cta-config")
      .then(r => r.json())
      .then((d: { config?: Record<Funnel, CtaEntry>; error?: string }) => {
        if (d.config) {
          setConfig(d.config);
          setInitial(JSON.stringify(d.config));
        } else {
          setError(d.error ?? "Viga laadimisel");
        }
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const dirty = config ? JSON.stringify(config) !== initial : false;

  function updateEntry(f: Funnel, patch: Partial<CtaEntry>) {
    if (!config) return;
    setConfig({ ...config, [f]: { ...config[f], ...patch } });
  }

  function updateOverride(f: Funnel, l: "ru" | "en", patch: Partial<CtaLangOverrides>) {
    if (!config) return;
    const cur = config[f][l] ?? {};
    const next = { ...cur, ...patch };
    // drop undefined/empty fields so fallback kicks in
    const cleaned: CtaLangOverrides = {};
    (Object.keys(next) as (keyof CtaLangOverrides)[]).forEach(k => {
      const v = next[k];
      if (v !== undefined && v !== "" && v !== null) (cleaned as Record<string, unknown>)[k] = v;
    });
    setConfig({
      ...config,
      [f]: { ...config[f], [l]: Object.keys(cleaned).length > 0 ? cleaned : undefined },
    });
  }

  async function save() {
    if (!config) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch("/api/admin/cta-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const d = await res.json() as { ok?: boolean; error?: string; needsRedeploy?: boolean };
      if (d.ok) {
        setInitial(JSON.stringify(config));
        setSaved(true);
        setTimeout(() => setSaved(false), 4000);
      } else {
        setError(d.error ?? "Salvestamine ebaõnnestus");
      }
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#9a9a9a" }}>Laen…</div>;
  if (!config) return <div style={{ padding: 60, textAlign: "center", color: "#b91c1c" }}>⚠ {error || "Konfiguratsiooni ei leitud"}</div>;

  const entry = config[funnel];
  const overrides: CtaLangOverrides = (lang === "et" ? {} : (entry[lang] ?? {}));

  // value resolver for the form: ET reads base, RU/EN read override (empty if unset)
  const v = (key: keyof CtaLangOverrides): string => {
    if (lang === "et") {
      const val = entry[key as keyof CtaEntry];
      return typeof val === "string" ? val : "";
    }
    const val = overrides[key];
    return typeof val === "string" ? val : "";
  };

  function setField(key: keyof CtaLangOverrides, value: string) {
    if (lang === "et") {
      updateEntry(funnel, { [key]: value } as Partial<CtaEntry>);
    } else {
      updateOverride(funnel, lang as "ru" | "en", { [key]: value });
    }
  }

  // stats editing
  const statsSource: [string, string][] = (lang === "et"
    ? entry.stats
    : (overrides.stats ?? entry.stats)) ?? [];

  function setStat(i: number, which: 0 | 1, val: string) {
    const next: [string, string][] = statsSource.map(s => [...s] as [string, string]);
    while (next.length < 3) next.push(["", ""]);
    next[i][which] = val;
    // trim trailing empty rows
    while (next.length > 0 && !next[next.length - 1][0] && !next[next.length - 1][1]) next.pop();
    if (lang === "et") {
      updateEntry(funnel, { stats: next });
    } else {
      updateOverride(funnel, lang as "ru" | "en", { stats: next.length > 0 ? next : undefined });
    }
  }

  const statRows: [string, string][] = statsSource.length > 0
    ? [...statsSource, ...Array(Math.max(0, 3 - statsSource.length)).fill(["", ""])]
    : [["", ""], ["", ""], ["", ""]];

  const input: React.CSSProperties = {
    width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #e6e6e6",
    borderRadius: 8, background: "white", outline: "none", fontFamily: "inherit",
    color: "#1a1a1a", boxSizing: "border-box",
  };
  const label: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 600, color: "#5a6b6c",
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
  };
  const fallbackHint = lang !== "et" ? " (tühjaks jättes kasutab ET)" : "";

  return (
    <div style={{ padding: "24px 20px 120px", maxWidth: 1600, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "#1a1a1a" }}>
            🎯 CTA-d — artikli footeri kutse
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "#9a9a9a", lineHeight: 1.5, maxWidth: 640 }}>
            Muuda pealkirju, hindu ja koode. Muudatused jõuavad artiklitele ~2 minuti jooksul (Vercel rebuild).
            RU/EN tühjad väljad langevad tagasi ET väärtustele.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {saved && <span style={{ fontSize: 13, color: "#3d6b00", fontWeight: 600 }}>✓ Salvestatud — Vercel rebuildib</span>}
          {error && <span style={{ fontSize: 13, color: "#b91c1c" }}>⚠ {error}</span>}
          <button onClick={save} disabled={saving || !dirty} style={{
            padding: "10px 22px", border: "none", borderRadius: 12,
            background: saving || !dirty ? "#c5dfa0" : "#87be23", color: "white",
            fontSize: 14, fontWeight: 700, cursor: saving || !dirty ? "not-allowed" : "pointer",
          }}>{saving ? "Salvestab…" : dirty ? "Salvesta" : "Muudatusi pole"}</button>
        </div>
      </div>

      {/* Funnel pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {FUNNEL_ORDER.map(f => (
          <button key={f} onClick={() => setFunnel(f)} style={{
            padding: "6px 14px", border: `1px solid ${funnel === f ? "#87be23" : "#e6e6e6"}`,
            borderRadius: 999, background: funnel === f ? "#edf7d6" : "white",
            color: funnel === f ? "#3d6b00" : "#5a6b6c", fontSize: 13, fontWeight: 600,
            cursor: "pointer",
          }}>
            {FUNNEL_LABELS[f]}
            {!config[f].live && <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.6 }}>off</span>}
          </button>
        ))}
      </div>

      {/* Language tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #e6e6e6" }}>
        {(["et", "ru", "en"] as const).map(l => (
          <button key={l} onClick={() => setLang(l)} style={{
            padding: "8px 16px", border: "none", background: "none",
            borderBottom: lang === l ? "3px solid #87be23" : "3px solid transparent",
            color: lang === l ? "#87be23" : "#9a9a9a",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>{l}</button>
        ))}
      </div>

      {/* Two-column: form + preview */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(420px, 1fr) minmax(520px, 1.3fr)", gap: 24 }}>
        {/* Form */}
        <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e6e6e6" }}>
          {/* Shared settings (ET only) */}
          {lang === "et" && (
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #f0f0ec" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                Jagatud seaded
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1a1a1a" }}>
                  <input type="checkbox" checked={!!entry.live} onChange={e => updateEntry(funnel, { live: e.target.checked })} />
                  <span>Live (näita artiklitel)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1a1a1a" }}>
                  <input type="checkbox" checked={!!entry.ladder} onChange={e => updateEntry(funnel, { ladder: e.target.checked })} />
                  <span>Ladder (kahe kaardi paigutus)</span>
                </label>
                <div>
                  <label style={label}>Accent-värv</label>
                  <input type="text" value={entry.accent ?? ""} onChange={e => updateEntry(funnel, { accent: e.target.value })} style={input} />
                </div>
                <div>
                  <label style={label}>Primary strike (läbikriipsutatud hind)</label>
                  <input type="text" value={entry.primaryStrike ?? ""} onChange={e => updateEntry(funnel, { primaryStrike: e.target.value || null })} style={input} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={label}>Primary href (broneerimislink)</label>
                  <input type="text" value={entry.primaryHref ?? ""} onChange={e => updateEntry(funnel, { primaryHref: e.target.value })} style={input} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={label}>Secondary href</label>
                  <input type="text" value={entry.secondaryHref ?? ""} onChange={e => updateEntry(funnel, { secondaryHref: e.target.value || null })} style={input} />
                </div>
                <div>
                  <label style={label}>Campaign (utm_campaign)</label>
                  <input type="text" value={entry.campaign ?? ""} onChange={e => updateEntry(funnel, { campaign: e.target.value || null })} style={input} />
                </div>
                <div>
                  <label style={label}>Valid until (YYYY-MM-DD)</label>
                  <input type="text" value={entry.validUntil ?? ""} onChange={e => updateEntry(funnel, { validUntil: e.target.value || null })} style={input} />
                </div>
              </div>
            </div>
          )}

          {/* Lang-specific fields */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Tekstid — {lang.toUpperCase()}{fallbackHint}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={label}>Eyebrow</label>
              <input type="text" value={v("eyebrow")} onChange={e => setField("eyebrow", e.target.value)} style={input} />
            </div>
            <div>
              <label style={label}>Headline</label>
              <textarea value={v("headline")} onChange={e => setField("headline", e.target.value)} rows={2} style={{ ...input, fontFamily: "inherit", resize: "vertical" }} />
            </div>
            <div>
              <label style={label}>Sub (alateksti)</label>
              <textarea value={v("sub")} onChange={e => setField("sub", e.target.value)} rows={2} style={{ ...input, fontFamily: "inherit", resize: "vertical" }} />
            </div>

            <div>
              <label style={label}>Stats (kuni 3 paari)</label>
              <div style={{ display: "grid", gap: 6 }}>
                {statRows.slice(0, 3).map(([val, lbl], i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <input type="text" placeholder={`Stat ${i + 1} väärtus`} value={val} onChange={e => setStat(i, 0, e.target.value)} style={input} />
                    <input type="text" placeholder={`Stat ${i + 1} silt`} value={lbl} onChange={e => setStat(i, 1, e.target.value)} style={input} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label style={label}>Primary label (peamine nupp)</label>
              <input type="text" value={v("primaryLabel")} onChange={e => setField("primaryLabel", e.target.value)} style={input} />
            </div>
            <div>
              <label style={label}>Primary sub (all-tekst)</label>
              <input type="text" value={v("primarySub")} onChange={e => setField("primarySub", e.target.value)} style={input} />
            </div>
            <div>
              <label style={label}>Secondary label</label>
              <input type="text" value={v("secondaryLabel")} onChange={e => setField("secondaryLabel", e.target.value)} style={input} />
            </div>
            <div>
              <label style={label}>Secondary sub</label>
              <input type="text" value={v("secondarySub")} onChange={e => setField("secondarySub", e.target.value)} style={input} />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Elav eelvaade — {lang.toUpperCase()}
          </div>
          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #e6e6e6", background: "#1a1a1a" }}>
            <SmartCTA funnel={funnel} slug={previewSlug} lang={lang} configOverride={config} />
          </div>
          <p style={{ marginTop: 10, fontSize: 12, color: "#9a9a9a", lineHeight: 1.5 }}>
            Eelvaade kasutab sama SmartCTA komponenti nagu artiklid. Muudatused kuvatakse kohe, kuid salvestamata.
          </p>
        </div>
      </div>
    </div>
  );
}
