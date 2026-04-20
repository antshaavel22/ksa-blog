"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

interface SearchPageInputProps {
  lang: string;
  initialQuery: string;
}

export default function SearchPageInput({ lang, initialQuery }: SearchPageInputProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commit = useCallback(
    (q: string) => {
      const params = new URLSearchParams();
      params.set("lang", lang);
      if (q.trim()) params.set("q", q.trim());
      startTransition(() => {
        router.push(`/otsing?${params.toString()}`, { scroll: false });
      });
    },
    [lang, router]
  );

  return (
    <div className="relative w-full max-w-[600px]">
      <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9a9a9a] pointer-events-none"
        fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>

      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(value);
          if (e.key === "Escape") { setValue(""); commit(""); }
        }}
        placeholder={
          lang === "ru" ? "Поиск статей…" :
          lang === "en" ? "Search articles…" :
          "Otsi artikleid…"
        }
        className={`w-full pl-12 pr-12 py-3.5 text-[15px] rounded-full border-2 border-[#e6e6e6] bg-white text-[#1a1a1a] placeholder-[#9a9a9a] outline-none focus:border-[#87be23] transition-colors shadow-sm ${isPending ? "opacity-70" : ""}`}
      />

      {value && (
        <button
          onClick={() => { setValue(""); commit(""); inputRef.current?.focus(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-[#9a9a9a] hover:text-[#1a1a1a] hover:bg-[#f0f0ec] transition-colors text-lg"
          aria-label="Kustuta"
        >
          ×
        </button>
      )}
    </div>
  );
}
