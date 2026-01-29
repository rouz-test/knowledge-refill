export type AdminContent = {
    // schema/versioning
    contentVersion?: number; // default: 2
    status?: "published" | "draft"; // default: "published"
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
  
  export type AdminRow = {
    date: string; // YYYY-MM-DD
    cohort: string;
    // badges stored at row-level so list endpoints can show them without parsing content
    category: string | null;
    priority: string | null;
    status: "published" | "draft";
    content: AdminContent;
    updatedAt: string; // ISO
  };
  
  // Use a global singleton so different route modules (which may load this file in different contexts)
  // still share the same in-memory store during dev.
  const GLOBAL_KEY = "__knowledge_refill_admin_store__";
  const g = globalThis as any;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map<string, AdminRow>();
  }
  const STORE: Map<string, AdminRow> = g[GLOBAL_KEY];
  
  function normDate(date: string) {
    return (date ?? "").trim();
  }
  
  function normCohort(cohort: string) {
    return (cohort ?? "").trim();
  }
  
  function keyOf(date: string, cohort: string) {
    return `${normDate(date)}:${normCohort(cohort)}`;
  }
  
  function normalizeContent(content: AdminContent): AdminContent {
    const v = typeof content?.contentVersion === "number" ? content.contentVersion : 2;
    const status = content?.status === "draft" ? "draft" : "published";
    // sections는 현재 필수지만, 혹시라도 비정상 입력을 방어
    const sections = content?.sections ?? { past: "", change: "", detail: "" };
    return {
      ...content,
      contentVersion: v,
      status,
      sections,
    };
  }

  function ensureRow(row: AdminRow): AdminRow {
    const content = normalizeContent(row.content);
    // Row-level status는 list에서 빠른 표시용이지만, content.status가 draft면 draft로 간주
    const status: "published" | "draft" =
      row.status === "draft" || content.status === "draft" ? "draft" : "published";

    return {
      ...row,
      status,
      content,
      category: row.category ?? null,
      priority: row.priority ?? null,
    };
  }
  
  export async function upsertAdminContent(
    date: string,
    cohort: string,
    content: AdminContent,
    category?: string | null,
    priority?: string | null
  ) {
    const normalized = normalizeContent(content);
    const status = normalized.status ?? "published";
    const row: AdminRow = {
      date: normDate(date),
      cohort: normCohort(cohort),
      category: category ?? null,
      priority: priority ?? null,
      status,
      content: normalized,
      updatedAt: new Date().toISOString(),
    };
    STORE.set(keyOf(date, cohort), row);
    return row;
  }
  
  export async function deleteAdminContent(date: string, cohort: string) {
    return STORE.delete(keyOf(date, cohort));
  }
  
  export async function getAdminContent(date: string, cohort: string) {
    const row = STORE.get(keyOf(date, cohort));
    return row ? ensureRow(row) : null;
  }
  
  export async function listAdminContents(opts?: {
    cohort?: string;
    start?: string; // inclusive
    end?: string;   // inclusive
    limit?: number;
  }) {
    const cohort = normCohort(opts?.cohort ?? "");
    const start = normDate(opts?.start ?? "");
    const end = normDate(opts?.end ?? "");
    const limitRaw = Number(opts?.limit ?? 50);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));
  
    const items: AdminRow[] = [];
    for (const row of STORE.values()) {
      if (cohort && row.cohort !== cohort) continue;
      if (start && row.date < start) continue;
      if (end && row.date > end) continue;
      items.push(ensureRow(row));
    }
  
    items.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1; // date desc
      return a.cohort.localeCompare(b.cohort); // cohort asc
    });
  
    return items.slice(0, limit);
  }
  
  // Server-side pagination (offset/limit)
  export async function listAdminContentsPaged(opts?: {
    offset?: number;
    limit?: number;
    cohort?: string;
    start?: string; // inclusive
    end?: string; // inclusive
  }): Promise<{ items: AdminRow[]; total: number }> {
    const cohort = normCohort(opts?.cohort ?? "");
    const start = normDate(opts?.start ?? "");
    const end = normDate(opts?.end ?? "");

    const offsetRaw = Number(opts?.offset ?? 0);
    const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);

    const limitRaw = Number(opts?.limit ?? 20);
    const limit = Math.min(500, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));

    const all: AdminRow[] = [];
    for (const row of STORE.values()) {
      if (cohort && row.cohort !== cohort) continue;
      if (start && row.date < start) continue;
      if (end && row.date > end) continue;
      all.push(ensureRow(row));
    }

    all.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1; // date desc
      return a.cohort.localeCompare(b.cohort); // cohort asc
    });

    const total = all.length;
    const items = all.slice(offset, offset + limit);
    return { items, total };
  }

  export async function listAdminContentDates(): Promise<string[]> {
    const set = new Set<string>();
    for (const row of STORE.values()) {
      if (row.date) set.add(row.date);
    }
    return Array.from(set).sort();
  }
  
  export type ResolveDailyResult = {
    resolvedFrom: "admin" | "none";
    status: "published" | "draft";
    category: string | null;
    priority: string | null;
    content: AdminContent | null;
    updatedAt: string | null;
  };
  
  // Content API uses this to resolve what to show for a given day/cohort.
  // For now we resolve only from admin uploads. (Evergreen can be re-added later.)
  export async function resolveDailyContent(date: string, cohort: string): Promise<ResolveDailyResult> {
    const row = await getAdminContent(normDate(date), normCohort(cohort));
    if (row) {
      return {
        resolvedFrom: "admin",
        status: row.status,
        category: row.category ?? null,
        priority: row.priority ?? null,
        content: row.content,
        updatedAt: row.updatedAt,
      };
    }
    return { resolvedFrom: "none", status: "published", category: null, priority: null, content: null, updatedAt: null };
  }