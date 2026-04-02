"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftMeta {
  filename: string;
  path: string;
  title: string;
  excerpt: string;
  lang: string;
  date: string;
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

function DraftEditor({ draft, onBack, onPublished }: {
  draft: DraftMeta;
  onBack: () => void;
  onPublished: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [frontmatter, setFrontmatter] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [postDate, setPostDate] = useState("");
  const [youtubeInput, setYoutubeInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLoaded(false); setError(""); setPublished(false); setSaved(false);
    fetch(`/api/admin/draft?path=${encodeURIComponent(draft.path)}`)
      .then(r => r.json())
      .then((d: { content?: string; error?: string }) => {
        if (d.error) { setError(d.error); return; }
        const raw = d.content ?? "";
        const parsed = parseMdx(raw);
        if (parsed) {
          setFrontmatter(parsed.frontmatter);
          setTitle(getFmField(parsed.frontmatter, "title"));
          setFeaturedImage(getFmField(parsed.frontmatter, "featuredImage"));
          setPostDate(getFmField(parsed.frontmatter, "date") || new Date().toISOString().split("T")[0]);
          setBody(parsed.body.trimStart());
        } else { setBody(raw); }
        setLoaded(true);
      })
      .catch(e => setError((e as Error).message));
  }, [draft.path]);

  async function save() {
    setSaving(true); setSaved(false);
    let fm = setFmField(frontmatter, "title", title);
    fm = setFmField(fm, "featuredImage", featuredImage);
    fm = setFmField(fm, "date", postDate);
    const content = buildMdx(fm, body);
    try {
      const res = await fetch(`/api/admin/draft?path=${encodeURIComponent(draft.path)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const d = await res.json() as { ok?: boolean };
      if (d.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } finally { setSaving(false); }
  }

  async function publish() {
    setPublishing(true); setError("");
    // Save first
    let fm = setFmField(frontmatter, "title", title);
    fm = setFmField(fm, "featuredImage", featuredImage);
    fm = setFmField(fm, "date", postDate);
    await fetch(`/api/admin/draft?path=${encodeURIComponent(draft.path)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: buildMdx(fm, body) }),
    });
    // Then publish
    const res = await fetch("/api/admin/publish", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: draft.path }),
    });
    const d = await res.json() as { ok?: boolean; slug?: string; error?: string };
    if (d.ok) { setPublished(true); setPublishedSlug(d.slug ?? ""); onPublished(); }
    else { setError(d.error ?? "Midagi läks valesti"); }
    setPublishing(false);
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (published) {
    return (
      <div style={{ maxWidth: 600, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1a1a1a", margin: "0 0 10px" }}>
          Postitus on üleval!
        </h2>
        <p style={{ color: "#9a9a9a", fontSize: 15, marginBottom: 36 }}>
          See ilmub blogis umbes 60 sekundi pärast.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onBack} style={{
            padding: "13px 26px", border: "2px solid #e6e6e6", borderRadius: 14,
            background: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", color: "#5a6b6c",
          }}>← Tagasi</button>
          {publishedSlug && (
            <a href={`/${publishedSlug}`} target="_blank" rel="noopener noreferrer" style={{
              padding: "13px 26px", borderRadius: 14, background: "#87be23", color: "white",
              fontSize: 15, fontWeight: 700, textDecoration: "none",
            }}>Vaata postitust →</a>
          )}
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!loaded && !error) {
    return <div style={{ textAlign: "center", padding: "80px 24px", color: "#9a9a9a", fontSize: 16 }}>Laen…</div>;
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 120px" }}>
      {/* Back bar */}
      <div style={{
        padding: "16px 0 14px", display: "flex", alignItems: "center",
        gap: 10, borderBottom: "1px solid #f0f0ec", marginBottom: 24,
      }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", fontSize: 15, color: "#5a6b6c",
          cursor: "pointer", fontWeight: 600, padding: 0, display: "flex", alignItems: "center", gap: 6,
        }}>← Tagasi</button>
        <LangBadge lang={draft.lang} />
      </div>

      {error && (
        <div style={{ background: "#fff0f0", border: "1px solid #fcc", borderRadius: 12, padding: "12px 16px", color: "#b91c1c", marginBottom: 20 }}>
          ⚠ {error}
        </div>
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
          <label style={{ fontSize: 12, fontWeight: 700, color: "#5a6b6c", display: "block", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            🖼 Kaanepilt (URL)
          </label>
          <input
            type="url"
            value={featuredImage}
            onChange={e => setFeaturedImage(e.target.value)}
            placeholder="https://ksa.ee/wp-content/uploads/..."
            style={{
              width: "100%", padding: "10px 14px", border: "1.5px solid #e6e6e6",
              borderRadius: 10, fontSize: 13, outline: "none", background: "white",
              boxSizing: "border-box", fontFamily: "inherit", color: "#1a1a1a",
            }}
            onFocus={e => { e.target.style.borderColor = "#87be23"; }}
            onBlur={e => { e.target.style.borderColor = "#e6e6e6"; }}
          />
          {featuredImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={featuredImage} alt="" style={{ marginTop: 8, width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8, border: "1px solid #e6e6e6" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
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
      </div>

      {/* Body */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Artikli tekst..."
        rows={22}
        spellCheck
        style={{
          width: "100%", padding: "16px", fontSize: 15, lineHeight: 1.75,
          color: "#1a1a1a", border: "1.5px solid #e6e6e6", borderRadius: 16,
          background: "white", outline: "none", resize: "vertical",
          boxSizing: "border-box", fontFamily: "inherit", minHeight: 400,
        }}
        onFocus={e => { e.target.style.borderColor = "#87be23"; }}
        onBlur={e => { e.target.style.borderColor = "#e6e6e6"; }}
      />

      {/* Sticky action bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "white", borderTop: "1px solid #e6e6e6",
        padding: "14px 24px", display: "flex", alignItems: "center",
        justifyContent: "flex-end", gap: 12, zIndex: 100,
        boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
      }}>
        {saved && <span style={{ fontSize: 14, color: "#3d6b00", fontWeight: 600 }}>✓ Salvestatud</span>}
        <button onClick={save} disabled={saving} style={{
          padding: "11px 22px", border: "2px solid #e6e6e6", borderRadius: 12,
          background: "white", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
          color: "#5a6b6c",
        }}>{saving ? "Salvestab…" : "Salvesta"}</button>
        <button onClick={publish} disabled={publishing} style={{
          padding: "11px 28px", border: "none", borderRadius: 12,
          background: publishing ? "#c5dfa0" : "#87be23", color: "white",
          fontSize: 15, fontWeight: 800, cursor: publishing ? "not-allowed" : "pointer",
          letterSpacing: "0.01em",
        }}>{publishing ? "Avaldan…" : "✓ Avalda"}</button>
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
              <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {draft.title || "(pealkiri puudub)"}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#9a9a9a", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {draft.excerpt}
              </p>
            </div>
            <div style={{ color: "#87be23", fontSize: 20, fontWeight: 800, flexShrink: 0 }}>→</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Write New ────────────────────────────────────────────────────────────────

function WriteTab() {
  const [step, setStep] = useState<"source" | "write" | "done">("source");
  const [sourceMode, setSourceMode] = useState<"text" | "url" | "file" | null>(null);
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

  async function fetchUrl() {
    if (!urlInput.trim()) return;
    setUrlFetching(true); setUrlError("");
    try {
      const res = await fetch(`/api/admin/fetch-url?url=${encodeURIComponent(urlInput.trim())}`);
      const d = await res.json() as { text?: string; title?: string; error?: string };
      if (d.error) { setUrlError(d.error); return; }
      setBrief(`Allikas: ${d.title ?? urlInput}\nURL: ${urlInput}\n\n${d.text ?? ""}`);
      setSourceMode("text");
      setStep("write");
    } catch (e) { setUrlError((e as Error).message); }
    finally { setUrlFetching(false); }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setBrief(`Fail: ${file.name}\n\n${ev.target?.result as string}`);
      setSourceMode("text");
      setStep("write");
    };
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
      else setStep("done");
    } catch (e) { setGenError((e as Error).message); }
    finally { setGenerating(false); }
  }

  function reset() { setStep("source"); setSourceMode(null); setBrief(""); setUrlInput(""); setResults([]); setGenError(""); setLanguages(["et", "ru", "en"]); }

  // ── Step 1: Source ────────────────────────────────────────────────────────
  if (step === "source") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", textAlign: "center", marginBottom: 8 }}>
          Kust tuleb sisu?
        </h2>
        <p style={{ color: "#9a9a9a", textAlign: "center", marginBottom: 36, fontSize: 15 }}>
          Vali üks kolmest võimalusest
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Paste text */}
          <button onClick={() => { setSourceMode("text"); setStep("write"); }} style={{
            padding: "22px 24px", border: "2px solid #e6e6e6", borderRadius: 18,
            background: "white", cursor: "pointer", textAlign: "left",
            display: "flex", alignItems: "center", gap: 18, transition: "all 0.15s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#87be23"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(135,190,35,0.12)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e6e6e6"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
          >
            <span style={{ fontSize: 36 }}>✏️</span>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 800, color: "#1a1a1a" }}>Kirjutan ise</p>
              <p style={{ margin: 0, fontSize: 13, color: "#9a9a9a" }}>Kleebi oma märkmed, lugu või idee</p>
            </div>
          </button>

          {/* URL */}
          <div style={{ border: "2px solid #e6e6e6", borderRadius: 18, background: "white", padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 14 }}>
              <span style={{ fontSize: 36 }}>🔗</span>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 800, color: "#1a1a1a" }}>Artikli link</p>
                <p style={{ margin: 0, fontSize: 13, color: "#9a9a9a" }}>Kleebi link, mille põhjal kirjutada</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); fetchUrl(); }}}
                placeholder="https://..."
                style={{ flex: 1, padding: "10px 14px", border: "2px solid #e6e6e6", borderRadius: 12, fontSize: 14, outline: "none" }}
              />
              <button onClick={fetchUrl} disabled={urlFetching || !urlInput.trim()} style={{
                padding: "10px 18px", border: "none", borderRadius: 12,
                background: urlFetching ? "#c5dfa0" : "#87be23", color: "white",
                fontSize: 14, fontWeight: 700, cursor: urlFetching ? "not-allowed" : "pointer",
              }}>{urlFetching ? "Laen…" : "Tõmba"}</button>
            </div>
            {urlError && <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 6, marginBottom: 0 }}>⚠ {urlError}</p>}
          </div>

          {/* File upload */}
          <label style={{
            padding: "22px 24px", border: "2px solid #e6e6e6", borderRadius: 18,
            background: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 18,
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = "#87be23"; (e.currentTarget as HTMLLabelElement).style.boxShadow = "0 4px 20px rgba(135,190,35,0.12)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = "#e6e6e6"; (e.currentTarget as HTMLLabelElement).style.boxShadow = "none"; }}
          >
            <span style={{ fontSize: 36 }}>📁</span>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 800, color: "#1a1a1a" }}>Laadi fail</p>
              <p style={{ margin: 0, fontSize: 13, color: "#9a9a9a" }}>Tekst- või märkuste fail (.txt, .md)</p>
            </div>
            <input type="file" accept=".txt,.md,.mdx,.csv" onChange={handleFile} style={{ display: "none" }} />
          </label>
        </div>
      </div>
    );
  }

  // ── Step 2: Write ─────────────────────────────────────────────────────────
  if (step === "write") {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 80px" }}>
        <button onClick={reset} style={{ background: "none", border: "none", color: "#9a9a9a", cursor: "pointer", fontSize: 14, fontWeight: 600, marginBottom: 20, padding: 0 }}>← Tagasi</button>

        <form onSubmit={generate}>
          {/* Brief */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Sisu / idee / märkmed
            </label>
            <textarea value={brief} onChange={e => setBrief(e.target.value)}
              placeholder="Kirjuta siia... mida iganes pähe tuleb."
              rows={12} spellCheck
              style={{
                width: "100%", padding: "16px", fontSize: 15, lineHeight: 1.7,
                border: "2px solid #e6e6e6", borderRadius: 16, background: "white",
                outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
              }}
              onFocus={e => { e.target.style.borderColor = "#87be23"; }}
              onBlur={e => { e.target.style.borderColor = "#e6e6e6"; }}
            />
          </div>

          {/* Language */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Millisesse keelde kirjutada?
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              {(["et", "ru", "en"] as const).map(l => {
                const on = languages.includes(l);
                const c = LANG_COLORS[l];
                return (
                  <button key={l} type="button" onClick={() => toggleLang(l)} style={{
                    flex: 1, padding: "14px 0", border: `2px solid ${on ? c.border : "#e6e6e6"}`,
                    borderRadius: 14, background: on ? c.bg : "white", color: on ? c.text : "#9a9a9a",
                    fontSize: 15, fontWeight: 800, cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {LANG_NAME[l]}
                    {on && <span style={{ display: "block", fontSize: 18 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {genError && <p style={{ color: "#b91c1c", fontSize: 14, marginBottom: 12 }}>⚠ {genError}</p>}

          <button type="submit" disabled={generating || !brief.trim() || languages.length === 0} style={{
            width: "100%", padding: "18px", border: "none", borderRadius: 16,
            background: generating || !brief.trim() || languages.length === 0 ? "#c5dfa0" : "#87be23",
            color: "white", fontSize: 18, fontWeight: 800, cursor: generating ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}>
            {generating ? `Kirjutan ${languages.length} postitust…` : `✍️ Kirjuta ${languages.length > 1 ? `${languages.length} postitust` : "postitus"}`}
          </button>
        </form>
      </div>
    );
  }

  // ── Step 3: Done ──────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a", margin: "0 0 8px" }}>
          {results.length} postitus{results.length !== 1 ? "t" : ""} loodud!
        </h2>
        <p style={{ color: "#9a9a9a", fontSize: 14 }}>
          Need ootavad nüüd toimetaja ülevaatust "Mustandid" all.
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

      <button onClick={reset} style={{
        width: "100%", padding: "15px", border: "2px solid #e6e6e6", borderRadius: 14,
        background: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", color: "#5a6b6c",
      }}>+ Kirjuta veel üks</button>
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
  const [tab, setTab] = useState<"drafts" | "write" | "help">("drafts");

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
            { id: "write", label: "✍️ Kirjuta uus" },
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

      {tab === "drafts" ? <DraftsTab /> : tab === "write" ? <WriteTab /> : <HelpTab />}
    </div>
  );
}
