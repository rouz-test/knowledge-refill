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
import { FieldValue } from "firebase-admin/firestore";

function docId(date: string, cohort: string) {
  return `${date}__${cohort}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "";
  const allowLegacy = url.searchParams.get("legacy") === "1";
  if (mode === "dates") {
    // Firestore-first: return distinct dates that have content (optionally filtered by cohort)
    try {
      const db = getDb();
      const cohortParam = url.searchParams.get("cohort") ?? "";

      let q: FirebaseFirestore.Query = db.collection("dailyContents");
      if (cohortParam) {
        q = q.where("cohort", "==", cohortParam);
      }

      // date is YYYY-MM-DD string; lexicographic order works
      q = q.orderBy("date", "desc").select("date").limit(730);

      const snap = await q.get();
      const seen = new Set<string>();
      const dates: string[] = [];
      for (const d of snap.docs) {
        const v = d.get("date");
        if (typeof v === "string" && !seen.has(v)) {
          seen.add(v);
          dates.push(v);
        }
      }

      return NextResponse.json({ ok: true, source: "firestore", dates });
    } catch (e) {
      console.error("[admin contents] firestore dates list failed", e);
      if (allowLegacy) {
        const dates = await listAdminContentDates();
        return NextResponse.json({ ok: true, source: "legacy", dates });
      }
      return NextResponse.json(
        { ok: false, source: "firestore", error: "Firestore dates query failed" },
        { status: 500 }
      );
    }
  }

  const date = url.searchParams.get("date") ?? "";
  const cohort = url.searchParams.get("cohort") ?? "";

  // 단건 조회
  if (date && cohort) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    // Firestore-first (source of truth). Legacy is only allowed with `?legacy=1`.
    try {
      const db = getDb();
      const snap = await db.collection("dailyContents").doc(docId(date, cohort)).get();
      if (snap.exists) {
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
        return NextResponse.json({ ok: true, source: "firestore", data });
      }

      // Not found in Firestore
      if (allowLegacy) {
        const row = await getAdminContent(date, cohort);
        return NextResponse.json({ ok: true, source: "legacy", data: row });
      }
      return NextResponse.json({ ok: true, source: "firestore", data: null });
    } catch (e) {
      console.error("[admin contents] firestore read failed", e);
      if (allowLegacy) {
        const row = await getAdminContent(date, cohort);
        return NextResponse.json({ ok: true, source: "legacy", data: row });
      }
      return NextResponse.json(
        { ok: false, source: "firestore", error: "Firestore read failed" },
        { status: 500 }
      );
    }
  }

  // 목록 조회 (테이블) - server-side pagination
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";

  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Math.min(500, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));

  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);

  // Firestore-first list (server-side pagination). Falls back to legacy local store on failure.
  try {
    const db = getDb();

    let q: FirebaseFirestore.Query = db.collection("dailyContents");

    if (cohort) {
      q = q.where("cohort", "==", cohort);
    }

    // date is stored as YYYY-MM-DD string; range filtering works lexicographically
    if (start) {
      q = q.where("date", ">=", start);
    }
    if (end) {
      q = q.where("date", "<=", end);
    }

    // Order first, then paginate
    q = q.orderBy("date", "desc");

    // Total count (best effort)
    let total = 0;
    try {
      const countSnap = await (q as any).count().get();
      total = Number(countSnap?.data?.().count ?? 0);
    } catch {
      // If count aggregation is unavailable, keep total as 0 (admin UI can still show items)
      total = 0;
    }

    const snap = await q.offset(offset).limit(limit).get();

    const items = snap.docs.map((d) => {
      const v = d.data() as any;
      const updatedAt =
        typeof v.updatedAt === "string"
          ? v.updatedAt
          : v.updatedAt?.toDate
            ? v.updatedAt.toDate().toISOString()
            : null;

      return {
        date: v.date ?? null,
        cohort: v.cohort ?? null,
        title: v.content?.title ?? v.title ?? null,
        category: v.category ?? null,
        priority: v.priority ?? null,
        updatedAt,
      };
    });

    return NextResponse.json({ ok: true, source: "firestore", items, total });
  } catch (e) {
    console.error("[admin contents] firestore paged list failed", e);

    if (allowLegacy) {
      const { items: rows, total } = await listAdminContentsPaged({ cohort, start, end, limit, offset });

      const items = rows.map((r) => ({
        date: r.date,
        cohort: r.cohort,
        title: r.content?.title ?? null,
        category: (r as any).category ?? null,
        priority: (r as any).priority ?? null,
        updatedAt: r.updatedAt ?? null,
      }));

      return NextResponse.json({ ok: true, source: "legacy", items, total });
    }

    const msg =
      process.env.NODE_ENV !== "production"
        ? String((e as any)?.message ?? e)
        : "Firestore list query failed";

    return NextResponse.json(
      { ok: false, source: "firestore", error: msg },
      { status: 500 }
    );
  }
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
    await db
      .collection("dailyContents")
      .doc(docId(body.date, body.cohort))
      .set(
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
          updatedAt: FieldValue.serverTimestamp(),
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
    await db.collection("dailyContents").doc(docId(date, cohort)).delete();
  } catch (e) {
    console.error("[admin contents] firestore delete failed", e);
  }

  return NextResponse.json({ ok: true, deleted: ok });
}