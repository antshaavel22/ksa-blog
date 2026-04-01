import Link from "next/link";

export default function BlogNav() {
  return (
    <header className="border-b border-[#e6e6e6] bg-white sticky top-0 z-50">
      <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href="https://ksa.ee"
          className="text-sm font-medium text-[#5a6b6c] hover:text-[#1a1a1a] transition-colors"
        >
          ← ksa.ee
        </Link>
        <Link href="/" className="flex items-center gap-2">
          <span className="text-base font-semibold tracking-tight text-[#1a1a1a]">
            KSA <span className="text-[#87be23]">Blogi</span>
          </span>
        </Link>
        <Link
          href="https://ksa.ee/broneeri"
          className="text-sm font-medium px-4 py-1.5 rounded-full bg-[#87be23] text-white hover:bg-[#74a31e] transition-colors"
        >
          Broneeri aeg
        </Link>
      </div>
    </header>
  );
}
