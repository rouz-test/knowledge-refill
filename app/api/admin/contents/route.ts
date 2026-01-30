import { NextResponse } from "next/server";
import type { UpsertAdminContentRequest } from "@/app/lib/api-types";
import {
  deleteAdminContent,
  getAdminContent,
  listAdminContentDates,
  listAdminContentsPaged,
  upsertAdminContent,
} from "@/app/lib/admin-store.server";
import { getDb } from "@/app/lib/firebase.server";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

function docId(date: string, cohort: string) {
  return `${date}__${cohort}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "";
  if (mode === "dates") {
    const dates = await listAdminContentDates();
    return NextResponse.json({ ok: true, dates });
  }

  const date = url.searchParams.get("date") ?? "";
  const cohort = url.searchParams.get("cohort") ?? "";

  // 단건 조회
  if (date && cohort) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    // Firestore-first (source of truth), then fallback to legacy local store
    try {
      const db = getDb();
      const ref = doc(db, "dailyContents", docId(date, cohort));
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data() as any;
        const data = {
          date,
          cohort,
          category: d.category ?? null,
          priority: d.priority ?? null,
          status: d.status ?? "published",
          content:
            d.content ?? {
              title: d.title ?? null,
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
        return NextResponse.json({ ok: true, data });
      }
    } catch (e) {
      console.error("[admin contents] firestore read failed", e);
    }

    const row = await getAdminContent(date, cohort);
    return NextResponse.json({ ok: true, data: row });
  }

  // 목록 조회 (테이블) - server-side pagination
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";

  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Math.min(500, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));

  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);

  const { items: rows, total } = await listAdminContentsPaged({ cohort, start, end, limit, offset });

  const items = rows.map((r) => ({
    date: r.date,
    cohort: r.cohort,
    title: r.content?.title ?? null,
    category: (r as any).category ?? null,
    priority: (r as any).priority ?? null,
    updatedAt: r.updatedAt ?? null,
  }));

  return NextResponse.json({ ok: true, items, total });
}

export async function POST(req: Request) {
  // Auth is enforced by middleware + signed HttpOnly cookie; no header token required.
  const body = (await req.json()) as UpsertAdminContentRequest;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body?.date ?? "")) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (!body?.cohort) {
    return NextResponse.json({ error: "Missing cohort" }, { status: 400 });
  }
  if (!body?.content) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 });
  }

  const normalizedContent = (() => {
    if ((body.content as any).sections) {
      const s = (body.content as any).sections;
      const { status: _ignoredStatus, ...rest } = (body.content as any) ?? {};
      return {
        title: rest.title,
        sections: {
          past: typeof s.past === "string" ? s.past : "",
          change: typeof s.change === "string" ? s.change : "",
          detail: typeof s.detail === "string" ? s.detail : "",
        },
      };
    }

    if (typeof (body.content as any).body === "string") {
      const { status: _ignoredStatus, ...rest } = (body.content as any) ?? {};
      return {
        title: rest.title,
        sections: {
          past: "",
          change: "",
          detail: String(rest.body ?? ""),
        },
      };
    }

    return null;
  })();

  if (!normalizedContent) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 });
  }

  const saved = await upsertAdminContent(
    body.date,
    body.cohort,
    normalizedContent,
    body.category ?? null,
    body.priority ?? null
  );

  // Dual-write to Firestore so user-facing API can read from the server source of truth.
  try {
    const db = getDb();
    const ref = doc(db, "dailyContents", docId(body.date, body.cohort));
    await setDoc(
      ref,
      {
        date: body.date,
        cohort: body.cohort,
        status: (saved as any)?.status ?? "published",
        category: body.category ?? null,
        priority: body.priority ?? null,
        // Store in the v2-friendly shape
        title: normalizedContent.title ?? null,
        sections: normalizedContent.sections ?? { past: "", change: "", detail: "" },
        content: {
          title: normalizedContent.title ?? null,
          sections: normalizedContent.sections ?? { past: "", change: "", detail: "" },
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error("[admin contents] firestore write failed", e);
  }

  return NextResponse.json({ ok: true, data: saved });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  const cohort = url.searchParams.get("cohort") ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (!cohort) {
    return NextResponse.json({ error: "Missing cohort" }, { status: 400 });
  }

  const ok = await deleteAdminContent(date, cohort);

  // Best-effort delete in Firestore
  try {
    const db = getDb();
    const ref = doc(db, "dailyContents", docId(date, cohort));
    await deleteDoc(ref);
  } catch (e) {
    console.error("[admin contents] firestore delete failed", e);
  }

  return NextResponse.json({ ok: true, deleted: ok });
}