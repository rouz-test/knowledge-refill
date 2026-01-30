"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdProviderResult } from "./types";
import { AdCard } from "./AdCard";

export function AdSlot({
  open,
  result,
  onClose,
  autoHideMs,
}: {
  open: boolean;
  result: AdProviderResult | null;
  onClose: () => void;
  autoHideMs?: number;
}) {
  const [visible, setVisible] = useState(false);
  const effectiveAutoHideMs = autoHideMs ?? 6000;

  // When opened, animate in.
  useEffect(() => {
    if (open && result) {
      // next tick so transition can apply
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [open, result]);

  // Optional auto-hide timer (defaults to 6s when not provided)
  useEffect(() => {
    if (!open || !result) return;
    if (!effectiveAutoHideMs || effectiveAutoHideMs <= 0) return;

    let closeTimer: ReturnType<typeof setTimeout> | null = null;

    const t = setTimeout(() => {
      setVisible(false);
      // allow animation to finish before closing
      closeTimer = setTimeout(() => onClose(), 180);
    }, effectiveAutoHideMs);

    return () => {
      clearTimeout(t);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [open, result, effectiveAutoHideMs, onClose]);

  const content = useMemo(() => {
    if (!result) return null;
    if (result.kind === "card") {
      return <AdCard item={result.item} onClose={onClose} />;
    }
    // external element (e.g. AdSense block)
    return (
      <div className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-3 text-white shadow-lg backdrop-blur">
        {result.element as any}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }, [result, onClose]);

  if (!open || !result) return null;

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-3 z-50 px-3">
      <div
        className={
          "mx-auto w-full max-w-3xl transform transition-all duration-200 " +
          (visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0")
        }
      >
        {content}
      </div>
    </div>
  );
}