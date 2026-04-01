"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface CategoryFilterProps {
  categories: { slug: string; name: string; count: number }[];
  activeCategory?: string;
}

export default function CategoryFilter({ categories, activeCategory }: CategoryFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setCategory = useCallback(
    (slug: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (slug) {
        params.set("kategooria", slug);
      } else {
        params.delete("kategooria");
      }
      params.delete("leht"); // reset page
      router.push(`/?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => setCategory(null)}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
          !activeCategory
            ? "bg-[#87be23] text-white"
            : "bg-[#f5f3ee] text-[#5a6b6c] hover:bg-[#e8e3d3]"
        }`}
      >
        Kõik
      </button>
      {categories.map((cat) => (
        <button
          key={cat.slug}
          onClick={() => setCategory(cat.slug)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activeCategory === cat.slug
              ? "bg-[#87be23] text-white"
              : "bg-[#f5f3ee] text-[#5a6b6c] hover:bg-[#e8e3d3]"
          }`}
        >
          {cat.name}
          <span className="ml-1.5 text-xs opacity-60">{cat.count}</span>
        </button>
      ))}
    </div>
  );
}
