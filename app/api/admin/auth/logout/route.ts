import { NextResponse } from "next/server";
import { getAdminCookieName } from "@/app/lib/admin-auth.server";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // 쿠키 삭제(만료)
  res.cookies.set(getAdminCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return res;
}