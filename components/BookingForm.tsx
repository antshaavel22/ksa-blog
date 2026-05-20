"use client";

import { useState } from "react";
import type { BookingFunnelConfig } from "@/lib/booking-funnels";

interface BookingFormProps {
  funnel: BookingFunnelConfig;
}

type Status = "idle" | "submitting" | "success" | "error";

export default function BookingForm({ funnel }: BookingFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const fd = new FormData(e.currentTarget);
    const payload = {
      funnel: funnel.slug,
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      clinic: (fd.get("clinic") === "Tartu" ? "Tartu" : "Tallinn") as "Tallinn" | "Tartu",
      preferredTime: String(fd.get("preferredTime") ?? ""),
      message: String(fd.get("message") ?? ""),
      consent: fd.get("consent") === "on",
      source: "blog",
      website: String(fd.get("website") ?? ""), // honeypot
    };

    try {
      // 1. Email via Web3Forms (browser-side; their free plan blocks server calls)
      const web3Key = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? "";
      const emailBody = [
        `Uuring: ${funnel.service}`,
        `Hind: ${funnel.priceLabel}${funnel.priceStrike ? ` (tavahind ${funnel.priceStrike})` : ""}`,
        `Sooduskood: ${funnel.promoCode}`,
        "",
        `Nimi: ${payload.name}`,
        `Telefon: ${payload.phone}`,
        `Email: ${payload.email}`,
        `Kliinik: ${payload.clinic}`,
        payload.preferredTime ? `Eelistatud aeg: ${payload.preferredTime}` : null,
        payload.message ? `Märkused: ${payload.message}` : null,
        "",
        `Allikas: ${payload.source}`,
        `Aeg: ${new Date().toLocaleString("et-EE")}`,
      ].filter(Boolean).join("\n");

      const emailRes = web3Key
        ? await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              access_key: web3Key,
              subject: `Broneerimissoov · ${funnel.service} · ${payload.name}`,
              email: "registreerumised@ksa.ee",
              from_name: "KSA blogi broneerimisvorm",
              message: emailBody,
            }),
          })
        : null;
      const emailOk = !!emailRes && emailRes.ok;

      // 2. Slack via our API route (server-side, env-protected webhook URL)
      const slackRes = await fetch("/api/booking/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await slackRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      // Success if either delivery worked — we don't want a Slack failure to lose a lead.
      if (emailOk || (slackRes.ok && data.ok)) {
        setStatus("success");
        // GTM/GA4 conversion event
        if (typeof window !== "undefined") {
          (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push({
            event: "booking_submit",
            funnel: funnel.slug,
            service: funnel.service,
            value: parsePrice(funnel.priceLabel),
            currency: "EUR",
          });
        }
      } else {
        setStatus("error");
        setErrorMsg(data.error ?? "Tehniline tõrge. Palun proovi uuesti.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Võrgutõrge. Palun proovi uuesti.");
    }
  }

  if (status === "success") {
    return (
      <div style={successWrap}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h2 style={{ fontSize: 28, fontWeight: 500, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
          Aitäh — broneerimissoov saadetud!
        </h2>
        <p style={{ fontSize: 16, color: "#5a6b6c", lineHeight: 1.5, margin: "0 0 24px", maxWidth: 480 }}>
          Võtame sinuga ühendust 1 tööpäeva jooksul, et leppida kokku täpne aeg.
          Eriti kiire juhtumi korral helista <a href="tel:+3726616868" style={{ color: "#5a6b6c", textDecoration: "underline" }}>661 6868</a>.
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "#1a1a1a",
            color: "#fff",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Tagasi blogi avalehele
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle} noValidate>
      {/* Honeypot — hidden from real users */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }} aria-hidden="true">
        <label>
          Veebileht (ära täida)
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div style={fieldRow}>
        <Field label="Nimi *" name="name" type="text" required autoComplete="name" />
        <Field label="Telefon *" name="phone" type="tel" required autoComplete="tel" placeholder="+372 ..." />
      </div>

      <Field label="Email *" name="email" type="email" required autoComplete="email" />

      <div style={{ marginBottom: 18 }}>
        <div style={labelStyle}>Kliinik *</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Radio name="clinic" value="Tallinn" defaultChecked label="Tallinn" />
          <Radio name="clinic" value="Tartu" label="Tartu" />
        </div>
      </div>

      <Field
        label="Eelistatud aeg (vabatahtlik)"
        name="preferredTime"
        type="text"
        placeholder="nt. järgmine nädal, õhtuti pärast 17:00"
      />

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle} htmlFor="message">Sõnum (vabatahtlik)</label>
        <textarea
          id="message"
          name="message"
          rows={3}
          style={textareaStyle}
          placeholder="Kui sul on mõni eriline soov või küsimus, kirjuta siia."
        />
      </div>

      <div style={promoBox}>
        <div style={{ fontSize: 12, color: "#5a6b6c", marginBottom: 4 }}>SOODUSKOOD</div>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 18, fontWeight: 500, color: "#1a1a1a" }}>
          {funnel.promoCode}
        </div>
        <div style={{ fontSize: 13, color: "#5a6b6c", marginTop: 4 }}>
          {funnel.promoCodeLabel}
        </div>
      </div>

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "20px 0 24px", fontSize: 13, color: "#5a6b6c", lineHeight: 1.5 }}>
        <input type="checkbox" name="consent" required style={{ marginTop: 3 }} />
        <span>
          Olen nõus, et KSA Silmakeskus võtab minuga ühendust broneerimisaja kokkuleppimiseks ning töötleb minu andmeid vastavalt{" "}
          <a href="https://ksa.ee/privaatsuspoliitika/" target="_blank" rel="noreferrer" style={{ color: "#5a6b6c", textDecoration: "underline" }}>
            privaatsuspoliitikale
          </a>.
        </span>
      </label>

      {status === "error" && errorMsg && (
        <div style={errorBox} role="alert">{errorMsg}</div>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        style={{
          ...submitButton,
          background: status === "submitting" ? "#5a6b6c" : funnel.accent,
          cursor: status === "submitting" ? "wait" : "pointer",
        }}
      >
        {status === "submitting" ? "Saadan..." : `Saada broneerimissoov`}
      </button>

      <p style={{ fontSize: 12, color: "#9a9a9a", textAlign: "center", marginTop: 14 }}>
        Eelistad helistada? <a href="tel:+3726616868" style={{ color: "#5a6b6c", textDecoration: "underline" }}>661 6868</a>
      </p>
    </form>
  );
}

function Field({
  label, name, type, required, autoComplete, placeholder,
}: {
  label: string; name: string; type: string;
  required?: boolean; autoComplete?: string; placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 18, flex: 1 }}>
      <label style={labelStyle} htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

function Radio({ name, value, label, defaultChecked }: {
  name: string; value: string; label: string; defaultChecked?: boolean;
}) {
  return (
    <label style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      gap: 8, padding: "12px 16px", border: "1px solid #e6e6e6", borderRadius: 8,
      fontSize: 15, cursor: "pointer", background: "#fff",
    }}>
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

function parsePrice(s: string): number {
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : 0;
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 500, color: "#1a1a1a", marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 14px", border: "1px solid #e6e6e6",
  borderRadius: 8, fontSize: 15, background: "#fff",
  fontFamily: "inherit",
};
const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: "vertical", minHeight: 80,
};
const fieldRow: React.CSSProperties = {
  display: "flex", gap: 12, flexWrap: "wrap",
};
const formStyle: React.CSSProperties = {
  background: "#f9f9f7", padding: 28, borderRadius: 16, border: "1px solid #e6e6e6",
  position: "relative",
};
const promoBox: React.CSSProperties = {
  background: "#fff", border: "1px dashed #87be23", padding: "14px 18px", borderRadius: 8, marginTop: 8,
};
const errorBox: React.CSSProperties = {
  background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b",
  padding: "10px 14px", borderRadius: 8, fontSize: 14, marginBottom: 14,
};
const submitButton: React.CSSProperties = {
  width: "100%", padding: "16px 24px", color: "#fff", border: "none",
  borderRadius: 999, fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em",
};
const successWrap: React.CSSProperties = {
  background: "#f9f9f7", padding: "48px 28px", borderRadius: 16, border: "1px solid #e6e6e6",
  textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center",
};
