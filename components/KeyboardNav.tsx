"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface KeyboardNavProps {
  prevSlug: string | null;
  nextSlug: string | null;
}

/**
 * Article-page keyboard shortcuts:
 *   ArrowRight → next article (older, same language)
 *   ArrowLeft  → previous article (newer, same language)
 *   ArrowUp    → scroll to top of page
 *   ArrowDown  → scroll to Smart CTA (section id="smart-cta")
 *
 * Intentionally skipped when the user is typing in an input, textarea,
 * contenteditable element, or when any modifier key (⌘/Ctrl/Alt/Shift) is
 * held — so browser/system shortcuts still work normally.
 */
export default function KeyboardNav({ prevSlug, nextSlug }: KeyboardNavProps) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Skip when typing or when modifier keys are involved
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (t.isContentEditable) return;
      }

      switch (e.key) {
        case "ArrowRight":
          if (nextSlug) {
            e.preventDefault();
            router.push(`/${nextSlug}`);
          }
          break;
        case "ArrowLeft":
          if (prevSlug) {
            e.preventDefault();
            router.push(`/${prevSlug}`);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
          break;
        case "ArrowDown":
          e.preventDefault();
          document
            .getElementById("smart-cta")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
          break;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevSlug, nextSlug, router]);

  return null;
}
