import { MetadataRoute } from "next";
import { BLOG_PUBLIC_BASE_URL, BLOG_PUBLIC_ORIGIN } from "@/lib/url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/_next/"],
      },
    ],
    sitemap: `${BLOG_PUBLIC_BASE_URL}/sitemap.xml`,
    host: BLOG_PUBLIC_ORIGIN,
  };
}
