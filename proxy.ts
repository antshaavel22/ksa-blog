import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin/login")) return NextResponse.next();
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const session = request.cookies.get("admin_session")?.value;
  const password = process.env.ADMIN_PASSWORD ?? "ksa-blogi-2024";

  if (session !== password) {
    // API routes must return JSON 401, not an HTML redirect
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
