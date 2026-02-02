"use client";

import React from "react";

export function CohortPickerModal(props: {
  open: boolean;
  onClose: () => void;
  cohorts: Array<{ key: string; label: string; description?: string }>;
  activeCohort: string;
  onSelect: (cohortKey: string) => void;
}) {
  const { open, onClose, cohorts, activeCohort, onSelect } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-5">
      {/* backdrop */}
      <button
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="코호트 선택 닫기"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[520px] rounded-2xl border border-purple-500/35 bg-gradient-to-b from-slate-900/95 to-slate-950/90 p-5 shadow-2xl shadow-black/30 ring-1 ring-white/5"
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

        <div className="mt-2 text-[12px] leading-5 text-slate-300/75">
          선택한 연도대의 콘텐츠를 미리 볼 수 있습니다.
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2">
          {cohorts.map((c) => {
            const selected = c.key === activeCohort;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  onSelect(c.key);
                  onClose();
                }}
                className={
                  "w-full rounded-xl border px-4 py-3 text-left transition " +
                  (selected
                    ? "border-purple-400/60 bg-purple-500/20"
                    : "border-purple-500/25 bg-white/5 hover:bg-white/10")
                }
                aria-pressed={selected}
                title={selected ? "선택됨" : "선택"}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">{c.label}</div>
                  <div className="flex items-center gap-2">
                    {c.description ? (
                      <span className="rounded-full border border-purple-500/35 bg-purple-500/15 px-2 py-0.5 text-[11px] text-purple-100">
                        {c.description}
                      </span>
                    ) : null}
                    {selected ? (
                      <span className="text-purple-200" aria-label="선택됨">
                        ✓
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
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