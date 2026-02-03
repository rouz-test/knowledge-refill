import { NextResponse } from "next/server";
import { getAdminCookieName, signAdminSession } from "@/app/lib/admin-auth.server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { password?: string };
    const password = body?.password ?? "";

    const adminPw = process.env.ADMIN_PASSWORD;
    if (!adminPw) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_PASSWORD is missing" },
        { status: 500 }
      );
    }

    if (!password || password !== adminPw) {
      return NextResponse.json(
        { ok: false, error: "INVALID_PASSWORD" },
        { status: 401 }
      );
    }

    const { token } = signAdminSession(); // 기본 TTL: 7일

    const res = NextResponse.json({ ok: true });

    res.cookies.set(getAdminCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "UNKNOWN" },
      { status: 500 }
    );
  }
}