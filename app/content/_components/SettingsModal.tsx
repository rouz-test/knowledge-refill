"use client";

import React from "react";

export type DocTab = "service" | "privacy" | "terms";

export function SettingsModal(props: {
  open: boolean;
  onClose: () => void;
  enabled: boolean;
  time: string; // "HH:MM"
  onChangeEnabled: (v: boolean) => void;
  onChangeTime: (v: string) => void;
  onOpenDoc: (tab: DocTab) => void;
}) {
  const {
    open,
    onClose,
    enabled,
    time,
    onChangeEnabled,
    onChangeTime,
    onOpenDoc,
  } = props;

  if (!open) return null;

  function clamp2(n: number) {
    return String(n).padStart(2, "0");
  }

  function parseTime24(t: string) {
    const m = /^([0-2]\d):([0-5]\d)$/.exec(t);
    const hh = m ? Number(m[1]) : 9;
    const mm = m ? Number(m[2]) : 0;
    const isPM = hh >= 12;
    const h12 = ((hh + 11) % 12) + 1; // 1..12
    return { isPM, h12, mm };
  }

  function toTime24(isPM: boolean, h12: number, mm: number) {
    const h = h12 % 12;
    const hh = (isPM ? 12 : 0) + h;
    return `${clamp2(hh)}:${clamp2(mm)}`;
  }

  const parsed = React.useMemo(() => parseTime24(time), [time]);

  function displayTimeLabel() {
    const ap = parsed.isPM ? "오후" : "오전";
    const hh = clamp2(parsed.h12);
    const mm = clamp2(parsed.mm);
    return `${ap} ${hh}:${mm}`;
  }

  const ampmOptions = React.useMemo(() => ["오전", "오후"], []);
  const hourOptions = React.useMemo(() => Array.from({ length: 12 }, (_, i) => clamp2(i + 1)), []);
  const minuteOptions = React.useMemo(() => Array.from({ length: 60 }, (_, i) => clamp2(i)), []);

  function WheelColumn(props: {
    items: string[];
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
    ariaLabel: string;
  }) {
    const { items, value, onChange, disabled, ariaLabel } = props;
    const ref = React.useRef<HTMLDivElement | null>(null);

    // Scroll selected item into view when opened
    React.useEffect(() => {
      if (!ref.current) return;
      const idx = Math.max(0, items.indexOf(value));
      const el = ref.current.querySelector(`[data-idx="${idx}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: "center" });
    }, [items, value]);

    function pickNearest() {
      const root = ref.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const centerY = rootRect.top + rootRect.height / 2;
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      const nodes = Array.from(root.querySelectorAll("[data-idx]")) as HTMLElement[];
      for (const node of nodes) {
        const r = node.getBoundingClientRect();
        const cy = r.top + r.height / 2;
        const dist = Math.abs(cy - centerY);
        const idx = Number(node.getAttribute("data-idx") || 0);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      }
      const next = items[bestIdx];
      if (next && next !== value) onChange(next);
    }

    // Debounced scroll handling
    const scrollTimer = React.useRef<number | null>(null);

    return (
      <div className="relative">
        {/* top/bottom fade mask */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-xl bg-gradient-to-b from-slate-950/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-xl bg-gradient-to-t from-slate-950/70 to-transparent" />

        {/* selection window */}
        <div className="pointer-events-none absolute inset-x-2 top-1/2 h-10 -translate-y-1/2 rounded-xl border border-purple-500/30 bg-white/5" />

        <div
          ref={ref}
          aria-label={ariaLabel}
          aria-disabled={disabled ? true : undefined}
          className={
            "h-[164px] w-[92px] overflow-hidden rounded-xl border bg-black/10 px-2 py-2 text-center [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden " +
            (disabled ? "border-white/10 opacity-50" : "border-purple-500/25 overflow-y-auto")
          }
          style={{
            scrollSnapType: "y mandatory" as any,
            touchAction: disabled ? "none" : ("pan-y" as any),
          }}
          onScroll={() => {
            if (!ref.current) return;
            // If disabled, force the scroll position back to the selected value.
            if (disabled) {
              const idx = Math.max(0, items.indexOf(value));
              const el = ref.current.querySelector(`[data-idx="${idx}"]`) as HTMLElement | null;
              // Use rAF to avoid fighting the browser mid-scroll.
              requestAnimationFrame(() => {
                el?.scrollIntoView({ block: "center" });
              });
              return;
            }
            if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
            scrollTimer.current = window.setTimeout(() => {
              pickNearest();
            }, 80);
          }}
          onWheel={(e) => {
            if (!disabled) return;
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchMove={(e) => {
            if (!disabled) return;
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {/* spacers so first/last items can reach the center selection window */}
          <div aria-hidden className="h-[56px]" />
          {items.map((it, idx) => {
            const selected = it === value;
            return (
              <button
                key={it}
                type="button"
                data-idx={idx}
                disabled={disabled}
                onClick={() => onChange(it)}
                className={
                  "mx-auto my-0.5 block w-full rounded-lg py-2 text-sm transition " +
                  (selected
                    ? "text-white"
                    : "text-slate-200/70 hover:text-white")
                }
                style={{ scrollSnapAlign: "center" as any }}
              >
                {it}
              </button>
            );
          })}
          <div aria-hidden className="h-[56px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-5">
      {/* backdrop */}
      <button
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="설정 닫기"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[520px] rounded-2xl border border-purple-500/35 bg-gradient-to-b from-slate-900/95 to-slate-950/90 p-5 shadow-2xl shadow-black/30 ring-1 ring-white/5"
      >
        <div className="flex items-center justify-between">
          <div className="font-bold text-white">알림</div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-200/90 hover:text-white hover:bg-white/10"
            aria-label="닫기"
            title="닫기"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-purple-800/25 bg-slate-950/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-purple-100">매일 리마인드</div>
              <div className="mt-1 text-[12px] text-slate-300/75">
                지정한 시간에 오늘의 지식조각을 알려드려요.
              </div>
            </div>

            <button
              type="button"
              onClick={() => onChangeEnabled(!enabled)}
              className={
                "relative h-9 w-[64px] rounded-full border transition " +
                (enabled
                  ? "border-purple-400/50 bg-purple-500/40"
                  : "border-white/15 bg-white/5")
              }
              aria-pressed={enabled}
              aria-label={enabled ? "리마인드 켜짐" : "리마인드 꺼짐"}
              title={enabled ? "켜짐" : "꺼짐"}
            >
              <span
                className={
                  "absolute top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/80 shadow transition " +
                  (enabled ? "left-[34px]" : "left-[6px]")
                }
              />
            </button>
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold text-purple-200/90">알림 시간</div>
            <div className="mt-2">
              <div className="flex items-center justify-between">
                <div className="text-[12px] text-slate-300/70">
                  {enabled ? "휠을 스크롤해서 시간을 변경할 수 있어요." : "리마인드를 켜면 시간 변경이 가능합니다."}
                </div>
                <div className={"text-[12px] " + (enabled ? "text-purple-100" : "text-slate-400")}>
                  현재: {displayTimeLabel()}
                </div>
              </div>

              <div className={"mt-3 rounded-xl border p-4 " + (enabled ? "border-purple-500/25 bg-white/5" : "border-white/10 bg-white/5")}
              >
                <div className="flex items-center justify-center gap-3">
                  <WheelColumn
                    ariaLabel="오전/오후"
                    items={ampmOptions}
                    value={parsed.isPM ? "오후" : "오전"}
                    disabled={!enabled}
                    onChange={(v) => {
                      const isPM = v === "오후";
                      onChangeTime(toTime24(isPM, parsed.h12, parsed.mm));
                    }}
                  />
                  <WheelColumn
                    ariaLabel="시"
                    items={hourOptions}
                    value={clamp2(parsed.h12)}
                    disabled={!enabled}
                    onChange={(v) => {
                      const h12 = Math.min(12, Math.max(1, Number(v)));
                      onChangeTime(toTime24(parsed.isPM, h12, parsed.mm));
                    }}
                  />
                  <WheelColumn
                    ariaLabel="분"
                    items={minuteOptions}
                    value={clamp2(parsed.mm)}
                    disabled={!enabled}
                    onChange={(v) => {
                      const mm = Math.min(59, Math.max(0, Number(v)));
                      onChangeTime(toTime24(parsed.isPM, parsed.h12, mm));
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Service section */}
          <div className="pt-5">
            <div className="h-px w-full bg-purple-900/30" />
            <div className="mt-4 text-xs font-semibold text-purple-200/90">서비스</div>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => onOpenDoc("service")}
                className="w-full rounded-xl border border-purple-500/25 bg-white/5 px-4 py-2 text-left text-sm text-white hover:bg-white/10"
              >
                서비스 정보
              </button>
              <button
                type="button"
                onClick={() => onOpenDoc("privacy")}
                className="w-full rounded-xl border border-purple-500/25 bg-white/5 px-4 py-2 text-left text-sm text-white hover:bg-white/10"
              >
                개인정보 처리방침
              </button>
              <button
                type="button"
                onClick={() => onOpenDoc("terms")}
                className="w-full rounded-xl border border-purple-500/25 bg-white/5 px-4 py-2 text-left text-sm text-white hover:bg-white/10"
              >
                이용약관
              </button>
            </div>
            
          </div>
        </div>

        <div className="mt-4">
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