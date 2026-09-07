"use client";

/**
 * One draw question at the end of a blog post — a correct answer earns an
 * extra ticket in the KSA kuukiri draw (September 2026 mechanic, Ants
 * 2026-09-07: "make reading the thing that earns entries").
 *
 * Self-contained on purpose: the same file is used verbatim by ksa-blog
 * (blog.ksa.ee) and ksa-web (ksa.ee/blogi). All copy AND the question come
 * from the newsletter API, so editors change words in one place and neither
 * site needs a deploy. If the API has no question for this slug + language
 * (older posts, other months) the component renders nothing at all.
 *
 * The correct key is never in the browser — grading is server-side.
 */
import { useEffect, useState } from "react";

const API = "https://loos.ksa.ee/api/loos/article-quiz";
const STORE = "ksa_loos_reader"; // { first_name, email } — prefill across posts

type Q = { slug: string; language: string; prompt: string; options: Array<{ key: string; label: string }> };
type Copy = Record<string, string>;
type Phase = "idle" | "sending" | "correct" | "already" | "wrong" | "error";

const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);

export default function ArticleQuiz({ slug, lang }: { slug: string; lang: "et" | "ru" | "en" }) {
  const [q, setQ] = useState<Q | null>(null);
  const [copy, setCopy] = useState<Copy | null>(null);
  const [answer, setAnswer] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [tickets, setTickets] = useState(0);
  const [hasMain, setHasMain] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`${API}?slug=${encodeURIComponent(slug)}&lang=${lang}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data?.question) return;
        setQ(data.question);
        setCopy(data.copy);
      })
      .catch(() => {});
    try {
      const s = localStorage.getItem(STORE);
      if (s) {
        const p = JSON.parse(s);
        if (p.first_name) setFirstName(p.first_name);
        if (p.email) setEmail(p.email);
        if (p.first_name && p.email) setConsent(true);
      }
    } catch {}
    return () => { alive = false; };
  }, [slug, lang]);

  if (!q || !copy) return null;

  const ready = !!answer && firstName.trim().length > 0 && /.+@.+\..+/.test(email) && consent;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || phase === "sending") return;
    setPhase("sending");
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, lang, email, first_name: firstName.trim(), answer, gdpr_consent: true }),
      });
      const data = await r.json();
      if (!r.ok || data.ok === false) { setPhase("error"); return; }
      if (!data.correct) { setPhase("wrong"); return; }
      try { localStorage.setItem(STORE, JSON.stringify({ first_name: firstName.trim(), email })); } catch {}
      setTickets(data.tickets_total ?? 1);
      setHasMain(data.has_main_entry !== false);
      setPhase(data.already_had ? "already" : "correct");
    } catch {
      setPhase("error");
    }
  }

  const box: React.CSSProperties = {
    margin: "48px auto 0", maxWidth: 720, padding: "28px 24px", borderRadius: 18,
    background: "#f5f0e6", border: "1px solid #e8e4dc", color: "#5A6B6C",
    fontFamily: "inherit", lineHeight: 1.55,
  };
  const eyebrow: React.CSSProperties = { fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, color: "#92a0a1", marginBottom: 8 };
  const title: React.CSSProperties = { fontSize: 22, fontWeight: 600, color: "#1a1a1a", margin: "0 0 6px", letterSpacing: "-0.01em" };
  const opt = (on: boolean): React.CSSProperties => ({
    display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
    border: `1px solid ${on ? "#86BC25" : "#e8e4dc"}`, background: on ? "#fff" : "transparent", fontSize: 15,
  });
  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e8e4dc", fontSize: 15, background: "#fff", boxSizing: "border-box" };
  const btn: React.CSSProperties = { display: "inline-block", padding: "12px 22px", borderRadius: 999, border: 0, background: ready ? "#86BC25" : "#bbbbbb", color: "#fff", fontWeight: 600, fontSize: 15, cursor: ready ? "pointer" : "not-allowed" };
  const link: React.CSSProperties = { color: "#5A8518", fontWeight: 600, textDecoration: "none", borderBottom: "1px solid #86BC23" };

  if (phase === "correct" || phase === "already") {
    const done = phase === "correct";
    return (
      <aside style={box} data-ksa-article-quiz>
        <div style={eyebrow}>{copy.eyebrow}</div>
        <p style={title}>🎟️ {done ? copy.correct_title : copy.already_title}</p>
        <p style={{ margin: "0 0 10px", fontSize: 16 }}>{fill(done ? copy.correct_body : copy.already_body, { n: tickets, draw: copy.draw })}</p>
        {!hasMain && (
          <p style={{ margin: "0 0 10px", fontSize: 14 }}>
            {copy.correct_needs_main} <a href={copy.loos_url} style={link}>{copy.correct_main_link}</a>
          </p>
        )}
        <a href={copy.blog_url} style={{ ...link, fontSize: 14 }}>{copy.more_stories}</a>
      </aside>
    );
  }

  return (
    <aside style={box} data-ksa-article-quiz>
      <div style={eyebrow}>{copy.eyebrow}</div>
      <p style={title}>{copy.title}</p>
      <p style={{ margin: "0 0 16px", fontSize: 15 }}>{fill(copy.intro, { draw: copy.draw })}</p>
      <form onSubmit={submit}>
        <p style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 600, color: "#1a1a1a" }}>{q.prompt}</p>
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {q.options.map((o) => (
            <label key={o.key} style={opt(answer === o.key)}>
              <input type="radio" name={`aq-${q.slug}`} value={o.key} checked={answer === o.key} onChange={() => { setAnswer(o.key); if (phase === "wrong") setPhase("idle"); }} style={{ marginTop: 3, accentColor: "#86BC25" }} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
        {phase === "wrong" && (
          <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "#fee", border: "1px solid #f3c2c2", color: "#a00", fontSize: 14 }}>
            <strong>{copy.wrong_title}</strong> {copy.wrong_body}
          </div>
        )}
        {phase === "error" && (
          <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "#fee", border: "1px solid #f3c2c2", color: "#a00", fontSize: 14 }}>{copy.error}</div>
        )}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", marginBottom: 10 }}>
          <input style={input} type="text" placeholder={copy.name_label} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
          <input style={input} type="email" placeholder={copy.email_label} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, marginBottom: 14 }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, accentColor: "#86BC25" }} required />
          <span>
            {copy.consent} <a href={copy.rules_url} target="_blank" rel="noopener noreferrer" style={link}>{copy.rules_label}</a>
          </span>
        </label>
        <button type="submit" style={btn} disabled={!ready || phase === "sending"}>
          {phase === "sending" ? copy.checking : phase === "wrong" ? copy.retry : copy.submit}
        </button>
      </form>
    </aside>
  );
}
