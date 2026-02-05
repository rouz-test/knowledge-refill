
"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { birthYearToCohort, pickTodayContent } from "../lib/content";
import type { AdminContent, Cohort } from "../data/adminContents";
import { AdSlot } from "../components/ad/AdSlot";
import { getPromoForReadAction } from "../components/ad/providers/promo";
import { SettingsModal } from "./_components/SettingsModal";
import { ServiceDocModal, type DocTab } from "./_components/ServiceDocModal";
import { CohortPickerModal } from "./_components/CohortPickerModal";

// RingBurstButton: Visual ring burst for button celebration effect
function RingBurstButton({ trigger }: { trigger: boolean }) {
  if (!trigger) return null;
  return (
    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <span className="btnRing" />
      <span className="btnRing btnRing2" />
      <style jsx>{`
        .btnRing {
          position: absolute;
          width: 96px;
          height: 96px;
          border-radius: 9999px;
          border: 2px solid rgba(168, 85, 247, 0.7);
          opacity: 0;
          transform: scale(0.6);
          animation: btnRing 520ms ease-out forwards;
        }
        .btnRing2 {
          width: 128px;
          height: 128px;
          border-color: rgba(216, 180, 254, 0.45);
          animation-delay: 70ms;
        }
        @keyframes btnRing {
          0% {
            opacity: 0;
            transform: scale(0.55);
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(1.35);
          }
        }
      `}</style>
    </span>
  );
}

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

function hasMeaningfulContent(c: AdminContent | null): boolean {
  if (!c) return false;
  const a = c as any;
  const s = normalizeSections(c);

  const hasSections = !!(s.past?.trim() || s.change?.trim() || s.detail?.trim());
  const hasLegacyBody = !!(
    (typeof a.body === "string" && a.body.trim()) ||
    (typeof a.currentContent === "string" && a.currentContent.trim()) ||
    (typeof a.detail === "string" && a.detail.trim())
  );
  const hasTitle = typeof a.title === "string" && a.title.trim().length > 0;

  // Consider it meaningful only if there is at least some real text to show.
  return hasSections || hasLegacyBody || hasTitle;
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
async function fetchDailyFromApi(
  date: string,
  cohort: string
): Promise<{
  content: AdminContent | null;
  resolvedFrom: string | null;
} | null> {
  const doFetch = async (cohortParam: string) => {
    const qs = new URLSearchParams({ date, cohort: cohortParam });
    const res = await fetch(`/api/content/daily?${qs.toString()}`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    // If the API uses 404 to mean “no content for this date/cohort”, treat it as a valid empty response.
    if (res.status === 404) {
      return { content: null as AdminContent | null, resolvedFrom: null as string | null };
    }
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
  };

  try {
    // 1) Try cohort-specific first.
    const primary = await doFetch(cohort);
    if (!primary) return null;

    // 2) If empty and not already `common`, fall back to common.
    if (!primary.content && cohort !== "common") {
      const common = await doFetch("common");
      return common ?? primary;
    }

    return primary;
  } catch {
    return null;
  }
}

function getOrCreateBundle(date: string, cohort: string): DailyBundle {
  const cached = readBundle(date, cohort);
  if (cached) return cached;

  // IMPORTANT: Do not auto-generate placeholder content for missing days.
  // Missing days should render EmptyState, not the 3-step template with “(내용 없음)”.
  const empty: DailyBundle = { date, cohort, contentId: null, content: null };
  writeBundle(empty);
  return empty;
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

function ReadCelebrationOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-6">
      {/* click-anywhere to close */}
      <button
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
        aria-label="읽음 축하 닫기"
      />

      <div className="celebrateCard relative pointer-events-none w-full max-w-[420px] rounded-3xl border border-purple-500/25 bg-gradient-to-b from-slate-900/95 to-slate-950/90 p-6 text-center shadow-2xl shadow-black/40 ring-1 ring-white/5">
        {/* Only text and pop animation, no rings */}
        <div className="text-3xl">🎉</div>
        <div className="mt-2 text-lg font-extrabold text-white">지식 한 조각이 쌓였어요!</div>
        <div className="mt-1 text-sm text-purple-200/80">
          오늘의 한 조각을 챙기셨네요. 내일도 이어가보세요.
        </div>
      </div>

      <style jsx>{`
        .celebrateCard {
          transform: translateY(6px) scale(0.985);
          opacity: 0;
          animation: popIn 220ms ease-out forwards;
        }
        @keyframes popIn {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.97);
          }
          60% {
            opacity: 1;
            transform: translateY(0px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0px) scale(1);
          }
        }
      `}</style>
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

  const centerSelected = (behaviorOverride?: ScrollBehavior) => {
    const btn = selectedBtnRef.current;
    const el = scrollerRef.current;
    if (!btn || !el) return;

    // Programmatic scroll can trigger the scroll-commit logic on wide viewports.
    // Briefly ignore commit while we center the selected item.
    ignoreCommitRef.current = true;
    if (ignoreTimerRef.current) clearTimeout(ignoreTimerRef.current);
    ignoreTimerRef.current = setTimeout(() => {
      ignoreCommitRef.current = false;
    }, 260);

    try {
      // Prefer auto on wider viewports to avoid long smooth-scroll event spam.
      const behavior: ScrollBehavior =
        behaviorOverride ?? (el.clientWidth >= 560 ? "auto" : "smooth");
      btn.scrollIntoView({ behavior, inline: "center", block: "nearest" });
    } catch {
      // ignore
    }
  };

  // Keep selected day centered when selection changes (layout-safe: prevents initial misalignment on mobile)
  useLayoutEffect(() => {
    centerSelected();

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
      // Side padding allows both first/last items to be centered.
      const sidePad = Math.max(0, Math.floor(el.clientWidth / 2 - ITEM_W / 2));
      el.style.paddingLeft = `${sidePad}px`;
      el.style.paddingRight = `${sidePad}px`;

      // After padding changes, re-center the selected item.
      // Use auto to avoid long smooth-scroll chains during resize/orientation changes.
      requestAnimationFrame(() => centerSelected("auto"));
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

                  {/* 상태 표시: 읽음 (✓) — SVG로 굵기 제어 */}
                  <div className="mt-1 flex justify-center min-h-[14px]">
                    {isFutureDay ? null : dayIsRead ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        className={isSelected ? "text-emerald-200" : "text-emerald-300"}
                        aria-label="읽음"
                      >
                        <path
                          d="M20 6L9 17L4 12"
                          stroke="currentColor"
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      // keep layout height stable
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="opacity-0"
                        aria-hidden="true"
                      >
                        <path
                          d="M20 6L9 17L4 12"
                          stroke="currentColor"
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
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



export default function ContentPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-3">
          <p className="text-purple-200/80">불러오는 중…</p>
        </main>
      }
    >
      <ContentPageInner />
    </Suspense>
  );
}

function ContentPageInner() {
  const router = useRouter();
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [isFading, setIsFading] = useState<boolean>(false);
  const [isRead, setIsRead] = useState<boolean>(false);
  const [weekReadMap, setWeekReadMap] = useState<Record<string, boolean>>({});
  const [viewCohortKey, setViewCohortKey] = useState<string | null>(null);
  const [adOpen, setAdOpen] = useState(false);
  const [adResult, setAdResult] = useState<ReturnType<typeof getPromoForReadAction> | null>(null);
  const [celebrateOpen, setCelebrateOpen] = useState(false);
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
  const [docOpen, setDocOpen] = useState(false);
  const [docTab, setDocTab] = useState<DocTab>("service");
  // Header auto-hide: hide on scroll down, show on scroll up
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const tickingRef = useRef(false);
  const lastToggleYRef = useRef(0);
  const lockUntilRef = useRef(0);
  const transitionUntilRef = useRef(0);
  // --- Keep headerHiddenRef in sync to avoid stale closure in scroll handler
  const headerHiddenRef = useRef(false);
  useEffect(() => {
    headerHiddenRef.current = headerHidden;
    // Keep a small safety window; primary lock is applied immediately in the scroll handler.
    transitionUntilRef.current = Math.max(transitionUntilRef.current, Date.now() + 120);
  }, [headerHidden]);
  useEffect(() => {
    // Simple rule: hide calendar when scrolled into content, show only near top.
    const SHOW_AT_Y = 0;
    const HIDE_AT_Y = 60;

    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;

      requestAnimationFrame(() => {
        const y = Math.max(0, window.scrollY);

        // Decide desired visibility based on absolute scroll position.
        // - Show calendar only when we're near the top.
        // - Hide once we've clearly moved into the body.
        const hidden = headerHiddenRef.current;

        if (y <= SHOW_AT_Y) {
          if (hidden) {
            headerHiddenRef.current = false;
            setHeaderHidden(false);
          }
        } else if (y >= HIDE_AT_Y) {
          if (!hidden) {
            headerHiddenRef.current = true;
            setHeaderHidden(true);
          }
        }

        tickingRef.current = false;
      });
    };

    // Initialize on mount
    try {
      onScroll();
    } catch {
      // ignore
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          // API says there is no content for this date/cohort.
          // Always reflect that as an empty bundle so the UI shows EmptyState.
          const empty: DailyBundle = { date: selectedDate, cohort: activeCohort, contentId: null, content: null };
          writeBundle(empty);
          if (!cancelled) setBundle(empty);
          return;
        }

        const id = makeContentId(selectedDate, activeCohort, c);
        // forceServer=1: overwrite any existing local bundle snapshot
        const b: DailyBundle = { date: selectedDate, cohort: activeCohort, contentId: id, content: c };
        writeBundle(b);
        if (!cancelled) setBundle(b);
        return;
      }

      // fallback: if server call failed, keep cached when available, otherwise show empty
      if (!forceServer && cached) {
        if (!cancelled) setBundle(cached);
        return;
      }

      const empty: DailyBundle = { date: selectedDate, cohort: activeCohort, contentId: null, content: null };
      writeBundle(empty);
      if (!cancelled) setBundle(empty);
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
      {/* Sticky Header (2-row: top stays, calendar auto-hides) */}
      <div className="sticky top-[var(--safe-top)] z-10 border-b border-purple-800/30 bg-gradient-to-b from-purple-900/60 to-purple-950/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-5 pt-5">
          {/* Top row: always visible */}
          <div className="flex items-start justify-between gap-4 pb-4">
            <div>
              <div className="text-purple-200 text-sm">오늘의 지식조각</div>
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
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>

              </button>
            </div>
          </div>

          {/* Calendar row: auto-hide on scroll (instant collapse to avoid mobile jank) */}
            <div
              className={[
                "overflow-hidden",
                "transition-none",
                headerHidden
                  ? "max-h-0 opacity-0 -translate-y-3 pointer-events-none"
                  : "max-h-[240px] opacity-100 translate-y-0",
              ].join(" ")}
              aria-hidden={headerHidden}
            >
            <div className="pb-5">
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
        </div>
      </div>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-5 py-6 pb-28">
        <div className={["transition-opacity duration-150", isFading ? "opacity-0" : "opacity-100"].join(" ")}>
        {displayContent && hasMeaningfulContent(displayContent) ? (
          <ContentView c={displayContent} />
        ) : (
          <EmptyState message={emptyMessage} ymd={selectedDate} />
        )}
        </div>
      </main>

      {/* Fixed Bottom Action */}
      <div className="fixed bottom-[calc(var(--safe-bottom)+24px)] left-0 right-0 z-20 px-5">
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

                // celebration overlay
                setCelebrateOpen(true);
                setTimeout(() => setCelebrateOpen(false), 950);

                // show promo ad shortly after (to avoid visual clash)
                const r = getPromoForReadAction();
                setTimeout(() => {
                  setAdResult(r);
                  setAdOpen(true);
                }, 650);
              }}
              className={[
                "w-14 h-14 rounded-full shadow-lg active:scale-95 transition flex items-center justify-center",
                "relative", // Ensure relative for ring burst positioning
                readDisabled
                  ? "bg-slate-800 border border-slate-600"
                  : "bg-gradient-to-br from-purple-600 to-purple-900 shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/50",
              ].join(" ")}
              title={readTitle}
              aria-label={readTitle}
              disabled={readDisabled}
            >
              <span className="relative inline-flex items-center justify-center">
                <RingBurstButton trigger={celebrateOpen} />
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
              </span>
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
                  "bg-slate-900/ border border-purple-800/40",
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
        onOpenDoc={(tab) => {
          setDocTab(tab);
          setDocOpen(true);
        }}
      />
      <ServiceDocModal
        open={docOpen}
        tab={docTab}
        onClose={() => setDocOpen(false)}
      />
      <CohortPickerModal
        open={cohortPickerOpen}
        onClose={() => setCohortPickerOpen(false)}
        cohorts={cohortOptions.map((key) => ({
          key,
          label: key,
          description:
            key === "common"
              ? "기본 코호트(공통)"
              : key === cohortKey
              ? "내 코호트"
              : undefined,
        }))}
        activeCohort={activeCohort ?? "common"}
        onSelect={(cohortKey) => setViewCohortKey(cohortKey)}
      />
      <ReadCelebrationOverlay open={celebrateOpen} onClose={() => setCelebrateOpen(false)} />
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