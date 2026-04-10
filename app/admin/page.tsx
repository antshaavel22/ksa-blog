"use client";

import { useState, useEffect, useCallback, useRef, FormEvent } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftMeta {
  filename: string;
  path: string;
  title: string;
  excerpt: string;
  lang: string;
  date: string;
  slug?: string;
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
  const quoted = `${key}: "${value.replace(/"/g, '\\"')}"`;
  const re = new RegExp(`^${key}:.*$`, "m");
  return re.test(fm) ? fm.replace(re, quoted) : fm + `\n${quoted}`;
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
  const [category, setCategory] = useState("");

  // Review panel state
  const [langChecked, setLangChecked] = useState(false);
  const [needsMedical, setNeedsMedical] = useState<"yes" | "no" | null>(null);
  const [medicalSent, setMedicalSent] = useState(false);
  const [sendingMedical, setSendingMedical] = useState(false);

  // Assignment state
  const [assignedTo, setAssignedTo] = useState(draft.assignedTo ?? "");
  const [deadline, setDeadline] = useState(draft.deadline ?? "");
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
          const rawCat = getFmField(parsed.frontmatter, "categories")?.replace(/[\[\]"]/g, "").split(",")[0]?.trim() ?? "";
          setCategory(rawCat);
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
    if (category) fm = setFmField(fm, "categories", category);
    if (focalPoint && focalPoint !== "center center") {
      fm = setFmField(fm, "imageFocalPoint", focalPoint);
    }
    if (assignedTo) fm = setFmField(fm, "assignedTo", assignedTo);
    if (deadline) fm = setFmField(fm, "deadline", deadline);
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

  // Compress image in the browser using Canvas before uploading
  // This keeps the payload small (~150–300 KB) regardless of original file size
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

      const formData = new FormData();
      formData.append("image", blob, file.name.replace(/\.[^.]+$/, "") + ".webp");
      formData.append("originalName", file.name);
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

      // AUTO-SAVE the draft immediately with the new image URL.
      // We CANNOT rely on React state here (setFeaturedImage is async),
      // so we build the MDX content directly with the new URL injected.
      if (newImageUrl && activePath) {
        try {
          const fmWithImage = setFmField(
            setFmField(setFmField(frontmatter, "title", title), "date", postDate),
            "featuredImage", newImageUrl
          );
          const newContent = buildMdx(fmWithImage, body);
          const endpoint = isPublished
            ? `/api/admin/post?path=${encodeURIComponent(activePath)}`
            : `/api/admin/draft?path=${encodeURIComponent(activePath)}`;
          await fetch(endpoint, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: newContent }),
          });
          setFrontmatter(fmWithImage); // keep state in sync
          setSaved(true); setTimeout(() => setSaved(false), 3000);
        } catch {
          // Non-fatal — user can still save manually
        }
      }
    } catch (err) { alert("Üleslaadimine ebaõnnestus: " + (err as Error).message); }
    finally { setUploadingImage(false); e.target.value = ""; }
  }

  async function save() {
    setSaving(true); setSaved(false);
    const content = buildMdx(buildFm(), body);
    try {
      const endpoint = isPublished
        ? `/api/admin/post?path=${encodeURIComponent(activePath)}`
        : `/api/admin/draft?path=${encodeURIComponent(activePath)}`;
      const res = await fetch(endpoint, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const d = await res.json() as { ok?: boolean };
      if (d.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } finally { setSaving(false); }
  }

  async function updateLive() {
    setUpdating(true); setSaved(false);
    const content = buildMdx(buildFm(), body);
    try {
      const res = await fetch(`/api/admin/post?path=${encodeURIComponent(activePath)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const d = await res.json() as { ok?: boolean };
      if (d.ok) {
        setSaved(true); setTimeout(() => setSaved(false), 3000);
        // Show 120-second countdown (Vercel rebuild time)
        setUpdateCountdown(120);
        const tick = setInterval(() => {
          setUpdateCountdown(prev => {
            if (prev <= 1) { clearInterval(tick); return 0; }
            return prev - 1;
          });
        }, 1000);
      }
    } finally { setUpdating(false); }
  }

  async function publish() {
    setPublishing(true); setError("");
    // Build the final content from current React state — this is the source of truth.
    // We pass it directly to the publish API so it never has to read from the stale filesystem.
    const finalContent = buildMdx(buildFm(), body);
    // Also save to GitHub draft (keeps draft in sync before publish deletes it)
    await fetch(`/api/admin/draft?path=${encodeURIComponent(activePath)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: finalContent }),
    });
    // Then publish — send the content directly so publish API uses it verbatim
    const res = await fetch("/api/admin/publish", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: activePath, content: finalContent }),
    });
    const d = await res.json() as { ok?: boolean; slug?: string; needsRedeploy?: boolean; error?: string };
    if (d.ok) { setPublished(true); setPublishedSlug(d.slug ?? ""); onPublished(); }
    else { setError(d.error ?? "Midagi läks valesti"); }
    setPublishing(false);
  }

  async function unpublish() {
    if (!confirm(`Kas oled kindel, et soovid postituse "${title}" eemaldada avalikust vaatest?\nPostitus liigub tagasi mustandite alla.`)) return;
    setUnpublishing(true); setError("");
    const res = await fetch("/api/admin/unpublish", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: activePath }),
    });
    const d = await res.json() as { ok?: boolean; draftPath?: string; error?: string };
    if (d.ok) { setUnpublished(true); setTimeout(() => { onBack(); }, 1800); }
    else { setError(d.error ?? "Eemaldamine ebaõnnestus"); }
    setUnpublishing(false);
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
          category={category}
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
        background: "#f9f9f7", border: "1.5px solid #e6e6e6", borderRadius: 16,
        padding: "16px 18px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 14,
      }}>
        {/* Publish date */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#5a6b6c", display: "block", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>
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
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#5a6b6c", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              🖼 Kaanepilt
            </label>
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
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#5a6b6c", display: "block", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>
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

        {/* Category selector */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#5a6b6c", display: "block", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            🏷 Kategooria
          </label>
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
              { slug: "ksa-silmakeskus",            et: "KSA Silmakeskus",            ru: "KSA Vision Center",      en: "KSA Vision Center" },
            ] as const).map(cat => {
              const label = cat[currentLang as "et" | "ru" | "en"] ?? cat.et;
              const isActive = category === cat.slug;
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => setCategory(isActive ? "" : cat.slug)}
                  style={{
                    padding: "6px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    border: `1.5px solid ${isActive ? "#87be23" : "#e6e6e6"}`,
                    background: isActive ? "#f0fde4" : "white",
                    color: isActive ? "#3d6b00" : "#5a6b6c",
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                  }}
                >{label}</button>
              );
            })}
          </div>
          {!category && (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#f59e0b" }}>
              ⚠ Kategooria on valimata — artikkel ilmub ilma sildita
            </p>
          )}
        </div>
      </div>

      {/* Formatting toolbar + Body textarea */}
      <FormattingToolbar body={body} setBody={setBody} />

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
            <div style={{ display: "flex", gap: 10 }}>
              {langChecked && needsMedical === "no" && (
                <button onClick={publish} disabled={publishing} style={{
                  padding: "11px 28px", border: "none", borderRadius: 12,
                  background: publishing ? "#c5dfa0" : "#87be23", color: "white",
                  fontSize: 15, fontWeight: 800, cursor: publishing ? "not-allowed" : "pointer",
                }}>
                  {publishing ? "Avaldan…" : "✓ Avalda"}
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
              <button onClick={updateLive} disabled={updating || updateCountdown > 0} style={{
                padding: "11px 24px", border: "none", borderRadius: 12,
                background: updating || updateCountdown > 0 ? "#c5dfa0" : "#87be23",
                color: "white", fontSize: 14, fontWeight: 800,
                cursor: updating || updateCountdown > 0 ? "not-allowed" : "pointer",
              }}>
                {updating ? "Uuendan…" : updateCountdown > 0 ? `⏱ Live ~${updateCountdown}s` : "🔄 Uuenda live"}
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

function FormattingToolbar({ body, setBody }: { body: string; setBody: (v: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>KSA <span style={{ color: "#87be23" }}>Blogi</span></span>
        <span style={{
          padding: "8px 20px", borderRadius: 99, background: "#87be23",
          color: "white", fontSize: 13, fontWeight: 700,
        }}>Broneeri aeg</span>
      </div>

      {/* Article content */}
      <article style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 120px" }}>
        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9a9a9a", marginBottom: 32 }}>
          <span>Blogi</span>
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

  const loadPosts = useCallback(() => {
    setLoading(true); setFailed(false);
    fetch("/api/admin/posts")
      .then(r => { if (!r.ok) throw new Error("not ok"); return r.json(); })
      .then((d: { posts?: DraftMeta[] }) => { setPosts(d.posts ?? []); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

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
            {l === "all" ? `Kõik (${posts.length})` : `${l.toUpperCase()} (${posts.filter(p => p.lang === l).length})`}
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

      {loading && <div style={{ textAlign: "center", padding: "60px 0", color: "#9a9a9a", fontSize: 15 }}>Laen postitusi…</div>}

      {!loading && failed && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9a9a9a", fontSize: 15 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔌</div>
          Avaldatud postituste laadimine vajab serveripoolset tuge
        </div>
      )}

      {!loading && !failed && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p style={{ color: "#9a9a9a", fontSize: 15 }}>
            {posts.length === 0 ? "Avaldatud postitusi ei leitud." : "Otsing ei andnud tulemusi."}
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(post => (
          <div key={post.path} style={{
            background: "white", border: "2px solid #f0f0ec", borderRadius: 18,
            padding: "18px 20px", display: "flex", alignItems: "center", gap: 16,
            cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#87be23"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 16px rgba(135,190,35,0.12)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#f0f0ec"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
            onClick={() => setSelected(post)}
          >
            <LangBadge lang={post.lang} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {post.title || "(pealkiri puudub)"}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#9a9a9a", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {post.excerpt}
              </p>
            </div>
            <span style={{ fontSize: 11, color: "#9a9a9a", background: "#f5f5f5",
              padding: "2px 8px", borderRadius: 6, flexShrink: 0 }}>
              {post.date}
            </span>
            <div style={{ color: "#87be23", fontSize: 20, fontWeight: 800, flexShrink: 0 }}>→</div>
          </div>
        ))}
      </div>
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
      <p style={s.p}>Iga hommikul kell 7 genereerib süsteem automaatselt uue mustandi. Need ilmuvad <strong>Mustandid</strong> vahekaardil.</p>
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
      <h3 style={s.h3}>Pilt</h3>
      <p style={s.p}>Kleebi pildi URL <strong>Pildiaadress</strong> lahtrisse. KSA pildid leiab: <span style={s.code}>ksa.ee/wp-content/uploads/…</span></p>
      <h3 style={s.h3}>YouTube video</h3>
      <p style={s.p}>Kleebi YouTube link redaktori ülaosas olevasse lahtrisse → <strong>Lisa video</strong>. Video ilmub teksti sisse.</p>

      {/* Section 4 */}
      <h2 style={s.h2}>4. Nipid</h2>
      <table style={s.table}>
        <tbody>
          {[
            ["Postitus vajab arsti kinnitust", "Lisa märge tekstis + teavita Antsu"],
            ["Viga avaldatud postituses", "Teavita Antsu — ta parandab faili otse"],
            ["Mustand on halb", "Kustuta mustand → kirjuta uus"],
            ["Taha postitus ajutiselt peita", "Muuda kuupäev tulevikku — kaob avalikust vaatest"],
          ].map(([olukord, lahendus]) => (
            <tr key={olukord}>
              <td style={{ ...s.td, fontWeight: 600, width: "45%" }}>{olukord}</td>
              <td style={s.td}>{lahendus}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Section 5 */}
      <h2 style={s.h2}>5. Mida süsteem teeb automaatselt</h2>
      <table style={s.table}>
        <tbody>
          {[
            ["Iga päev kell 7", "Otsib uued silmatervise uudised → genereerib mustandi"],
            ["Iga avaldamine", "Sitemap uueneb, Schema JSON-LD lisatakse automaatselt"],
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

// ─── Root Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<"drafts" | "published" | "write" | "prompt" | "help">("drafts");

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
            { id: "drafts", label: "📋 Mustandid" },
            { id: "published", label: "✏️ Avaldatud" },
            { id: "write", label: "✍️ Kirjuta uus" },
            { id: "prompt", label: "📝 Sisureeglid" },
            { id: "help", label: "❓ Juhend" },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "0 20px", border: "none",
              borderBottom: tab === t.id ? "3px solid #87be23" : "3px solid transparent",
              background: "none", color: tab === t.id ? "#1a1a1a" : "#9a9a9a",
              fontSize: 14, fontWeight: tab === t.id ? 700 : 500,
              cursor: "pointer", minHeight: 56, transition: "color 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/" style={{ fontSize: 13, color: "#9a9a9a", textDecoration: "none" }}>← Blogi</a>
          <button onClick={logout} style={{
            padding: "6px 14px", border: "1px solid #e6e6e6", borderRadius: 8,
            background: "white", color: "#9a9a9a", fontSize: 13, cursor: "pointer",
          }}>Logi välja</button>
        </div>
      </div>

      <DailyGreeting />

      {tab === "drafts" ? <DraftsTab /> : tab === "published" ? <PublishedTab /> : tab === "write" ? <WriteTab /> : tab === "prompt" ? <PromptTab /> : <HelpTab />}
    </div>
  );
}
