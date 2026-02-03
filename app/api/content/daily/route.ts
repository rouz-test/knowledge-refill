import { NextResponse } from "next/server";
import { getDb } from "@/app/lib/firebase.server";

export const runtime = "nodejs";

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function docId(date: string, cohort: string) {
  return `${date}__${cohort}`;
}

function normalizeCohort(raw: string) {
  // Remove common invisible characters and normalize whitespace/casing.
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeSections(input: any) {
  const s = input ?? {};
  return {
    past: typeof s.past === "string" ? s.past : "",
    change: typeof s.change === "string" ? s.change : "",
    detail: typeof s.detail === "string" ? s.detail : "",
  };
}

function normalizeContent(d: any) {
  // Accept either the v2 shape under `content`, or legacy flattened fields.
  const content = d?.content ?? null;
  const title =
    typeof content?.title === "string"
      ? content.title
      : typeof d?.title === "string"
        ? d.title
        : null;

  const sections = normalizeSections(content?.sections ?? d?.sections);

  // Preserve optional sources if present.
  const sources = Array.isArray(content?.sources)
    ? content.sources
    : Array.isArray(d?.sources)
      ? d.sources
      : undefined;

  return {
    contentVersion: 2 as const,
    title,
    sections,
    ...(sources ? { sources } : {}),
  };
}

/**
 * GET /api/content/daily?date=YYYY-MM-DD&cohort=xxxx
 * - Firestore-first (and only) for production.
 * - If cohort-specific doc is missing, falls back to `common` for the same date.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = (url.searchParams.get("date") ?? "").trim();
  const cohort = normalizeCohort(url.searchParams.get("cohort") ?? "");

  if (!isYMD(date)) {
    return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
  }
  if (!cohort) {
    return NextResponse.json({ ok: false, error: "Missing cohort" }, { status: 400 });
  }

  try {
    const db = getDb();

    // 1) Try requested cohort doc first.
    let snap = await db.collection("dailyContents").doc(docId(date, cohort)).get();

    // 2) If missing and not already common, fall back to common doc.
    if (!snap.exists && cohort !== "common") {
      snap = await db.collection("dailyContents").doc(docId(date, "common")).get();
    }

    if (!snap.exists) {
      return NextResponse.json({ ok: true, data: { date, cohort, resolvedFrom: "none", category: null, priority: null, content: null, updatedAt: null } }, { status: 404 });
    }

    const d = snap.data() as any;

    const updatedAt =
      typeof d?.updatedAt === "string"
        ? d.updatedAt
        : d?.updatedAt?.toDate
          ? d.updatedAt.toDate().toISOString()
          : null;

    return NextResponse.json({
      ok: true,
      data: {
        date,
        cohort,
        resolvedFrom: "firestore",
        category: d?.category ?? null,
        priority: d?.priority ?? null,
        content: normalizeContent(d),
        updatedAt,
      },
    });
  } catch (e) {
    console.error("[daily content] firestore read failed", e);
    return NextResponse.json(
      { ok: false, source: "firestore", error: "Firestore read failed" },
      { status: 500 }
    );
  }
}