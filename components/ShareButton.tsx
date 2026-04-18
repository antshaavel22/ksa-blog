"use client";

import { useState, useRef, useEffect } from "react";

interface ShareButtonProps {
  title: string;
  url: string;
  lang?: string;
}

const COPY: Record<string, { share: string; copyLink: string; copied: string; whatsapp: string; email: string }> = {
  et: { share: "Jaga", copyLink: "Kopeeri link", copied: "Lingitud!", whatsapp: "WhatsApp", email: "E-post" },
  ru: { share: "Поделиться", copyLink: "Скопировать ссылку", copied: "Скопировано!", whatsapp: "WhatsApp", email: "Эл. почта" },
  en: { share: "Share", copyLink: "Copy link", copied: "Copied!", whatsapp: "WhatsApp", email: "Email" },
};

export default function ShareButton({ title, url, lang = "et" }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const c = COPY[lang] ?? COPY.et;

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => { setCopied(false); setOpen(false); }, 1800);
    } catch {
      prompt(c.copyLink + ":", url);
    }
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(title + " " + url)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={c.share}
        aria-expanded={open}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 14px", borderRadius: 999,
          border: `1px solid ${open ? "#87be23" : "#e6e6e6"}`,
          color: open ? "#87be23" : "#5a6b6c",
          background: "white", fontSize: 13, fontWeight: 500,
          cursor: "pointer", fontFamily: "inherit",
          transition: "border-color 0.15s, color 0.15s",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        {c.share}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          background: "white", borderRadius: 14,
          border: "1px solid #e6e6e6",
          boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
          minWidth: 190, zIndex: 50, overflow: "hidden",
          animation: "shareDropIn 0.13s ease",
        }}>

          {/* Copy link */}
          <button
            onClick={copyLink}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "12px 16px",
              border: "none", background: copied ? "#f0fdf4" : "transparent",
              cursor: "pointer", fontSize: 13, fontWeight: 500,
              color: copied ? "#3d6b00" : "#1a1a1a", fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            {copied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3d6b00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a9a9a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
            {copied ? c.copied : c.copyLink}
          </button>

          <div style={{ height: 1, background: "#f4f4f2", margin: "0 12px" }} />

          {/* WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", textDecoration: "none",
              fontSize: 13, fontWeight: 500, color: "#1a1a1a",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {c.whatsapp}
          </a>

          <div style={{ height: 1, background: "#f4f4f2", margin: "0 12px" }} />

          {/* Email */}
          <a
            href={emailUrl}
            onClick={() => setOpen(false)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", textDecoration: "none",
              fontSize: 13, fontWeight: 500, color: "#1a1a1a",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a9a9a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            {c.email}
          </a>
        </div>
      )}

      <style>{`
        @keyframes shareDropIn {
          from { opacity: 0; transform: translateY(-5px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
