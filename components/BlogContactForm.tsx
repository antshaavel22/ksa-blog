"use client";

/**
 * BlogContactForm — Web3Forms powered, sends to registreerumised@ksa.ee
 * Trilingual (ET/RU/EN). Matches KSA brand.
 * Requires NEXT_PUBLIC_WEB3FORMS_KEY env var.
 */

import { useState } from "react";

const COPY: Record<string, {
  heading: string;
  sub: string;
  name: string;
  email: string;
  message: string;
  send: string;
  success: string;
  error: string;
}> = {
  et: {
    heading: "Küsi meilt",
    sub: "Saada oma küsimus — vastame 1 tööpäeva jooksul.",
    name: "Nimi",
    email: "E-post",
    message: "Küsimus",
    send: "Saada →",
    success: "Sõnum saadetud! Vastame peagi.",
    error: "Midagi läks valesti. Proovi uuesti.",
  },
  ru: {
    heading: "Задайте вопрос",
    sub: "Напишите нам — ответим в течение 1 рабочего дня.",
    name: "Имя",
    email: "Эл. почта",
    message: "Вопрос",
    send: "Отправить →",
    success: "Сообщение отправлено! Ответим в ближайшее время.",
    error: "Что-то пошло не так. Попробуйте ещё раз.",
  },
  en: {
    heading: "Ask us",
    sub: "Send your question — we reply within 1 business day.",
    name: "Name",
    email: "Email",
    message: "Your question",
    send: "Send →",
    success: "Message sent! We'll get back to you soon.",
    error: "Something went wrong. Please try again.",
  },
};

interface Props {
  lang?: string;
}

export default function BlogContactForm({ lang = "et" }: Props) {
  const c = COPY[lang] ?? COPY.et;
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

    const form = e.currentTarget;
    const data = {
      access_key: process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? "",
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
      subject: "KSA blogi küsimus",
      from_name: "KSA Blogi",
      redirect: "false",
    };

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      setStatus(json.success ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="my-10 rounded-2xl border border-[#d4e8a8] bg-[#f4fae8] px-6 py-6 text-center">
        <p className="text-[#4a7a10] font-medium">{c.success}</p>
      </div>
    );
  }

  return (
    <div className="my-10 rounded-2xl border border-[#e6e6e6] bg-[#f9f9f7] px-6 py-6">
      <h3 className="text-lg font-semibold text-[#1a1a1a] mb-1">{c.heading}</h3>
      <p className="text-sm text-[#5a6b6c] mb-5">{c.sub}</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            name="name"
            type="text"
            required
            placeholder={c.name}
            className="flex-1 rounded-xl border border-[#e6e6e6] bg-white px-4 py-2.5 text-sm text-[#1a1a1a] placeholder-[#9a9a9a] focus:outline-none focus:border-[#87be23] transition-colors"
          />
          <input
            name="email"
            type="email"
            required
            placeholder={c.email}
            className="flex-1 rounded-xl border border-[#e6e6e6] bg-white px-4 py-2.5 text-sm text-[#1a1a1a] placeholder-[#9a9a9a] focus:outline-none focus:border-[#87be23] transition-colors"
          />
        </div>
        <textarea
          name="message"
          required
          rows={3}
          placeholder={c.message}
          className="rounded-xl border border-[#e6e6e6] bg-white px-4 py-2.5 text-sm text-[#1a1a1a] placeholder-[#9a9a9a] focus:outline-none focus:border-[#87be23] transition-colors resize-none"
        />
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={status === "sending"}
            className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#333] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {status === "sending" ? "..." : c.send}
          </button>
          {status === "error" && (
            <p className="text-xs text-red-500">{c.error}</p>
          )}
        </div>
      </form>
    </div>
  );
}
