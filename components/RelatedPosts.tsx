import { PostMeta } from "@/lib/posts";
import PostCard from "./PostCard";

interface RelatedPostsProps {
  posts: PostMeta[];
  lang?: "et" | "ru" | "en";
}

const HEADING: Record<string, string> = {
  et: "Seotud artiklid",
  ru: "Похожие статьи",
  en: "Related articles",
};

export default function RelatedPosts({ posts, lang = "et" }: RelatedPostsProps) {
  if (posts.length === 0) return null;

  return (
    <section className="mt-16 pt-10 border-t border-[#e6e6e6]">
      <h2 className="text-xl font-semibold text-[#1a1a1a] mb-6">
        {HEADING[lang] ?? HEADING.et}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </section>
  );
}
