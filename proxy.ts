import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BLOG_BASE_PATH = "/blogi";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isMountedPath = pathname === BLOG_BASE_PATH || pathname.startsWith(`${BLOG_BASE_PATH}/`);

  if (!isMountedPath) {
    const url = request.nextUrl.clone();
    url.pathname = `${BLOG_BASE_PATH}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url, 307);
  }

  const mountedPathname = pathname.slice(BLOG_BASE_PATH.length) || "/";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", mountedPathname);
  const passHeaders = { request: { headers: requestHeaders } };

  const isAdmin = mountedPathname.startsWith("/admin") || mountedPathname.startsWith("/api/admin");
  if (!isAdmin) return NextResponse.next(passHeaders);

  if (mountedPathname.startsWith("/admin/login")) return NextResponse.next(passHeaders);
  if (mountedPathname === "/api/admin/login") return NextResponse.next(passHeaders);

  const session = request.cookies.get("admin_session")?.value;

  if (session !== "ksa-admin-authenticated") {
    if (mountedPathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL(`${BLOG_BASE_PATH}/admin/login`, request.url));
  }
  return NextResponse.next(passHeaders);
}

export const config = {
  matcher: [
    "/",
    "/robots.txt",
    "/sitemap.xml",
    "/((?!_next/static|_next/image|favicon.ico|icon.png|uploads|.*\\..*).*)",
  ],
};
