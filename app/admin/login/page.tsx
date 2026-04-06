"use client";

import { useState, FormEvent } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) {
        window.location.href = "/admin";
      } else {
        setError("Vale parool. Proovi uuesti.");
      }
    } catch {
      setError("Midagi läks valesti. Proovi uuesti.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#f9f9f7" }}
    >
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        {/* Logo area */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#87be23",
              marginBottom: 16,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
                fill="white"
              />
            </svg>
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#87be23",
              marginBottom: 6,
            }}
          >
            KSA Blog Admin
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#1a1a1a",
              margin: 0,
            }}
          >
            Logi sisse
          </h1>
          <p style={{ color: "#9a9a9a", fontSize: 14, marginTop: 6 }}>
            Ainult KSA toimetajatele
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "white",
            border: "1px solid #e6e6e6",
            borderRadius: 20,
            padding: "32px 28px",
          }}
        >
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1a1a1a",
                  marginBottom: 8,
                }}
              >
                Parool
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sisesta parool"
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "12px 44px 12px 14px",
                    border: error ? "1.5px solid #ef4444" : "1.5px solid #e6e6e6",
                    borderRadius: 12,
                    fontSize: 15,
                    color: "#1a1a1a",
                    background: "#fafaf8",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "#87be23"; }}
                  onBlur={(e) => { e.target.style.borderColor = error ? "#ef4444" : "#e6e6e6"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "#9a9a9a", padding: 4, lineHeight: 1,
                  }}
                  title={showPassword ? "Peida parool" : "Näita parooli"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {error && (
                <p
                  style={{
                    color: "#ef4444",
                    fontSize: 13,
                    marginTop: 6,
                    marginBottom: 0,
                  }}
                >
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              style={{
                width: "100%",
                padding: "13px",
                background: loading || !password ? "#c5dfa0" : "#87be23",
                color: "white",
                border: "none",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                cursor: loading || !password ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {loading ? "Kontrollin…" : "Logi sisse"}
            </button>
          </form>
        </div>

        <p
          style={{
            textAlign: "center",
            color: "#9a9a9a",
            fontSize: 12,
            marginTop: 24,
          }}
        >
          <a
            href="/"
            style={{ color: "#5a6b6c", textDecoration: "none" }}
          >
            ← Tagasi blogisse
          </a>
        </p>
      </div>
    </div>
  );
}
