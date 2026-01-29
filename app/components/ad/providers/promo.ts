import type { AdProviderResult } from "../types";

/**
 * Promo provider (MVP)
 * - Returns a single hard-coded card.
 * - Later, you can swap this to fetch from an API, rotate items, or use AdSense.
 */
export function getPromoForReadAction(): AdProviderResult {
  return {
    kind: "card",
    item: {
      id: "promo_read_001",
      title: "오늘의 추천",
      description: "지금 많이 읽는 콘텐츠를 확인해보세요.",
      ctaLabel: "확인하기",
      href: "/content", // placeholder; later replace with a real target
    },
  };
}