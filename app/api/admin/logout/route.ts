import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/admin/login", req.url));
  response.cookies.set("admin_session", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}
