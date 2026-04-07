import { NextRequest, NextResponse } from "next/server";

const SESSION_TOKEN = "ksa-admin-authenticated";

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password: string };
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();

  if (!adminPassword) {
    return NextResponse.json({ error: "Server misconfiguration: ADMIN_PASSWORD not set" }, { status: 500 });
  }

  if (!password || password.trim() !== adminPassword) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_session", SESSION_TOKEN, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return response;
}
