"use client";

import { useEffect, useState } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("ksa_cookie_consent");
    if (!consent) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem("ksa_cookie_consent", "accepted");
    setVisible(false);
    window.dispatchEvent(new Event("ksa_consent_accepted"));
  }

  function decline() {
    localStorage.setItem("ksa_cookie_consent", "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#fff",
        borderTop: "1px solid #e6e6e6",
        padding: "16px 24px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "12px",
        fontFamily: "var(--font-geist-sans, sans-serif)",
        fontSize: "14px",
        color: "#1a1a1a",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
      }}
    >
      <p style={{ margin: 0, flex: "1 1 260px", lineHeight: 1.5 }}>
        Kasutame küpsiseid (Google Analytics), et mõista, kuidas külastajad meie blogis liiguvad.
        Andmeid kasutatakse ainult statistika eesmärgil.{" "}
        <a
          href="https://ksa.ee/privaatsuspoliitika/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#87be23", textDecoration: "underline" }}
        >
          Privaatsuspoliitika
        </a>
      </p>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button
          onClick={decline}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid #e6e6e6",
            background: "#fff",
            color: "#5a6b6c",
            cursor: "pointer",
            fontSize: "14px",
            fontFamily: "inherit",
          }}
        >
          Keeldu
        </button>
        <button
          onClick={accept}
          style={{
            padding: "8px 20px",
            borderRadius: "6px",
            border: "none",
            background: "#87be23",
            color: "#fff",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          Nõustun
        </button>
      </div>
    </div>
  );
}
