// Common types for ad / promo slots

export type AdKind = "card" | "external";

// A unified item shape that can represent promo cards now
// and real ads (e.g. AdSense) later.
export interface AdItem {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  ctaLabel?: string;
  href?: string;
}

// What an ad provider returns to the AdSlot
export type AdProviderResult =
  | {
      kind: "card";
      item: AdItem;
    }
  | {
      kind: "external";
      element: unknown; // e.g. AdSense block (rendered by provider)
    };