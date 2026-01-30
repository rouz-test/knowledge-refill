import { NextResponse } from "next/server";
import { resolveDailyContent } from "@/app/lib/admin-store.server";
import { getDb } from "@/app/lib/firebase.server";
import { doc, getDoc } from "firebase/firestore";
import type { ContentPayload, DailyContentResponse } from "@/app/lib/api-types";

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function docId(date: string, cohort: string) {
  return `${date}__${cohort}`;
}

function normalizePayload(input: any): ContentPayload {
  // We keep the current contract as V2 (contentVersion: 2)
  const title = typeof input?.title === "string" ? input.title : undefined;

  const sections = input?.sections ?? {};
  const past = typeof sections.past === "string" ? sections.past : "";
  const change = typeof sections.change === "string" ? sections.change : "";
  const detail = typeof sections.detail === "string" ? sections.detail : "";

  const sources = Array.isArray(input?.sources) ? input.sources : undefined;

  return {
    contentVersion: 2,
    title,
    sections: { past, change, detail },
    ...(sources ? { sources } : {}),
  };
}

/**
 * GET /api/content/daily?date=YYYY-MM-DD&cohort=xxxx
 * - Response content is normalized to ContentPayload (v2)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  const cohort = url.searchParams.get("cohort") ?? "";

  if (!isYMD(date)) {
    return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
  }
  if (!cohort) {
    return NextResponse.json({ ok: false, error: "Missing cohort" }, { status: 400 });
  }

  // 1) Firestore-first (server source of truth)
  let resolved: any = null;
  try {
    const db = getDb();
    const ref = doc(db, "dailyContents", docId(date, cohort));
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const d = snap.data() as any;
      resolved = {
        resolvedFrom: "firestore",
        category: d.category ?? null,
        priority: d.priority ?? null,
        status: d.status ?? "published",
        // accept either {title, sections:{...}, sources?} or flattened fields
        content: d.content ?? {
          title: d.title,
          sections: d.sections ?? { past: d.past ?? "", change: d.change ?? "", detail: d.detail ?? "" },
          ...(Array.isArray(d.sources) ? { sources: d.sources } : {}),
        },
        updatedAt:
          typeof d.updatedAt === "string"
            ? d.updatedAt
            : d.updatedAt?.toDate
              ? d.updatedAt.toDate().toISOString()
              : null,
      };
    }
  } catch (e) {
    // Firestore unavailable or misconfigured — fall back to existing resolver.
    console.error("[daily content] firestore read failed", e);
  }

  // 2) Fallback: existing local/admin-store resolver
  if (!resolved) {
    resolved = await resolveDailyContent(date, cohort);
  }

  const resp: DailyContentResponse = {
    date,
    cohort,
    resolvedFrom: resolved?.resolvedFrom ?? "none",
    category: resolved?.category ?? null,
    priority: resolved?.priority ?? null,
    // status는 아직 다른 레이어에서 참조할 수 있어 호환을 위해 유지합니다.
    status: (resolved as any)?.status ?? "published",
    content: resolved?.content ? normalizePayload(resolved.content) : null,
    updatedAt: resolved?.updatedAt ?? null,
  };

  return NextResponse.json({ ok: true, data: resp });
}