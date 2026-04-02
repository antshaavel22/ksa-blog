"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

interface SearchInputProps {
  lang: string;
  kategooria?: string;
  placeholder?: string;
}

export default function SearchInput({ lang, kategooria, placeholder }: SearchInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(searchParams.get("otsing") ?? "");

  const commit = useCallback(
    (q: string) => {
      const params = new URLSearchParams();
      params.set("keel", lang);
      if (kategooria) params.set("kategooria", kategooria);
      if (q) params.set("otsing", q);
      startTransition(() => {
        router.push(`/?${params.toString()}`);
      });
    },
    [lang, kategooria, router]
  );

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a9a9a] pointer-events-none"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>

      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(value.trim());
          if (e.key === "Escape") {
            setValue("");
            commit("");
          }
        }}
        placeholder={placeholder ?? (lang === "ru" ? "Поиск по статьям…" : lang === "en" ? "Search articles…" : "Otsi artikleid…")}
        className={`pl-9 pr-4 py-2 text-sm rounded-full border border-[#e6e6e6] bg-white text-[#1a1a1a] placeholder-[#9a9a9a] outline-none focus:border-[#87be23] transition-colors w-full sm:w-56 ${isPending ? "opacity-60" : ""}`}
      />

      {value && (
        <button
          onClick={() => { setValue(""); commit(""); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a9a9a] hover:text-[#1a1a1a]"
          aria-label="Tühjenda"
        >
          ×
        </button>
      )}
    </div>
  );
}
