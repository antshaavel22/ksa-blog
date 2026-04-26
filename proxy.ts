import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const passHeaders = { request: { headers: requestHeaders } };

  const isAdmin = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (!isAdmin) return NextResponse.next(passHeaders);

  if (pathname.startsWith("/admin/login")) return NextResponse.next(passHeaders);
  if (pathname === "/api/admin/login") return NextResponse.next(passHeaders);

  const session = request.cookies.get("admin_session")?.value;

  if (session !== "ksa-admin-authenticated") {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.next(passHeaders);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|uploads|.*\\..*).*)"],
};
