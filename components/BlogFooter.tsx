import Link from "next/link";

export default function BlogFooter() {
  return (
    <footer className="border-t border-[#e6e6e6] bg-[#f9f9f7] mt-auto">
      <div className="max-w-[1200px] mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#9a9a9a]">
        <div>
          © {new Date().getFullYear()} KSA Silmakeskus &mdash;{" "}
          <Link href="https://ksa.ee" className="hover:text-[#1a1a1a] transition-colors">
            ksa.ee
          </Link>
        </div>
        <div className="flex gap-6">
          <Link href="https://ksa.ee/broneeri" className="hover:text-[#1a1a1a] transition-colors">
            Broneeri aeg
          </Link>
          <Link href="https://ksa.ee/hinnakiri" className="hover:text-[#1a1a1a] transition-colors">
            Hinnakiri
          </Link>
          <Link href="https://ksa.ee/kontakt" className="hover:text-[#1a1a1a] transition-colors">
            Kontakt
          </Link>
        </div>
      </div>
    </footer>
  );
}
