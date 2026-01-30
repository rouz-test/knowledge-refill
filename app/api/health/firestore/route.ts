// app/api/health/firestore/route.ts
import { NextResponse } from "next/server";
import { getDb } from "@/app/lib/firebase.server";

export async function GET() {
  try {
    const db = getDb();

    // 존재하지 않아도 되는 더미 문서 (Admin SDK)
    await db.collection("_health").doc("ping").get();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[firestore health]", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}