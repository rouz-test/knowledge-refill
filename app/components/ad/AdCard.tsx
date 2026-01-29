"use client";

import type { AdItem } from "./types";

export function AdCard({
  item,
  onClose,
}: {
  item: AdItem;
  onClose: () => void;
}) {
  const hasHref = typeof item.href === "string" && item.href.length > 0;

  return (
    <div className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-white/10 bg-black/60 text-white shadow-lg backdrop-blur">
      <div className="flex items-stretch gap-3 p-3">
        {/* Thumbnail (optional) */}
        <div className="h-14 w-14 shrink-0 rounded-xl bg-white/10" />

        {/* Text */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{item.title}</div>
          {item.description ? (
            <div className="mt-0.5 line-clamp-2 text-xs text-white/70">{item.description}</div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasHref ? (
            <a
              href={item.href}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15"
            >
              {item.ctaLabel ?? "열기"}
            </a>
          ) : null}

          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}