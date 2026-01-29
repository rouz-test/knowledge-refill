// 1) Add "use client" and imports at the very top:
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { birthYearToCohort, pickTodayContent } from "../lib/content";
import type { AdminContent, Cohort } from "../data/adminContents";
import { AdSlot } from "../components/ad/AdSlot";
import { getPromoForReadAction } from "../components/ad/providers/promo";

function WheelColumn(props: {
  value: number;
  values: number[];
  onChange: (v: number) => void;
  suffix: string;
  disabled?: boolean;
}) {
  const { value, values, onChange, suffix, disabled } = props;
  const ref = useMemo(() => ({ current: null as null | HTMLDivElement }), []);
  const ITEM_H = 36;
  const PAD = ITEM_H * 2; // to keep center line in the middle

  // Scroll to the selected value when it changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, values.indexOf(value));
    el.scrollTo({ top: idx * ITEM_H, behavior: "auto" });
  }, [value, values]);

  
    // nearest on scroll (update value when scrolling settles)
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
  
      let t: any = null;
  
      const commit = () => {
        const idx = Math.round(el.scrollTop / ITEM_H);
        const clampedIdx = Math.min(values.length - 1, Math.max(0, idx));
        const next = values[clampedIdx];
  
        // final snap alignment (prevents drifting so the number sits exactly in the highlight)
        el.scrollTo({ top: clampedIdx * ITEM_H, behavior: "smooth" });
  
        if (next !== value) onChange(next);
      };
  
      const onScroll = () => {
        if (disabled) return;
        if (t) clearTimeout(t);
        t = setTimeout(commit, 120);
      };
  
      el.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        if (t) clearTimeout(t);
        el.removeEventListener("scroll", onScroll as any);
      };
    }, [disabled, onChange, value, values]);

  return (
    <div>
      <div className="relative">
        {/* center highlight (anchored to the scroll area) */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-9 rounded-lg border border-purple-500/50 bg-purple-700/20 shadow-[0_0_0_1px_rgba(168,85,247,0.15)] pointer-events-none" />

        {/* top/bottom fade masks (anchored to the scroll area) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-xl bg-gradient-to-b from-slate-950/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-xl bg-gradient-to-t from-slate-950/70 to-transparent" />

        <div
          ref={(node) => {
            ref.current = node;
          }}
          className={[
            "h-[180px] overflow-y-auto rounded-xl border border-purple-800/30 bg-slate-950/20",
            "snap-y snap-mandatory",
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            disabled ? "pointer-events-none" : "",
          ].join(" ")}
          style={{ scrollPaddingTop: PAD, scrollPaddingBottom: PAD }}
        >
          <div aria-hidden="true" style={{ height: PAD }} />

          {values.map((v) => {
            const isSel = v === value;
            return (
              <div
                key={v}
                className={[
                  "h-9 flex items-center justify-center snap-center select-none",
                  isSel ? "text-purple-50 font-semibold" : "text-purple-200/65",
                ].join(" ")}
                style={{ height: ITEM_H }}
              >
                {String(v).padStart(2, "0")}
              </div>
            );
          })}

          <div aria-hidden="true" style={{ height: PAD }} />
        </div>
      </div>

      <div className="mt-2 text-center text-[10px] text-purple-300/60">{suffix}</div>
    </div>
  );
}


// 번들 무효화(정정/긴급 수정)용 전역 콘텐츠 버전
// 관리자 콘텐츠(풀/문구/정책)가 바뀌었는데 기존 번들을 모두 재생성해야 한다면 숫자를 올리세요.
const CONTENT_VERSION = 1;

// ------------------- Bundle 구조 및 helpers -------------------

const EMPTY_MESSAGES = [
  "오늘은 변화가 잠시 쉬어가는 날입니다.",
  "오늘은 새로 고칠 만큼의 이야기가 없었네요.",
  "오늘은 업데이트할 만큼의 변화가 감지되지 않았어요.",
];

type DailyBundle = {
  date: string; // YYYY-MM-DD (KST)
  cohort: string;
  contentId: string | null; // stable id for read tracking
  content: AdminContent | null; // frozen daily content snapshot
};

const bundleKey = (date: string, cohort: string) => `bundle:${date}:${cohort}`;

// 짧고 안정적인 해시 (djb2 변형)
function stableHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  // unsigned + base36
  return (h >>> 0).toString(36);
}

function normalizeSections(c: AdminContent): { past: string; change: string; detail: string } {
  const a = c as any;
  const s = a?.sections;

  // New schema
  if (s && typeof s === "object") {
    return {
      past: typeof s.past === "string" ? s.past : "",
      change: typeof s.change === "string" ? s.change : "",
      detail: typeof s.detail === "string" ? s.detail : "",
    };
  }

  // Legacy fallbacks (keep app working with old fields)
  return {
    past:
      (typeof a.previousContent === "string" ? a.previousContent : "") ||
      (typeof a.past === "string" ? a.past : ""),
    change:
      (typeof a.keyChange === "string" ? a.keyChange : "") ||
      (typeof a.change === "string" ? a.change : ""),
    detail:
      (typeof a.detail === "string" ? a.detail : "") ||
      (typeof a.currentContent === "string" ? a.currentContent : "") ||
      (typeof a.body === "string" ? a.body : ""),
  };
}

function makeContentId(date: string, cohort: string, c: AdminContent): string {
  const a = c as any;
  const sec = normalizeSections(c);

  const payload = [
    a.title ?? "",
    sec.past,
    sec.change,
    sec.detail,
    (a.category ?? "") as string,
    (a.priority ?? "") as string,
    // keep legacy fields in the hash too, just in case older items still rely on them
    (a.keyChange ?? "") as string,
    (a.previousContent ?? "") as string,
    (a.currentContent ?? "") as string,
    (a.body ?? "") as string,
  ].join("\n");

  return `${date}:${cohort}:${stableHash(payload)}`;
}

function readBundle(date: string, cohort: string): DailyBundle | null {
  try {
    const raw = localStorage.getItem(bundleKey(date, cohort));
    if (!raw) return null;
    return JSON.parse(raw) as DailyBundle;
  } catch {
    return null;
  }
}

function writeBundle(b: DailyBundle) {
  try {
    localStorage.setItem(bundleKey(b.date, b.cohort), JSON.stringify(b));
  } catch {
    // ignore
  }
}

// Prefer server API when available (admin-managed content), fall back to local picker.
async function fetchDailyFromApi(date: string, cohort: string): Promise<{
  content: AdminContent | null;
  resolvedFrom: string | null;
} | null> {
  try {
    const qs = new URLSearchParams({ date, cohort });
    const res = await fetch(`/api/content/daily?${qs.toString()}`, {
      method: "GET",
      headers: { "accept": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const payload = data?.ok === true ? data.data : null;

    const c = (payload?.content ?? null) as AdminContent | null;

    // The daily API returns badge fields at the data-level (category/priority).
    // The UI expects them on the content object, so merge them in for rendering & hashing.
    if (c && typeof c === "object") {
      const anyC = c as any;
      if (anyC.category == null && payload?.category != null) anyC.category = payload.category;
      if (anyC.priority == null && payload?.priority != null) anyC.priority = payload.priority;
    }

    return {
      content: c,
      resolvedFrom: (payload?.resolvedFrom ?? null) as string | null,
    };
  } catch {
    return null;
  }
}

function getOrCreateBundle(date: string, cohort: string): DailyBundle {
  const cached = readBundle(date, cohort);
  if (cached) return cached;

  const picked = pickTodayContent({ date, cohort: cohort as any });
  if (!picked) {
    const empty: DailyBundle = { date, cohort, contentId: null, content: null };
    writeBundle(empty);
    return empty;
  }

  const id = makeContentId(date, cohort, picked);
  const b: DailyBundle = { date, cohort, contentId: id, content: picked };
  writeBundle(b);
  return b;
}

// ------------------- localStorage cleanup policy -------------------
const META_LAST_CLEANUP_YMD = "meta:lastCleanupYMD";
const META_CONTENT_VERSION = "meta:contentVersion";
// ------------------- Reminder (local notification) settings -------------------
const META_REMINDER_ENABLED = "meta:reminderEnabled"; // "1" | "0"
const META_REMINDER_TIME = "meta:reminderTime"; // "HH:mm"
const DEFAULT_REMINDER_TIME = "21:00";
function splitTime(t: string): { h: number; m: number } {
  const [hh, mm] = t.split(":").map((v) => Number(v));
  return {
    h: Number.isFinite(hh) ? Math.min(23, Math.max(0, hh)) : 21,
    m: Number.isFinite(mm) ? Math.min(59, Math.max(0, mm)) : 0,
  };
}

function composeTime(h: number, m: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}`;
}

function deleteBundleAndLinkedRead(bundleStorageKey: string) {
  try {
    const raw = localStorage.getItem(bundleStorageKey);
    if (raw) {
      try {
        const b = JSON.parse(raw) as Partial<DailyBundle>;
        if (typeof b.contentId === "string" && b.contentId) {
          try {
            localStorage.removeItem(`read:${b.contentId}`);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    }
    localStorage.removeItem(bundleStorageKey);
  } catch {
    // ignore
  }
}

function collectBundleKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("bundle:")) keys.push(k);
    }
  } catch {
    // ignore
  }
  return keys;
}

// ✅ 부분 무효화: 특정 날짜/코호트 번들만 지우기
export function invalidateBundle(date: string, cohort: string, reason?: string) {
  deleteBundleAndLinkedRead(bundleKey(date, cohort));
  try {
    localStorage.setItem(
      "meta:lastInvalidationReason",
      reason ? `single:${date}:${cohort} ${reason}` : `single:${date}:${cohort}`
    );
  } catch {
    // ignore
  }
}

// ✅ 부분 무효화: 날짜 범위(+선택 코호트)로 번들 지우기
export function invalidateBundlesByDateRange(opts: {
  startYMD: string; // inclusive
  endYMD: string; // inclusive
  cohort?: string;
  reason?: string;
}) {
  const { startYMD, endYMD, cohort, reason } = opts;
  const keys = collectBundleKeys();

  for (const k of keys) {
    // 형식: bundle:YYYY-MM-DD:cohort
    const parts = k.split(":");
    if (parts.length < 3) continue;
    const date = parts[1];
    const ck = parts.slice(2).join(":");

    if (cohort && ck !== cohort) continue;
    if (date < startYMD || date > endYMD) continue;

    deleteBundleAndLinkedRead(k);
  }

  try {
    localStorage.setItem(
      "meta:lastInvalidationReason",
      reason
        ? `range:${startYMD}..${endYMD}${cohort ? `:${cohort}` : ""} ${reason}`
        : `range:${startYMD}..${endYMD}${cohort ? `:${cohort}` : ""}`
    );
  } catch {
    // ignore
  }
}

// ⚠️ 강제 전체 무효화(긴급용): 모든 번들/연결 read 삭제
function invalidateAllBundles(reason: string) {
  const keys = collectBundleKeys();
  for (const k of keys) deleteBundleAndLinkedRead(k);

  try {
    localStorage.setItem("meta:lastInvalidationReason", reason);
  } catch {
    // ignore
  }
}

function syncContentVersionAndInvalidateIfNeeded(currentVersion: number, todayYMD: string) {
  // 버전이 바뀌면 (정정/정책 변경) 기존 번들을 재생성해야 할 수 있습니다.
  // ✅ 기본 전략: 과거 기록은 유지하고 '오늘 이후(Forward-only)'만 무효화합니다.
  // (긴급 상황에서 전체 무효화가 필요하면 invalidateAllBundles를 별도로 사용할 수 있습니다.)
  try {
    const prev = localStorage.getItem(META_CONTENT_VERSION);
    const prevNum = prev ? Number(prev) : NaN;
    if (!Number.isFinite(prevNum) || prevNum !== currentVersion) {
      invalidateBundlesByDateRange({
        startYMD: todayYMD,
        endYMD: "9999-12-31",
        reason: `contentVersion ${prev ?? "(none)"} -> ${currentVersion}`,
      });
      localStorage.setItem(META_CONTENT_VERSION, String(currentVersion));
    }
  } catch {
    // ignore
  }
}

function cleanupOldBundles(retentionDays: number, todayYMD: string, todayShiftedKST: Date) {
  // Run at most once per day
  try {
    const last = localStorage.getItem(META_LAST_CLEANUP_YMD);
    if (last === todayYMD) return;
  } catch {
    // ignore
  }

  const cutoff = ymdFromShiftedKST(addDaysShiftedKST(todayShiftedKST, -retentionDays));

  // Collect keys first (do not mutate while iterating)
  const bundleKeys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("bundle:")) bundleKeys.push(k);
    }
  } catch {
    // ignore
  }

  for (const k of bundleKeys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const b = JSON.parse(raw) as Partial<DailyBundle>;
      const bDate = typeof b.date === "string" ? b.date : null;

      // YYYY-MM-DD는 문자열 비교로도 안전합니다.
      if (bDate && bDate < cutoff) {
        // delete linked read key if present
        if (typeof b.contentId === "string" && b.contentId) {
          try {
            localStorage.removeItem(`read:${b.contentId}`);
          } catch {
            // ignore
          }
        }
        try {
          localStorage.removeItem(k);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore malformed bundle
    }
  }

  try {
    localStorage.setItem(META_LAST_CLEANUP_YMD, todayYMD);
  } catch {
    // ignore
  }
}

/** ---------- Date helpers (KST 기준, 안전 버전) ---------- */
const pad2 = (n: number) => String(n).padStart(2, "0");

function kstNowShifted(): Date {
  // "지금"을 KST로 shift한 Date (이 Date는 UTC 필드로 KST 날짜를 표현할 수 있음)
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

function ymdFromShiftedKST(d: Date): string {
  // ✅ toISOString() 금지: UTC로 다시 바뀌며 날짜가 밀릴 수 있음
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function addDaysShiftedKST(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function shiftedKSTFromYMD(ymd: string): Date {
  // ymd: YYYY-MM-DD, returns a Date whose UTC fields represent that KST day
  const [y, m, d] = ymd.split("-").map((v) => Number(v));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function diffDaysYMD(aYMD: string, bYMD: string): number {
  // returns (b - a) in days
  const a = shiftedKSTFromYMD(aYMD).getTime();
  const b = shiftedKSTFromYMD(bYMD).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function dayLabelShiftedKST(d: Date) {
  const labels = ["일", "월", "화", "수", "목", "금", "토"];
  return labels[d.getUTCDay()];
}

function mmddShiftedKST(d: Date) {
  const mm = pad2(d.getUTCMonth() + 1);
  const dd = pad2(d.getUTCDate());
  return `${mm}.${dd}`;
}

/** ---------- UI bits ---------- */
function Badge({
  children,
  tone = "purple",
}: {
  children: React.ReactNode;
  tone?: "purple" | "red" | "amber" | "blue" | "slate";
}) {
  const toneClass =
    tone === "red"
      ? "bg-red-100 text-red-800 border-red-200"
      : tone === "amber"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : tone === "blue"
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : tone === "slate"
      ? "bg-slate-200 text-slate-800 border-slate-300"
      : "bg-purple-900/50 text-purple-200 border-purple-700";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs border rounded-md ${toneClass}`}
    >
      {children}
    </span>
  );
}

function priorityTone(_: "high" | "medium" | "low") {
  return "slate";
}

function priorityLabel(p?: "high" | "medium" | "low") {
  if (p === "high") return "중요";
  if (p === "medium") return "보통";
  if (p === "low") return "참고";
  return "일반";
}

function EmptyState({ message, ymd }: { message: string; ymd: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-center">
      <div className="text-purple-300/70">
        <div>{message}</div>
        <div className="mt-3 text-xs text-purple-300/40">— {ymd.replaceAll("-", ".")} —</div>
      </div>
    </div>
  );
}

function ContentView({ c }: { c: AdminContent }) {
  const a = c as any;
  return (
    <div className="space-y-6">
      {/* Title + Badges */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Badge>{a.category ?? "콘텐츠"}</Badge>
          {a.priority ? (
            <Badge tone={priorityTone(a.priority) as any}>{priorityLabel(a.priority)}</Badge>
          ) : null}
        </div>

        <h1 className="text-xl font-extrabold text-white">{c.title ?? "오늘의 업데이트"}</h1>
      </div>

      {/* 3-step template */}
      {(() => {
        const s = normalizeSections(c);
        const hasAny = !!(s.past?.trim() || s.change?.trim() || s.detail?.trim());

        if (!hasAny) {
          // Absolute fallback for unexpected empty content
          const fallback = (a.body ?? a.currentContent ?? a.detail ?? "") as string;
          return (
            <section className="rounded-xl border border-purple-800/40 bg-slate-900/40 p-5">
              <p className="text-[14px] leading-6 text-slate-100 whitespace-pre-wrap">{fallback || "내용이 비어 있습니다."}</p>
            </section>
          );
        }

        return (
          <div className="space-y-5">
            <section className="rounded-xl border border-purple-700/40 bg-gradient-to-br from-slate-900/55 to-slate-950/70 p-5">
              <div className="text-purple-200 text-sm font-bold mb-2">예전에는 이렇게 알려졌어요</div>
              <p className="text-[14px] leading-6 text-slate-200 whitespace-pre-wrap">{s.past || "(내용 없음)"}</p>
            </section>

            <section className="rounded-xl border border-purple-700/40 bg-gradient-to-br from-purple-900/35 to-slate-950/70 p-5">
              <div className="text-purple-200 text-sm font-bold mb-2">최근에는 이렇게 달라졌어요</div>
              <p className="text-[14px] leading-6 text-purple-50 whitespace-pre-wrap">{s.change || "(내용 없음)"}</p>
            </section>

            <section className="rounded-xl border border-purple-700/40 bg-gradient-to-br from-purple-900/45 to-purple-950/75 p-5 shadow-lg shadow-purple-900/20">
              <div className="text-purple-200 text-sm font-bold mb-2">조금 더 자세히 살펴보면...</div>
              <p className="text-[14px] leading-6 text-purple-50 whitespace-pre-wrap">{s.detail || "(내용 없음)"}</p>
            </section>
          </div>
        );
      })()}

      {/* Sources */}
      {c.sources?.length ? (
        <section className="rounded-xl border border-purple-800/30 bg-slate-900/30 p-4">
          <div className="text-sm font-bold text-purple-200 mb-2">출처</div>
          <ul className="list-disc pl-5 space-y-1">
            {c.sources.map((s, idx) => (
              <li key={`${s.url}-${idx}`} className="text-sm text-purple-100/90">
                <a className="underline underline-offset-2" href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Bottom Banner */}
      <div className="rounded-xl border border-purple-700/40 bg-gradient-to-r from-purple-900/40 to-purple-950/60 p-4 text-center">
        <p className="text-purple-200 text-sm">매일 새로운 지식으로 업데이트하세요 📚</p>
        <p className="text-purple-300/70 text-xs mt-1">지식은 계속 진화합니다. 최신 정보를 놓치지 마세요.</p>
      </div>
    </div>
  );
}


function WeeklyCalendar(props: {
  days: Date[];
  selectedDate: string;
  todayYMD: string;
  isReadSelected: boolean;
  dayReadMap: Record<string, boolean>;
  onSelectDate: (ymd: string) => void;
}) {
  const { days, selectedDate, todayYMD, isReadSelected, dayReadMap, onSelectDate } = props;

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const selectedBtnRef = useRef<HTMLButtonElement | null>(null);
  const scrollTimerRef = useRef<any>(null);
  const ignoreCommitRef = useRef(false);
  const ignoreTimerRef = useRef<any>(null);

  // Keep selected day centered when selection changes
  useEffect(() => {
    if (!selectedBtnRef.current) return;

    // Programmatic scroll can trigger the scroll-commit logic on wide viewports.
    // Briefly ignore commit while we center the selected item.
    ignoreCommitRef.current = true;
    if (ignoreTimerRef.current) clearTimeout(ignoreTimerRef.current);
    ignoreTimerRef.current = setTimeout(() => {
      ignoreCommitRef.current = false;
    }, 260);

    try {
      const el = scrollerRef.current;
      // Smooth scrolling on wide/desktop can keep firing scroll events longer, which may re-trigger commit.
      // Use smooth only on narrower viewports.
      const behavior: ScrollBehavior = el && el.clientWidth >= 560 ? "auto" : "smooth";
      selectedBtnRef.current.scrollIntoView({ behavior, inline: "center", block: "nearest" });
    } catch {
      // ignore
    }

    return () => {
      if (ignoreTimerRef.current) {
        clearTimeout(ignoreTimerRef.current);
        ignoreTimerRef.current = null;
      }
      ignoreCommitRef.current = false;
    };
  }, [selectedDate, days]);

  // Add dynamic side padding so edge items (like today at the end) can be centered
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const ITEM_W = 48; // w-12

    const apply = () => {
      // Left padding keeps early items centerable.
      // Right padding is intentionally minimal so the last item (today+3) sticks to the right edge
      // and users can't scroll into a large empty gap.
      const padLeft = Math.max(0, Math.floor(el.clientWidth / 2 - ITEM_W / 2));
      el.style.paddingLeft = `${padLeft}px`;
      el.style.paddingRight = `0px`;
    };

    apply();

    // Keep it correct on resize (DevTools device mode, orientation changes, etc.)
    try {
      const ro = new ResizeObserver(() => apply());
      ro.observe(el);
      return () => ro.disconnect();
    } catch {
      // Fallback
      window.addEventListener("resize", apply);
      return () => window.removeEventListener("resize", apply);
    }
  }, []);

  // When user stops scrolling, pick the day closest to center
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const commit = () => {
      const centerX = el.scrollLeft + el.clientWidth / 2;
      const children = Array.from(el.querySelectorAll<HTMLButtonElement>("button[data-ymd]"));
      if (!children.length) return;

      let best: HTMLButtonElement | null = null;
      let bestDist = Infinity;

      for (const btn of children) {
        const mid = btn.offsetLeft + btn.offsetWidth / 2;
        const dist = Math.abs(mid - centerX);
        if (dist < bestDist) {
          bestDist = dist;
          best = btn;
        }
      }

      // choose nearest non-future day
      let ymd = best?.dataset.ymd;
      if (!ymd) return;

      if (ymd > todayYMD) {
        // If center lands on a future day (allowed to be visible), pick the closest eligible day instead.
        const eligible = children.filter((btn) => {
          const v = btn.dataset.ymd;
          return !!v && v <= todayYMD;
        });
        if (!eligible.length) return;

        best = null;
        bestDist = Infinity;
        for (const btn of eligible) {
          const mid = btn.offsetLeft + btn.offsetWidth / 2;
          const dist = Math.abs(mid - centerX);
          if (dist < bestDist) {
            bestDist = dist;
            best = btn;
          }
        }

        ymd = best?.dataset.ymd;
        if (!ymd) return;
      }

      if (ymd !== selectedDate) onSelectDate(ymd);
    };

    const onScroll = () => {
      // Ignore scroll events triggered by programmatic centering.
      // While ignoring, keep extending the ignore window until scrolling settles.
      if (ignoreCommitRef.current) {
        if (ignoreTimerRef.current) clearTimeout(ignoreTimerRef.current);
        ignoreTimerRef.current = setTimeout(() => {
          ignoreCommitRef.current = false;
        }, 180);
        return;
      }

      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(commit, 140);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      if (ignoreTimerRef.current) {
        clearTimeout(ignoreTimerRef.current);
        ignoreTimerRef.current = null;
      }
      el.removeEventListener("scroll", onScroll as any);
    };
  }, [onSelectDate, selectedDate, todayYMD]);

  return (
    <div className="mt-4">
      <div className="w-full">
        <div
          ref={scrollerRef}
          className={[
            "overflow-x-auto",
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            "snap-x snap-mandatory",
          ].join(" ")}
        >
          <div className="flex gap-2 min-w-max py-1">
            {days.map((d) => {
              const ymd = ymdFromShiftedKST(d);
              const isSelected = ymd === selectedDate;
              const isToday = ymd === todayYMD;
              const isFutureDay = ymd > todayYMD;
              const dayIsRead = isFutureDay
                ? false
                : isSelected
                ? isReadSelected
                : !!dayReadMap[ymd];

              return (
                <button
                  key={ymd}
                  data-ymd={ymd}
                  ref={(node) => {
                    if (isSelected) selectedBtnRef.current = node;
                  }}
                  onClick={() => {
                    if (isFutureDay) return;
                    onSelectDate(ymd);
                  }}
                  disabled={isFutureDay}
                  className={[
                    "snap-center shrink-0",
                    // 7개가 자연스럽게 보이도록 고정 폭
                    "w-12",
                    "rounded-xl px-2 py-2 border text-center transition",
                    isFutureDay
                      ? "border-slate-800/40 bg-slate-950/20 text-slate-500 opacity-60 cursor-not-allowed"
                      : isSelected
                      ? "border-purple-400 bg-purple-700/35"
                      : isToday
                      ? "border-purple-600/60 bg-slate-900/50"
                      : "border-purple-900/40 bg-slate-950/30 hover:bg-slate-900/30",
                  ].join(" ")}
                  title={ymd}
                >
                  <div className={["text-xs", isSelected ? "text-purple-100" : "text-purple-200/70"].join(" ")}>
                    {dayLabelShiftedKST(d)}
                  </div>

                  <div
                    className={["mt-1 font-extrabold", isSelected ? "text-white" : "text-purple-50/85"].join(
                      " "
                    )}
                    style={{ fontSize: 13 }}
                  >
                    {mmddShiftedKST(d)}
                  </div>

                  {/* 상태 표시: 읽음 (✓)만 */}
                  <div className="mt-1 flex justify-center">
                    <span
                      className={[
                        "inline-flex items-center justify-center w-2.5 h-2.5 rounded-full",
                        isFutureDay
                          ? "bg-transparent"
                          : dayIsRead
                          ? isSelected
                            ? "bg-emerald-200 text-emerald-950"
                            : "bg-emerald-300 text-emerald-950"
                          : "bg-transparent",
                      ].join(" ")}
                      title={isFutureDay ? "" : dayIsRead ? "읽음" : "미읽음"}
                    >
                      {isFutureDay ? "" : dayIsRead ? "✓" : ""}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsModal(props: {
  open: boolean;
  onClose: () => void;
  enabled: boolean;
  time: string;
  onChangeEnabled: (v: boolean) => void;
  onChangeTime: (v: string) => void;
}) {
  const { open, onClose, enabled, time, onChangeEnabled, onChangeTime } = props;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-5">
      <button
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="설정 닫기"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[380px] rounded-2xl border border-purple-500/35 bg-gradient-to-b from-slate-900/95 to-slate-950/90 p-5 shadow-2xl shadow-black/30 ring-1 ring-white/5"
      >
        <div className="flex items-center justify-between">
          <div className="font-bold">설정</div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-200/90 hover:text-white hover:bg-white/10"
            aria-label="닫기"
            title="닫기"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Reminder toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-purple-100">매일 리마인드</div>
              <div className="mt-1 text-xs text-slate-300/80">원하는 시간에 앱을 열어보도록 알려드려요.</div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => onChangeEnabled(!enabled)}
              className={[
                "relative inline-flex h-6 w-11 items-center rounded-full transition",
                enabled ? "bg-purple-600" : "bg-slate-700",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-4 w-4 transform rounded-full bg-white transition",
                  enabled ? "translate-x-6" : "translate-x-1",
                ].join(" ")}
              />
            </button>
          </div>

          {/* Time wheel picker */}
          <div className={enabled ? "" : "opacity-40"}>
            <div className="text-xs text-slate-300 mb-2">알림 시간</div>
            {(() => {
              const { h, m } = splitTime(time);
              const hours = Array.from({ length: 24 }, (_, i) => i);
              const minutes = Array.from({ length: 60 }, (_, i) => i);

              return (
                <div className="grid grid-cols-2 gap-3">
                  <WheelColumn
                    value={h}
                    values={hours}
                    disabled={!enabled}
                    suffix="시"
                    onChange={(nextH) => onChangeTime(composeTime(nextH, m))}
                  />
                  <WheelColumn
                    value={m}
                    values={minutes}
                    disabled={!enabled}
                    suffix="분"
                    onChange={(nextM) => onChangeTime(composeTime(h, nextM))}
                  />
                </div>
              );
            })()}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-purple-500/30 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CohortPickerModal(props: {
  open: boolean;
  onClose: () => void;
  options: string[];
  value: string;
  myCohort: string | null;
  onPick: (v: string) => void;
}) {
  const { open, onClose, options, value, myCohort, onPick } = props;

  // --- PATCH: refs/state/effects for scroll & animation ---
  const listRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);

  // mount animation
  useEffect(() => {
    setMounted(false);
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // center the currently selected item when opening
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      try {
        selectedRef.current?.scrollIntoView({ block: "center", inline: "nearest" });
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(t);
  }, [open, value, options]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-5">
      <button
        className={[
          "absolute inset-0 backdrop-blur-[1px] transition-opacity duration-150",
          mounted ? "bg-black/35 opacity-100" : "bg-black/0 opacity-0",
        ].join(" ")}
        onClick={onClose}
        aria-label="연도대 선택 닫기"
      />

      <div
        role="dialog"
        aria-modal="true"
        className={[
          "relative w-full max-w-[380px] rounded-2xl border border-purple-500/35",
          "bg-gradient-to-b from-slate-900/95 to-slate-950/90 p-5",
          "shadow-2xl shadow-black/30 ring-1 ring-white/5",
          "transform-gpu transition-all duration-150",
          mounted ? "opacity-100 scale-100" : "opacity-0 scale-[0.98]",
        ].join(" ")}
      >
        <div className="flex items-center justify-between">
          <div className="font-bold text-white">다른 연도대</div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-200/90 hover:text-white hover:bg-white/10"
            aria-label="닫기"
            title="닫기"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 text-xs text-slate-300/80">선택한 연도대의 콘텐츠를 미리 볼 수 있습니다.</div>

        <div
          ref={listRef}
          className="mt-4 max-h-[50vh] overflow-y-auto rounded-xl border border-purple-800/25 bg-slate-950/20"
        >
          <ul className="divide-y divide-purple-900/25">
            {options.map((ck) => {
              const isMine = !!myCohort && ck === myCohort;
              const isSel = ck === value;
              return (
                <li key={ck}>
                  <button
                    type="button"
                    ref={(node) => {
                      if (isSel) selectedRef.current = node;
                    }}
                    onClick={() => {
                      onPick(ck);
                      onClose();
                    }}
                    className={[
                      "w-full px-4 py-3 text-left flex items-center justify-between",
                      "hover:bg-white/5 transition",
                      isSel ? "bg-purple-700/20" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={[
                          "text-sm",
                          isSel ? "text-white font-semibold" : "text-purple-100/90",
                        ].join(" ")}
                      >
                        {ck}
                      </div>
                      {isMine ? (
                        <span className="text-[10px] rounded-md px-2 py-0.5 border border-purple-500/30 bg-purple-700/15 text-purple-100/90">
                          내 연도대
                        </span>
                      ) : null}
                    </div>

                    <div className="text-sm">{isSel ? <span className="text-emerald-200">✓</span> : <span className="text-slate-500"> </span>}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="pt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-purple-500/30 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContentPage() {
  const router = useRouter();
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [isFading, setIsFading] = useState<boolean>(false);
  const [isRead, setIsRead] = useState<boolean>(false);
  const [weekReadMap, setWeekReadMap] = useState<Record<string, boolean>>({});
  const [viewCohortKey, setViewCohortKey] = useState<string | null>(null);
  const [adOpen, setAdOpen] = useState(false);
  const [adResult, setAdResult] = useState<ReturnType<typeof getPromoForReadAction> | null>(null);
  // DEV only: 빈 상태 UI 강제 미리보기 (?forceEmpty=1)
  const [forceEmptyUI, setForceEmptyUI] = useState(false);
  const searchParams = useSearchParams();
  const urlDate = searchParams.get("date");
  const urlCohort = searchParams.get("cohort");
  const forceServer = searchParams.get("forceServer") === "1";
  // Reminder settings (stored locally; laer used by native wrapper for local notifications)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [cohortPickerOpen, setCohortPickerOpen] = useState(false);

  const cohortKey = useMemo(() => {
    if (birthYear === null) return null;
    return birthYearToCohort(birthYear);
  }, [birthYear]);

  // viewCohortKey 기본값은 내 코호트로 설정
  useEffect(() => {
    if (!cohortKey) return;
    setViewCohortKey((prev) => (prev ? prev : cohortKey));
  }, [cohortKey]);

  const activeCohort = viewCohortKey ?? cohortKey;
  const isPreview = !!(activeCohort && cohortKey && activeCohort !== cohortKey);

  // 드롭다운 옵션(내 출생연도 주변 ±20년 코호트를 유니크하게)
  const cohortOptions = useMemo(() => {
    if (birthYear === null) return [] as string[];
    const seen = new Set<string>();
    const arr: string[] = [];
    for (let y = birthYear - 20; y <= birthYear + 20; y++) {
      const ck = birthYearToCohort(y);
      if (!seen.has(ck)) {
        seen.add(ck);
        arr.push(ck);
      }
    }
    return arr;
  }, [birthYear]);

  // 오늘(KST)을 기준으로 날짜 정보
  const todayObj = useMemo(() => kstNowShifted(), []);
  const todayYMD = useMemo(() => ymdFromShiftedKST(todayObj), [todayObj]);

  // 선택된 날짜(기본: 오늘)
  const [selectedDate, setSelectedDate] = useState<string>(todayYMD);
  useEffect(() => {
    if (!urlDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(urlDate)) return;
    setSelectedDate(urlDate);
  }, [urlDate]);

  // Allow admin preview links to set cohort: /content?date=...&cohort=1990s
  useEffect(() => {
    if (!urlCohort) return;
    // basic validation: allow letters/numbers and dashes (e.g., "common", "1990s")
    if (!/^[A-Za-z0-9-]+$/.test(urlCohort)) return;
    setViewCohortKey(urlCohort);
  }, [urlCohort]);

  const emptyMessage = useMemo(() => {
    return EMPTY_MESSAGES[Math.floor(Math.random() * EMPTY_MESSAGES.length)];
  }, [selectedDate]);

  // 안전장치: 어떤 이유로든 미래 날짜가 선택되면 오늘로 되돌림
  useEffect(() => {
    if (selectedDate > todayYMD) setSelectedDate(todayYMD);
  }, [selectedDate, todayYMD]);

  // 캘린더 슬라이더: 선택일 기준 31일 윈도우
  // ✅ 오늘 기준으로 미래 3일은 '보이되 선택 불가'로 노출 (오늘이 우측 끝에 붙는 문제 방지)
  const days = useMemo(() => {
    // 기본: -15 ~ +15
    // diffDaysYMD(selectedDate, todayYMD) = (today - selected) 일수
    const daysUntilToday = Math.max(0, diffDaysYMD(selectedDate, todayYMD));

    // 선택일 기준으로 '오늘까지'는 포함하되, 추가로 미래 3일을 더 보여줌(최대 +15 제한)
    const forwardMax = Math.min(15, daysUntilToday + 3);

    // 미래가 늘어나면 그만큼 과거를 줄여서 총 길이를 유지(31칸)
    const startOffset = -15 - (15 - forwardMax);
    const endOffset = forwardMax;

    const base = shiftedKSTFromYMD(selectedDate);
    return Array.from(
      { length: endOffset - startOffset + 1 },
      (_, i) => addDaysShiftedKST(base, startOffset + i)
    );
  }, [selectedDate, todayYMD]);

  const [bundle, setBundle] = useState<DailyBundle | null>(null);
  const content = bundle?.content ?? null;
  const displayContent = forceEmptyUI ? null : content;
  const bundleContentId = bundle?.contentId ?? null;

  // birthYear 로드
  useEffect(() => {
    // ------------------- Reminder settings load -------------------
    try {
      const en = localStorage.getItem(META_REMINDER_ENABLED);
      const t = localStorage.getItem(META_REMINDER_TIME);
      setReminderEnabled(en === "1");
      setReminderTime(t && /^\d{2}:\d{2}$/.test(t) ? t : DEFAULT_REMINDER_TIME);
    } catch {
      // ignore
    }
    // localStorage 정리: 번들/읽음 키가 무한히 쌓이지 않도록 최근 90일만 유지 (하루 1회)
    cleanupOldBundles(90, todayYMD, todayObj);
    // 번들 무효화(정정/정책 변경): CONTENT_VERSION이 바뀌면 '오늘 이후' 번들을 무효화하여 재생성
    syncContentVersionAndInvalidateIfNeeded(CONTENT_VERSION, todayYMD);
    // ------------------- TEMP invalidation trigger via URL params -------------------
    // 사용 예:
    // /content?invalidate=1&date=2026-01-21&cohort=1990s
    // /content?invalidate=1&start=2026-01-21&end=2026-01-31&cohort=1990s
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("invalidate") === "1") {
        const date = params.get("date");
        const start = params.get("start");
        const end = params.get("end");
        const cohort = params.get("cohort") ?? undefined;

        if (date && cohort) {
          invalidateBundle(date, cohort, "url-trigger");
        } else if (start && end) {
          invalidateBundlesByDateRange({
            startYMD: start,
            endYMD: end,
            cohort,
            reason: "url-trigger",
          });
        }

        // 동일 세션에서 재실행 방지 + URL 정리
        params.delete("invalidate");
        params.delete("date");
        params.delete("start");
        params.delete("end");
        params.delete("cohort");
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
        window.history.replaceState({}, "", next);
      }
    } catch {
      // ignore
    }
    // ------------------- DEV: empty-state preview via URL -------------------
    // 사용 예: /content?forceEmpty=1
    if (process.env.NODE_ENV !== "production") {
      try {
        const params = new URLSearchParams(window.location.search);
        setForceEmptyUI(params.get("forceEmpty") === "1");
      } catch {
        // ignore
      }
    }
    const saved = localStorage.getItem("birthYear");
    if (!saved) {
      router.replace("/birth-year");
      return;
    }
    const y = Number(saved);
    if (!Number.isFinite(y)) {
      router.replace("/birth-year");
      return;
    }
    setBirthYear(y);
  }, [router]);

  useEffect(() => {
    try {
      localStorage.setItem(META_REMINDER_ENABLED, reminderEnabled ? "1" : "0");
      localStorage.setItem(META_REMINDER_TIME, reminderTime);
    } catch {
      // ignore
    }
  }, [reminderEnabled, reminderTime]);

  // selectedDate 또는 birthYear 변경 시 콘텐츠 재조회 (bundle 고정 저장)
  // ✅ 오늘 이전/이하 날짜만 콘텐츠를 로드합니다.
  useEffect(() => {
    if (!activeCohort) return;
    setIsFading(true);

    if (selectedDate > todayYMD) {
      setBundle(null);
      return;
    }

    // 1) if cached bundle exists, use it immediately (unless forceServer=1)
    //    However, if the cached bundle is empty (content:null), or if it's "today",
    //    still try the server API in the background so admin updates can appear without manual invalidation.
    const cached = readBundle(selectedDate, activeCohort);

    // For rare corrections, allow a background refresh for recent past dates too.
    // diffDaysYMD(selectedDate, todayYMD) is (today - selected) in days.
    const daysAgo = diffDaysYMD(selectedDate, todayYMD);
    const isRecentPast = daysAgo >= 0 && daysAgo <= 7;

    const shouldBackgroundRefresh =
      !forceServer &&
      (!!cached && (cached.content === null || selectedDate === todayYMD || isRecentPast));

    if (cached && !forceServer) {
      setBundle(cached);
      if (!shouldBackgroundRefresh) return;
      // continue to server fetch in the background
    }

    // 2) otherwise, try server API first; fall back to local picker
    let cancelled = false;
    (async () => {
      // If we already used a cached non-empty bundle and we're not forcing server,
      // skip the API call.
      if (!forceServer && cached && cached.content !== null && selectedDate !== todayYMD && !isRecentPast) {
        return;
      }
      const api = await fetchDailyFromApi(selectedDate, activeCohort);

      if (cancelled) return;

      if (api) {
        const c = api.content;
        if (!c) {
          // If server has no content, do NOT clobber an existing non-empty bundle during background refresh.
          // Only write empty when forcing server OR when there is no cached content.
          if (forceServer || !cached || cached.content === null) {
            const empty: DailyBundle = { date: selectedDate, cohort: activeCohort, contentId: null, content: null };
            writeBundle(empty);
            if (!cancelled) setBundle(empty);
          }
          return;
        }

        const id = makeContentId(selectedDate, activeCohort, c);
        // forceServer=1: overwrite any existing local bundle snapshot
        const b: DailyBundle = { date: selectedDate, cohort: activeCohort, contentId: id, content: c };
        writeBundle(b);
        if (!cancelled) setBundle(b);
        return;
      }

      // fallback: local picker
      const picked = pickTodayContent({ date: selectedDate, cohort: activeCohort as any });
      if (!picked) {
        // forceServer=1: overwrite any existing local bundle snapshot
        const empty: DailyBundle = { date: selectedDate, cohort: activeCohort, contentId: null, content: null };
        writeBundle(empty);
        if (!cancelled) setBundle(empty);
        return;
      }

      const id = makeContentId(selectedDate, activeCohort, picked);
      // forceServer=1: overwrite any existing local bundle snapshot
      const b: DailyBundle = { date: selectedDate, cohort: activeCohort, contentId: id, content: picked };
      writeBundle(b);
      if (!cancelled) setBundle(b);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCohort, selectedDate, todayYMD, forceServer]);

  useEffect(() => {
    if (!isFading) return;
    const id = requestAnimationFrame(() => setIsFading(false));
    return () => cancelAnimationFrame(id);
  }, [bundle, isFading]);

  // ✅ 캘린더용 읽음 상태 맵 (bundle 기반, 날짜별 contentId 고정)
  // 프리뷰 모드에서는 읽음 표시를 하지 않습니다.
  useEffect(() => {
    if (!activeCohort) return;

    // ✅ 프리뷰 모드: 전체 false로 초기화
    if (isPreview) {
      const next: Record<string, boolean> = {};
      for (const d of days) {
        next[ymdFromShiftedKST(d)] = false;
      }
      setWeekReadMap(next);
      return;
    }

    const next: Record<string, boolean> = {};

    for (const d of days) {
      const ymd = ymdFromShiftedKST(d);

      // ✅ 미래 날짜는 번들을 만들지 않고, 읽음 표시도 하지 않습니다.
      if (ymd > todayYMD) {
        next[ymd] = false;
        continue;
      }

      const b = getOrCreateBundle(ymd, activeCohort);
      const cid = b.contentId;
      if (!cid) {
        next[ymd] = false;
        continue;
      }
      const key = `read:${cid}`;
      try {
        next[ymd] = localStorage.getItem(key) === "1";
      } catch {
        next[ymd] = false;
      }
    }

    setWeekReadMap(next);
  }, [activeCohort, days, isRead, isPreview, todayYMD]);

  // ✅ 읽음 키는 bundle이 발급한 contentId를 그대로 사용합니다.
  // 프리뷰 모드에서는 읽음 저장/표시를 하지 않기 위해 null 처리합니다.
  const readKey = !isPreview && bundleContentId ? `read:${bundleContentId}` : null;

  useEffect(() => {
    if (!readKey) {
      setIsRead(false);
      return;
    }
    try {
      const v = localStorage.getItem(readKey);
      const nextIsRead = v === "1";
      setIsRead(nextIsRead);
      // ✅ 선택된 날짜의 점 표시가 즉시 일치하도록 동기화
      if (bundleContentId && !isPreview && selectedDate <= todayYMD)
        setWeekReadMap((m) => ({ ...m, [selectedDate]: nextIsRead }));
    } catch {
      setIsRead(false);
      if (bundleContentId && !isPreview && selectedDate <= todayYMD)
        setWeekReadMap((m) => ({ ...m, [selectedDate]: false }));
    }
  }, [readKey, selectedDate, bundleContentId, isPreview, todayYMD]);

  const isFutureSelected = selectedDate > todayYMD; // YYYY-MM-DD 문자열 비교는 안전

  const readDisabled = isRead || isPreview || isFutureSelected || !readKey;
  const readTitle = isRead
    ? "읽음 처리됨"
    : isPreview
    ? "미리보기에서는 읽음이 저장되지 않습니다"
    : "읽음 처리";

  if (birthYear === null) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-3">
        <p className="text-purple-200/80">불러오는 중…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 border-b border-purple-800/30 bg-gradient-to-b from-purple-900/60 to-purple-950/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-purple-200 text-sm">오늘의 지식 리필</div>
              <div className="mt-1 text-purple-300 text-xs">{selectedDate}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className={[
                  "w-10 h-10 rounded-full",
                  "flex items-center justify-center",
                  "bg-slate-900/20 border border-purple-800/30",
                  "hover:bg-slate-900/45 active:scale-95 transition",
                  "shadow-sm shadow-black/20",
                ].join(" ")}
                aria-label="설정 열기"
                title={reminderEnabled ? `설정 · 리마인드 ${reminderTime}` : "설정 · 리마인드 꺼짐"}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  className="text-purple-100/90"
                >
                  <path
                    d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19.4 15a7.97 7.97 0 0 0 .1-6l1.6-1.2-1.9-3.3-1.9.8a8.05 8.05 0 0 0-5.2-2.3L11 1h-2l-.1 2a8.05 8.05 0 0 0-5.2 2.3l-1.9-.8L-.1 7.8 1.5 9a7.97 7.97 0 0 0 .1 6L-.1 16.2l1.9 3.3 1.9-.8a8.05 8.05 0 0 0 5.2 2.3l.1 2h2l.1-2a8.05 8.05 0 0 0 5.2-2.3l1.9.8 1.9-3.3-1.6-1.2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* ✅ 캘린더 (슬라이더 7칸) */}
          <WeeklyCalendar
            days={days}
            selectedDate={selectedDate}
            todayYMD={todayYMD}
            isReadSelected={isRead}
            dayReadMap={weekReadMap}
            onSelectDate={(ymd) => {
              setIsFading(true);
              setSelectedDate(ymd);
            }}
          />
        </div>
      </div>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-5 py-6 pb-28">
        <div className={["transition-opacity duration-150", isFading ? "opacity-0" : "opacity-100"].join(" ")}>
        {displayContent ? (
          <ContentView c={displayContent} />
        ) : (
          <EmptyState message={emptyMessage} ymd={selectedDate} />
        )}
        </div>
      </main>

      {/* Fixed Bottom Action */}
      <div className="fixed bottom-6 left-0 right-0 z-20 px-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4">
          {/* LEFT */}
          <div className="justify-self-end mr-2">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("birthYear");
                router.push("/birth-year");
              }}
              className="rounded-full px-3 py-2 sm:px-4 sm:py-3 text-xs bg-slate-900/35 border border-purple-800/35 text-purple-200/90 hover:bg-slate-900/55"
              title="출생연도 변경"
              aria-label="출생연도 변경"
            >
              {birthYear}년생 {cohortKey ? `(${cohortKey})` : ""}
            </button>
          </div>

          {/* CENTER */}
          <div className="justify-self-center">
            <button
              onClick={() => {
                if (readDisabled) return;
                try {
                  localStorage.setItem(readKey!, "1");
                } catch {
                  // ignore
                }
                setIsRead(true);
                setWeekReadMap((m) => ({ ...m, [selectedDate]: true }));
                // show promo ad after read
                const r = getPromoForReadAction();
                setAdResult(r);
                setAdOpen(true);
              }}
              className={[
                "w-14 h-14 rounded-full shadow-lg active:scale-95 transition flex items-center justify-center",
                readDisabled
                  ? "bg-slate-800 border border-slate-600"
                  : "bg-gradient-to-br from-purple-600 to-purple-900 shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/50",
              ].join(" ")}
              title={readTitle}
              aria-label={readTitle}
              disabled={readDisabled}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M20 6L9 17L4 12"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* RIGHT */}
          <div className="justify-self-start ml-2">
            <div className="flex items-center gap-2 rounded-full px-2 py-2 sm:px-3 sm:py-2 bg-slate-900/35 border border-purple-800/35 max-w-[150px] sm:max-w-none">
              <span className="hidden sm:inline text-xs text-purple-200/80">다른 연도대</span>

              <button
                type="button"
                onClick={() => {
                  if (!activeCohort) return;
                  setCohortPickerOpen(true);
                }}
                disabled={!activeCohort}
                className={[
                  "rounded-lg px-2 py-1 text-xs",
                  "bg-slate-900/40 border border-purple-800/40",
                  "w-[92px] sm:w-auto truncate",
                  "flex items-center justify-between gap-2",
                  !activeCohort ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-900/55",
                ].join(" ")}
                aria-label="다른 연도대 선택"
                title="다른 연도대 선택"
              >
                <span className="truncate">
                  {activeCohort}
                  {activeCohort === cohortKey ? " (나)" : ""}
                </span>
                <span className="text-purple-200/80">▾</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        enabled={reminderEnabled}
        time={reminderTime}
        onChangeEnabled={setReminderEnabled}
        onChangeTime={(v) => setReminderTime(v)}
      />
      <CohortPickerModal
        open={cohortPickerOpen}
        onClose={() => setCohortPickerOpen(false)}
        options={cohortOptions}
        value={activeCohort ?? ""}
        myCohort={cohortKey}
        onPick={(v) => setViewCohortKey(v)}
      />
      <AdSlot
        open={adOpen}
        result={adResult}
        onClose={() => {
          setAdOpen(false);
          setAdResult(null);
        }}
      />
    </div>
  );
  }