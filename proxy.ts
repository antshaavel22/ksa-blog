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

  // Sliding session. The login cookie was a fixed 7 days from sign-in, so it
  // expired on a timer regardless of whether the editor was mid-article — and
  // an expiry mid-edit is invisible: the page stays open, every save returns
  // 401, and the work is stranded in the browser. (Jana, 2026-09-07: batch
  // save 401 at 15:44, four more 401s at 15:52.) Renewing on each
  // authenticated request means anyone using the admin weekly is never
  // logged out mid-work; only a genuinely idle week ends the session.
  // Logout is exempt: it clears this cookie, and refreshing it here would race
  // that with a second Set-Cookie for the same name on one response.
  if (pathname === "/api/admin/logout") return NextResponse.next(passHeaders);

  const res = NextResponse.next(passHeaders);
  res.cookies.set("admin_session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|uploads|.*\\..*).*)"],
};
