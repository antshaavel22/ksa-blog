/**
 * /api/admin/validate-frontmatter — Round-trip-parse proposed MDX content.
 *
 * The admin posts the content it's ABOUT to save. We run it through
 * gray-matter (same parser the Next.js build uses) and return either ok:true
 * or ok:false with the exact error. The admin then refuses to PUT if invalid,
 * so a bad frontmatter never reaches GitHub and never blocks a deploy.
 *
 * This is the belt for the pre-build validator's suspenders: the build check
 * catches anything that slipped through, this one catches it at source.
 */
import { NextRequest, NextResponse } from "next/server";
import matter from "gray-matter";

export async function POST(req: NextRequest) {
  const { content } = await req.json() as { content: string };
  try {
    matter(content);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: (err as Error).message.split("\n")[0],
    });
  }
}
