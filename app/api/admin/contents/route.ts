import { NextResponse } from "next/server";
import type { UpsertAdminContentRequest } from "@/app/lib/api-types";
import {
  deleteAdminContent,
  getAdminContent,
  listAdminContentDates,
  listAdminContentsPaged,
  upsertAdminContent,
} from "@/app/lib/admin-store.server";

function requireAdmin(req: Request) {
  const token = req.headers.get("x-admin-token") ?? "";
  const expected = process.env.ADMIN_TOKEN ?? "";
  if (!expected) return true; // dev 편의: env 없으면 통과
  return token === expected;
}

export async function GET(req: Request) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      return {
        title: (body.content as any).title,
        sections: {
          past: typeof s.past === "string" ? s.past : "",
          change: typeof s.change === "string" ? s.change : "",
          detail: typeof s.detail === "string" ? s.detail : "",
        },
      };
    }

    if (typeof (body.content as any).body === "string") {
      return {
        title: (body.content as any).title,
        sections: {
          past: "",
          change: "",
          detail: (body.content as any).body,
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

  return NextResponse.json({ ok: true, data: saved });
}

export async function DELETE(req: Request) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  return NextResponse.json({ ok: true, deleted: ok });
}