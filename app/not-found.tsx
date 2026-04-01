import Link from "next/link";
import BlogNav from "@/components/BlogNav";
import BlogFooter from "@/components/BlogFooter";

export default function NotFound() {
  return (
    <>
      <BlogNav />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-5xl font-semibold text-[#1a1a1a] mb-4">404</h1>
        <p className="text-[#5a6b6c] mb-8">Lehte ei leitud.</p>
        <Link
          href="/"
          className="px-6 py-2.5 bg-[#87be23] text-white rounded-full text-sm font-medium hover:bg-[#74a31e] transition-colors"
        >
          ← Tagasi blogi
        </Link>
      </main>
      <BlogFooter />
    </>
  );
}
