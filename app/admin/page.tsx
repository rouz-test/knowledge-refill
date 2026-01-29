/* eslint-disable react/jsx-key */
"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
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
      {view === "list" ? (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>업로드된 콘텐츠</h1>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>/api/admin/contents 목록을 테이블로 보여줍니다.</div>
            </div>

            <button
              type="button"
              onClick={() => {
                resetFormToDefaults();
                goNew();
              }}
              style={{ marginLeft: "auto", padding: "10px 12px", borderRadius: 10, border: "1px solid #222", background: "#222", color: "#fff", fontSize: 13 }}
            >
              게시물 작성
            </button>

            <button
              type="button"
              onClick={refreshList}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontSize: 13 }}
            >
              {listLoading ? "불러오는 중…" : "새로고침"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontSize: 12, opacity: 0.85 }}>
            <div>
              총 <b>{totalCount}</b>개 · {page}/{totalPages}페이지
            </div>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>행</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const v = Number(e.target.value) as 16 | 20;
                    setPageSize(v);
                    setPage(1);
                  }}
                  style={{ padding: "6px 8px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontSize: 12 }}
                >
                  <option value={16}>16</option>
                  <option value={20}>20</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fff",
                  fontSize: 12,
                  opacity: page <= 1 ? 0.5 : 1,
                  cursor: page <= 1 ? "default" : "pointer",
                }}
              >
                이전
              </button>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fff",
                  fontSize: 12,
                  opacity: page >= totalPages ? 0.5 : 1,
                  cursor: page >= totalPages ? "default" : "pointer",
                }}
              >
                다음
              </button>
            </div>
          </div>

          {listError ? <div style={{ fontSize: 12, color: "#b42318", marginBottom: 10, whiteSpace: "pre-wrap" }}>{listError}</div> : null}

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, alignItems: "start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 12, background: "#fff" }}>
                <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.7, background: "#fafafa" }}>
                      <th style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>날짜</th>
                      <th style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>코호트</th>
                      <th style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>제목</th>
                      <th style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>배지1</th>
                      <th style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>배지2</th>
                      <th style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>업데이트</th>
                      <th style={{ padding: "10px 12px", borderBottom: "1px solid #eee" }}>미리보기</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(groupedByDate).length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 14, fontSize: 12, opacity: 0.7 }}>
                          아직 업로드된 콘텐츠가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      Object.entries(groupedByDate).map(([date, items]) => (
                        <Fragment key={date}>
                          <tr>
                            <td
                              colSpan={7}
                              style={{
                                padding: "12px 12px",
                                background: "#fafafa",
                                borderTop: "1px solid #eee",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.2px" }}>{date}</div>
                                <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>({items.length}개)</div>
                              </div>
                            </td>
                          </tr>
                          {items.map((it) => {
                            const key = `${it.date}:${it.cohort}`;
                            return (
                              <tr key={key} onClick={() => goEdit(it.date, it.cohort)} style={{ borderTop: "1px solid #eee", cursor: "pointer" }}>
                                <td style={{ padding: "10px 12px", fontSize: 13 }}>{it.date}</td>
                                <td style={{ padding: "10px 12px", fontSize: 13 }}>{it.cohort}</td>
                                <td style={{ padding: "10px 12px", fontSize: 13 }}>{it.title ?? "(제목 없음)"}</td>
                                <td style={{ padding: "10px 12px", fontSize: 13 }}>{it.category ?? "-"}</td>
                                <td style={{ padding: "10px 12px", fontSize: 13 }}>
                                  {it.priority === "high" ? "중요" : it.priority === "medium" ? "보통" : it.priority === "low" ? "참고" : "-"}
                                </td>
                                <td style={{ padding: "10px 12px", fontSize: 12, opacity: 0.8 }}>
                                  {it.updatedAt ? new Date(it.updatedAt).toLocaleString() : "-"}
                                </td>
                                <td style={{ padding: "10px 12px" }}>
                                  <a
                                    href={`/content?${new URLSearchParams({ date: it.date, cohort: it.cohort, forceServer: "1" }).toString()}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ fontSize: 12, textDecoration: "underline" }}
                                  >
                                    보기 ↗
                                  </a>
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ position: "sticky", top: 16 }}>
              <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={() => moveCalendarMonth(-1)}
                    style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontSize: 12 }}
                  >
                    ‹
                  </button>

                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월
                  </div>

                  <button
                    type="button"
                    onClick={() => moveCalendarMonth(1)}
                    style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontSize: 12 }}
                  >
                    ›
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 8, fontSize: 11, opacity: 0.65 }}>
                  {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
                    <div key={w} style={{ textAlign: "center" }}>
                      {w}
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                  {calendarGrid.map((cell) => {
                    const dayNum = cell.date.getDate();
                    // A) 콘텐츠 여부와 무관하게 클릭 가능하도록 disabled 조건 변경
                    const disabled = !cell.inMonth;

                    return (
                      <button
                        key={cell.ymd}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) return;
                          goNewWithDate(cell.ymd);
                        }}
                        // E) 툴팁(title) 변경
                        title={
                          cell.inMonth
                            ? cell.hasContent
                              ? "업로드된 콘텐츠가 있습니다. 클릭해서 작성 화면으로 이동"
                              : "콘텐츠가 없습니다. 클릭해서 작성"
                            : ""
                        }
                        // C) 스타일: 콘텐츠가 있는 날은 초록색 계열, border도 초록색 계열
                        style={{
                          height: 28,
                          borderRadius: 10,
                          background: !cell.inMonth
                            ? "#fafafa"
                            : cell.hasContent
                            ? "#E7F7EE" // light green background for days with content
                            : "#fff",
                          border: cell.hasContent ? "1px solid #16A34A" : "1px solid #eee",
                          color: !cell.inMonth ? "#999" : "#111",
                          fontSize: 12,
                          cursor: disabled ? "default" : "pointer",
                          opacity: disabled ? 0.55 : 1,
                          position: "relative",
                        }}
                      >
                        {dayNum}
                        {/* D) 점(span) 제거 */}
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: 10, fontSize: 11, opacity: 0.7, lineHeight: 1.4 }}>
                  • 초록색으로 표시된 날짜는 업로드된 콘텐츠가 있는 날입니다.
                  <br />
                  • 날짜를 클릭하면 해당 날짜로 게시물을 작성할 수 있습니다. (기존 콘텐츠가 있으면 덮어쓰기 경고가 표시됩니다.)
                </div>
              </div>
            </div>
          </div>
          
        </section>
      ) : (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{view === "new" ? "게시물 작성" : "게시물 편집"}</h1>

            <button
              type="button"
              onClick={goList}
              style={{ marginLeft: "auto", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontSize: 13 }}
            >
              목록으로
            </button>

            <a href={previewUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
              /content에서 미리보기 →
            </a>
          </div>

          {confirmOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                zIndex: 50,
              }}
              onClick={() => setConfirmOpen(false)}
            >
              <div
                style={{
                  width: "min(520px, 100%)",
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid #eee",
                  padding: 16,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>덮어쓰기 저장 확인</div>
                <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
                  {date} / {cohort} 조합의 콘텐츠가 이미 존재합니다.
                  <br />
                  그대로 저장하면 기존 콘텐츠가 덮어써집니다. 계속 진행할까요?
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontSize: 13 }}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmOpen(false);
                      confirmBypassRef.current = true;
                      onSave();
                    }}
                    style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #222", background: "#222", color: "#fff", fontSize: 13 }}
                  >
                    덮어쓰기 저장
                  </button>
                </div>
              </div>
            </div>
          ) : null}


          <div style={{ display: "grid", gap: 12 }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>날짜</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
                <div style={{ fontSize: 11, opacity: 0.6 }}>KST 기준으로 저장됩니다.</div>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>코호트</span>
                <select
                  value={cohort}
                  onChange={(e) => setCohort(e.target.value)}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                >
                  {cohortOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>오타 방지를 위해 목록에서 선택합니다.</div>
              </label>
            </div>

            {existsSameKey && view === "new" ? (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: "#b42318",
                  lineHeight: 1.4,
                }}
              >
                ⚠ 이미 해당 날짜와 코호트로 작성된 콘텐츠가 있습니다.
                <br />
                저장 시 기존 콘텐츠가 덮어써질 수 있습니다.
              </div>
            ) : null}

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.8 }}>제목 (선택)</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>배지 1</span>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>배지 2</span>
                <select
                  value={priority ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPriority(v === "" ? null : (v as any));
                  }}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                >
                  <option value="">선택 안 함</option>
                  <option value="high">중요</option>
                  <option value="medium">보통</option>
                  <option value="low">참고</option>
                </select>
              </label>
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.8 }}>과거에는 이렇게 알려져 있던 내용</span>
              <textarea
                value={past}
                onChange={(e) => setPast(e.target.value)}
                rows={5}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", resize: "vertical" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.8 }}>그리고 이렇게 변경되었어</span>
              <textarea
                value={change}
                onChange={(e) => setChange(e.target.value)}
                rows={4}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", resize: "vertical" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.8 }}>자세한 설명</span>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={9}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", resize: "vertical" }}
              />
            </label>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                onClick={onSave}
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #222", background: "#222", color: "#fff" }}
              >
                저장
              </button>
              <button onClick={onDelete} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}>
                삭제
              </button>

              {status ? <div style={{ marginLeft: "auto", fontSize: 13, opacity: 0.9 }}>{status}</div> : <div style={{ marginLeft: "auto" }} />}
            </div>

          </div>

        </section>
      )}
    </main>
  );
}