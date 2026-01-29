export type CohortKey = string; // e.g. "1990s"
export type ContentScope = "common" | CohortKey;

export type ContentStatus = "published" | "draft";

export type SourceLink = { label: string; url: string };

export type AdminContent = {
  // schema/versioning
  contentVersion?: number; // default: 2
  status?: ContentStatus; // default: "published"

  title?: string;
  sections?: {
    past: string;
    change: string;
    detail: string;
  };

  // optional badges shown as chips
  category?: string | null;
  priority?: string | null;

  // optional sources
  sources?: SourceLink[];

  // legacy fields (kept only for backward-compat; do not use for new content)
  body?: string;
  keyChange?: string;
  previousContent?: string;
  currentContent?: string;
};

// DEPRECATED: legacy payload kept only for backward-compatibility
export type ContentPayloadV1 = {
  // schema/versioning
  contentVersion: 1;

  title?: string;
  sections: {
    past: string;
    change: string;
    detail: string;
  };
};

// Current payload shape (MAIN CONTRACT for user-facing content)
export type ContentPayloadV2 = {
  // schema/versioning
  contentVersion: 2;

  title?: string;
  sections: {
    past: string;
    change: string;
    detail: string;
  };

  // optional sources
  sources?: SourceLink[];
};

export type ContentPayload = ContentPayloadV2;

export type DailyContentResponse = {
  date: string;
  cohort: string;
  resolvedFrom: "admin" | "evergreen" | "none" | null;
  status: ContentStatus | null; // currently always treated as "published" if null
  category: string | null;
  priority: string | null;
  content: ContentPayload | null;   // ✅ main contract (currently v2)
  updatedAt: string | null;
};

export type UpsertAdminContentRequest = {
  date: string;
  cohort: ContentScope; // "common" or "1990s"
  category?: string | null;
  priority?: string | null;
  status?: ContentStatus; // optional override (default: published)
  content: AdminContent;
};

export type ApiError = { error: string };
export type ApiOk<T> = { ok: true; data: T };