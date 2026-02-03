/* eslint-disable react/jsx-key */
"use client";

import { useEffect, useMemo, useRef, useState, Fragment, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type AdminContent = {
  title?: string;
  // badges shown as chips on the user content screen
  category?: string | null;
  priority?: string | null;
  sections: {
    past: string;
    change: string;
    detail: string;
  };
};

type AdminListItem = {
  date: string;
  cohort: string;
  title: string | null;
  category: string | null;
  priority: string | null;
  updatedAt: string | null;
};

function ymdTodayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const COHORT_OPTIONS = ["common", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s"] as const;


export default function AdminPage() {
  return (
    <Suspense
      fallback={<div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>불러오는 중…</div>}
    >
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const view = (sp.get("view") ?? "list") as "list" | "new" | "edit";
  const viewDate = sp.get("date") ?? "";
  const viewCohort = sp.get("cohort") ?? "";
  const [date, setDate] = useState(ymdTodayKST());
  const [cohort, setCohort] = useState<"common" | string>("common");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("콘텐츠");
  const [priority, setPriority] = useState<"high" | "medium" | "low" | null>(null);
  const [past, setPast] = useState("");
  const [change, setChange] = useState("");
  const [detail, setDetail] = useState("");

  const [status, setStatus] = useState<string>("");
  const [selectedKey, setSelectedKey] = useState<string>("");

  const [listItems, setListItems] = useState<AdminListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string>("");
  const [pageSize, setPageSize] = useState<16 | 20>(20);
  const [page, setPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmBypassRef = useRef(false);
  const [totalCount, setTotalCount] = useState(0);
  const [contentDates, setContentDates] = useState<string[]>([]);
  const [existsSameKey, setExistsSameKey] = useState(false);

  // 서버 페이지네이션: totalPages는 totalCount 기준
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // groupedByDate: 페이지별(현재 listItems 기준)
  const groupedByDate = useMemo(() => {
    const map: Record<string, AdminListItem[]> = {};
    for (const it of listItems) {
      if (!map[it.date]) map[it.date] = [];
      map[it.date].push(it);
    }
    return map;
  }, [listItems]);

  // 캘린더용 전체 날짜 목록
  const contentDateSet = useMemo(() => new Set(contentDates), [contentDates]);

  // 페이지 보정: totalCount/pageSize 기준
  useEffect(() => {
    const tp = Math.max(1, Math.ceil(totalCount / pageSize));
    setPage((p) => Math.min(Math.max(1, p), tp));
  }, [totalCount, pageSize]);

  function toYMDKSTFromDate(d: Date) {
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
    const day = String(kst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    const kst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
    return new Date(kst.getUTCFullYear(), kst.getUTCMonth(), 1);
  });
  
  function moveCalendarMonth(delta: number) {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }
  
  const calendarGrid = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const startDay = first.getDay(); // 0=Sun
    const start = new Date(year, month, 1 - startDay);
  
    const days: { date: Date; inMonth: boolean; ymd: string; hasContent: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const ymd = toYMDKSTFromDate(d);
      const inMonth = d.getMonth() === month;
      const hasContent = contentDateSet.has(ymd);
      days.push({ date: d, inMonth, ymd, hasContent });
    }
    return days;
  }, [calendarMonth, contentDateSet]);

  // 서버 페이지네이션: limit/offset 사용
  async function refreshList() {
    setListLoading(true);
    setListError("");
    try {
      const offset = (page - 1) * pageSize;
      const qs = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
      const res = await fetch(`/api/admin/contents?${qs.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) {
        const t = await res.text();
        setListError(`목록 실패 (${res.status}): ${t}`);
        setListItems([]);
        setTotalCount(0);
        return;
      }
      const json = (await res.json()) as { ok: boolean; items?: AdminListItem[]; total?: number };
      setListItems(Array.isArray(json.items) ? json.items : []);
      setTotalCount(typeof json.total === "number" ? json.total : 0);
    } catch (e: any) {
      setListError(`목록 실패: ${e?.message ?? String(e)}`);
      setListItems([]);
      setTotalCount(0);
    } finally {
      setListLoading(false);
    }
  }

  // 캘린더 날짜 목록 전체 fetch
  async function refreshCalendarDates() {
    try {
      const qs = new URLSearchParams({ mode: "dates" });
      const res = await fetch(`/api/admin/contents?${qs.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { ok: boolean; dates?: string[] };
      setContentDates(Array.isArray(json.dates) ? json.dates : []);
    } catch (e) {
      // 무시
    }
  }

  async function loadRowIntoForm(dateYMD: string, cohortValue: string) {
    setStatus("불러오는 중...");
    setSelectedKey(`${dateYMD}:${cohortValue}`);

    try {
      const qs = new URLSearchParams({ date: dateYMD, cohort: cohortValue });
      const res = await fetch(`/api/admin/contents?${qs.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        const t = await res.text();
        setStatus(`불러오기 실패 (${res.status}): ${t}`);
        return;
      }

      const json = (await res.json()) as {
        ok: boolean;
        data?: {
          date: string;
          cohort: string;
          category?: string | null;
          priority?: string | null;
          content?: {
            title?: string;
            body?: string; // legacy
            sections?: { past?: string; change?: string; detail?: string };
          };
        } | null;
      };

      const row = json.data;
      if (!row) {
        setStatus("불러올 데이터가 없습니다.");
        return;
      }

      setDate(row.date);
      setCohort(row.cohort);
      setTitle(row.content?.title ?? "");
      setCategory((row.category ?? "콘텐츠") || "콘텐츠");
      if (row.priority == null) {
        setPriority(null);
      } else {
        const p = row.priority.toString().trim().toLowerCase();
        setPriority(p === "high" || p === "medium" || p === "low" ? (p as any) : null);
      }

      const sec = row.content?.sections;
      setPast(sec?.past ?? "");
      setChange(sec?.change ?? "");
      // Backward-compat: legacy `body` becomes `detail`
      setDetail(sec?.detail ?? row.content?.body ?? "");

      setStatus("폼에 로드 완료 ✅");

      // optional: move focus to body for quick editing
      // (no ref yet; keep simple)
    } catch (e: any) {
      setStatus(`불러오기 실패: ${e?.message ?? String(e)}`);
    }
  }

  // 최초 마운트 시 목록+캘린더 날짜 fetch
  useEffect(() => {
    refreshList();
    refreshCalendarDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // page, pageSize 변경 시 목록 fetch
  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  // existsSameKey: view==='new' 시 date/cohort 변경마다 서버에서 존재 여부 확인
  useEffect(() => {
    if (view !== "new" || !date || !cohort) {
      setExistsSameKey(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ date, cohort });
        const res = await fetch(`/api/admin/contents?${qs.toString()}`, {
          method: "GET",
          cache: "no-store",
        });
        if (!res.ok) {
          setExistsSameKey(false);
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setExistsSameKey(json.ok && json.data ? true : false);
        }
      } catch {
        if (!cancelled) setExistsSameKey(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, date, cohort]);

  const cohortOptions = useMemo(() => {
    const base = [...COHORT_OPTIONS] as string[];
    const cur = (cohort ?? "").trim();
    if (cur && !base.includes(cur)) {
      // preserve unexpected/legacy cohorts so edit view doesn't break
      return [cur, ...base];
    }
    return base;
  }, [cohort]);

  const jsonHeaders = useMemo(() => ({ "Content-Type": "application/json" }), []);

  function goList() {
    router.push("/admin");
  }

  function goNew() {
    const qs = new URLSearchParams({ view: "new" });
    router.push(`/admin?${qs.toString()}`);
  }

  function goNewWithDate(d: string) {
    const qs = new URLSearchParams({ view: "new", date: d });
    router.push(`/admin?${qs.toString()}`);
  }

  function goEdit(d: string, c: string) {
    const qs = new URLSearchParams({ view: "edit", date: d, cohort: c });
    router.push(`/admin?${qs.toString()}`);
  }

  function resetFormToDefaults() {
    setDate(ymdTodayKST());
    setCohort("common");
    setTitle("");
    setCategory("콘텐츠");
    setPriority(null);
    setPast("");
    setChange("");
    setDetail("");
    setSelectedKey("");
    setStatus("");
  }

  async function onSave() {
    // In "new" view, prevent accidental overwrite for same date+cohort
    if (view === "new" && existsSameKey && !confirmBypassRef.current) {
      setConfirmOpen(true);
      setStatus("");
      return;
    }
    setStatus("저장 중...");
    try {
      // reset bypass once we enter the real save path
      confirmBypassRef.current = false;
      const res = await fetch("/api/admin/contents", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          date,
          cohort,
          category: category.trim() || null,
          priority,
          content: {
            title: title || undefined,
            sections: {
              past,
              change,
              detail,
            },
          },
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        setStatus(`저장 실패 (${res.status}): ${t}`);
        return;
      }

      setStatus("저장 완료 ✅  (이제 /content에서 확인해보세요)");
      await refreshList();
      await refreshCalendarDates();
      goList();
    } catch (e: any) {
      setStatus(`저장 실패: ${e?.message ?? String(e)}`);
    }
  }

  async function onDelete() {
    setStatus("삭제 중...");
    try {
      const qs = new URLSearchParams({ date, cohort });
      const res = await fetch(`/api/admin/contents?${qs.toString()}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const t = await res.text();
        setStatus(`삭제 실패 (${res.status}): ${t}`);
        return;
      }

      setStatus("삭제 완료 ✅");
      await refreshList();
      await refreshCalendarDates();
      goList();
    } catch (e: any) {
      setStatus(`삭제 실패: ${e?.message ?? String(e)}`);
    }
  }

  const previewUrl = useMemo(() => {
    const qs = new URLSearchParams();
    // /content 쪽이 cohort를 내부에서 계산한다면 파라미터는 필요 없을 수도 있지만,
    // 디버깅 용도로 남겨둡니다.
    qs.set("date", date);
    qs.set("cohort", cohort);
    qs.set("forceServer", "1");
    return `/content?${qs.toString()}`;
  }, [date, cohort]);

  useEffect(() => {
    if (view !== "edit") return;
    if (!viewDate || !viewCohort) return;
    // keep form in sync with URL
    loadRowIntoForm(viewDate, viewCohort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, viewDate, viewCohort]);

  useEffect(() => {
    if (view !== "new") return;
    resetFormToDefaults();
    if (viewDate) setDate(viewDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, viewDate]);

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>관리자 콘텐츠</h1>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            URL 파라미터(view/date/cohort) 기반으로 목록/생성/편집을 전환합니다.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={goList}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
          >
            목록
          </button>
          <button
            type="button"
            onClick={goNew}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #222", background: "#222", color: "#fff" }}
          >
            새로 만들기
          </button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              textDecoration: "none",
              color: "#111",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            미리보기
          </a>
        </div>
      </header>

      {status ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#f6f7f9", fontSize: 13 }}>
          {status}
        </div>
      ) : null}

      {view === "list" ? (
        <section style={{ marginTop: 18, display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 }}>
          {/* Left: calendar */}
          <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button
                type="button"
                onClick={() => moveCalendarMonth(-1)}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
              >
                ◀
              </button>
              <div style={{ fontWeight: 700 }}>
                {calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월
              </div>
              <button
                type="button"
                onClick={() => moveCalendarMonth(1)}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
              >
                ▶
              </button>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 6,
                fontSize: 12,
              }}
            >
              {(["일", "월", "화", "수", "목", "금", "토"] as const).map((d) => (
                <div key={d} style={{ textAlign: "center", opacity: 0.65 }}>
                  {d}
                </div>
              ))}
              {calendarGrid.map((cell) => (
                <button
                  key={cell.ymd}
                  type="button"
                  onClick={() => goNewWithDate(cell.ymd)}
                  title={cell.hasContent ? "해당 날짜에 콘텐츠가 있습니다" : "해당 날짜로 새 콘텐츠 작성"}
                  style={{
                    padding: "8px 0",
                    borderRadius: 10,
                    border: "1px solid #eee",
                    background: cell.hasContent ? "#111" : cell.inMonth ? "#fff" : "#fafafa",
                    color: cell.hasContent ? "#fff" : "#111",
                    opacity: cell.inMonth ? 1 : 0.55,
                    cursor: "pointer",
                  }}
                >
                  {cell.ymd.slice(-2)}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              검은 날짜 = 등록된 콘텐츠 있음 / 날짜 클릭 = 해당 날짜로 새 작성
            </div>
          </div>

          {/* Right: list */}
          <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 800 }}>목록</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 12, opacity: 0.75 }}>페이지 크기</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize((e.target.value === "16" ? 16 : 20) as 16 | 20)}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  <option value={20}>20</option>
                  <option value={16}>16</option>
                </select>
                <button
                  type="button"
                  onClick={refreshList}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                >
                  새로고침
                </button>
              </div>
            </div>

            {listError ? (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "#fff3f3", color: "#b00020", fontSize: 12 }}>
                {listError}
              </div>
            ) : null}

            <div style={{ marginTop: 12, borderTop: "1px solid #f0f0f0" }}>
              {listLoading ? (
                <div style={{ padding: 14, fontSize: 13, opacity: 0.75 }}>불러오는 중…</div>
              ) : listItems.length === 0 ? (
                <div style={{ padding: 14, fontSize: 13, opacity: 0.75 }}>등록된 콘텐츠가 없습니다.</div>
              ) : (
                Object.entries(groupedByDate)
                  .sort((a, b) => (a[0] < b[0] ? 1 : -1))
                  .map(([d, rows]) => (
                    <div key={d} style={{ padding: "10px 0" }}>
                      <div style={{ fontWeight: 800, marginBottom: 8 }}>{d}</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {rows.map((it) => (
                          <button
                            key={`${it.date}:${it.cohort}`}
                            type="button"
                            onClick={() => goEdit(it.date, it.cohort)}
                            style={{
                              textAlign: "left",
                              padding: 12,
                              borderRadius: 12,
                              border: "1px solid #eee",
                              background: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                              <div style={{ fontWeight: 700 }}>{it.title || "(제목 없음)"}</div>
                              <div style={{ fontSize: 12, opacity: 0.7 }}>{it.cohort}</div>
                            </div>
                            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                              {it.category || "콘텐츠"}
                              {it.priority ? ` · ${it.priority}` : ""}
                              {it.updatedAt ? ` · ${it.updatedAt}` : ""}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fff",
                  opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                이전
              </button>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {page} / {totalPages}
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fff",
                  opacity: page >= totalPages ? 0.5 : 1,
                }}
              >
                다음
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section style={{ marginTop: 18, border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: 12, opacity: 0.75 }}>날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 160 }}
            />

            <label style={{ fontSize: 12, opacity: 0.75 }}>코호트</label>
            <select
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            >
              {cohortOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <label style={{ fontSize: 12, opacity: 0.75 }}>카테고리</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 160 }}
            />

            <label style={{ fontSize: 12, opacity: 0.75 }}>중요도</label>
            <select
              value={priority ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setPriority(v === "" ? null : (v as any));
              }}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            >
              <option value={""}>없음</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </div>

          {view === "new" && existsSameKey ? (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "#fff7e6", fontSize: 12 }}>
              동일한 날짜/코호트 콘텐츠가 이미 존재합니다. 저장하면 덮어쓸 수 있습니다.
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    confirmBypassRef.current = true;
                    setConfirmOpen(false);
                    onSave();
                  }}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                >
                  덮어쓰기 저장
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
            />

            <textarea
              value={past}
              onChange={(e) => setPast(e.target.value)}
              placeholder="과거에 알려진 사실"
              rows={4}
              style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd", resize: "vertical" }}
            />
            <textarea
              value={change}
              onChange={(e) => setChange(e.target.value)}
              placeholder="변경된 사실"
              rows={4}
              style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd", resize: "vertical" }}
            />
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="자세한 설명"
              rows={8}
              style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd", resize: "vertical" }}
            />
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onSave}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #222", background: "#222", color: "#fff" }}
            >
              저장
            </button>

            {view === "edit" ? (
              <button
                type="button"
                onClick={onDelete}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
              >
                삭제
              </button>
            ) : null}

            <button
              type="button"
              onClick={goList}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
            >
              취소
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            선택 키: {selectedKey || "(없음)"}
          </div>
        </section>
      )}
    </main>
  );
}