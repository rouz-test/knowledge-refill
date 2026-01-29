import fs from "fs/promises";
import path from "path";

export type AdminContent = {
    // schema/versioning
    contentVersion?: number; // default: 2
    status?: "published" | "draft"; // deprecated: status is not used; all content is treated as published
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
    status?: "published" | "draft"; // deprecated: status is not used; all rows are treated as published
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
  
  // Persist rows so user-facing API can resolve content consistently across route modules and restarts.
  const DATA_FILE = path.join(process.cwd(), "data", "adminContents.json");
  const LOAD_STATE_KEY = "__knowledge_refill_admin_store_load_state__";
  const WRITE_CHAIN_KEY = "__knowledge_refill_admin_store_write_chain__";
  
  if (!g[LOAD_STATE_KEY]) {
    g[LOAD_STATE_KEY] = { loaded: false, loading: null as null | Promise<void> };
  }
  if (!g[WRITE_CHAIN_KEY]) {
    g[WRITE_CHAIN_KEY] = Promise.resolve();
  }
  
  type LoadState = { loaded: boolean; loading: null | Promise<void> };
  const loadState: LoadState = g[LOAD_STATE_KEY];
  
  function enqueueWrite(task: () => Promise<void>) {
    // Serialize writes to avoid file corruption.
    g[WRITE_CHAIN_KEY] = (g[WRITE_CHAIN_KEY] as Promise<void>).then(task, task);
    return g[WRITE_CHAIN_KEY] as Promise<void>;
  }
  
  async function ensureStoreLoaded() {
    if (loadState.loaded) return;
    if (loadState.loading) return loadState.loading;
  
    loadState.loading = (async () => {
      try {
        const text = await fs.readFile(DATA_FILE, "utf8");
        const parsed = JSON.parse(text);
  
        const rows: AdminRow[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.items)
            ? parsed.items
            : parsed && typeof parsed === "object"
              ? Object.values(parsed)
              : [];
  
        for (const r of rows) {
          if (!r || typeof r !== "object") continue;
          // Best-effort hydration; ensure defaults later via ensureRow.
          const date = (r as any).date;
          const cohort = (r as any).cohort;
          if (!date || !cohort) continue;
          STORE.set(keyOf(String(date), String(cohort)), r as any);
        }
      } catch (e: any) {
        // If file doesn't exist yet, that's fine.
        if (e?.code !== "ENOENT") {
          console.warn("[admin-store] failed to load", e);
        }
      } finally {
        loadState.loaded = true;
      }
    })();
  
    return loadState.loading;
  }
  
  async function persistStore() {
    await enqueueWrite(async () => {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      const rows = Array.from(STORE.values());
      await fs.writeFile(DATA_FILE, JSON.stringify(rows, null, 2), "utf8");
    });
  }
  
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
    // status는 더 이상 사용하지 않음(항상 published로 취급). 기존 데이터 호환을 위해 입력에 남아있어도 무시.
    const { status: _ignoredStatus, ...rest } = (content as any) ?? {};
    // sections는 현재 필수지만, 혹시라도 비정상 입력을 방어
    const sections = (rest as any)?.sections ?? { past: "", change: "", detail: "" };
    return {
      ...(rest as any),
      contentVersion: v,
      sections,
    };
  }
  
  function ensureRow(row: AdminRow): AdminRow {
    const content = normalizeContent(row.content);
    return {
      ...row,
      // status는 더 이상 사용하지 않음(항상 published로 취급). 기존 데이터 호환을 위해 필드는 유지하되 강제하지 않음.
      status: "published",
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
    await ensureStoreLoaded();
    const normalized = normalizeContent(content);
    const row: AdminRow = {
      date: normDate(date),
      cohort: normCohort(cohort),
      category: category ?? null,
      priority: priority ?? null,
      status: "published",
      content: normalized,
      updatedAt: new Date().toISOString(),
    };
    STORE.set(keyOf(date, cohort), row);
    await persistStore();
    return row;
  }
  
  export async function deleteAdminContent(date: string, cohort: string) {
    await ensureStoreLoaded();
    const ok = STORE.delete(keyOf(date, cohort));
    if (ok) await persistStore();
    return ok;
  }
  
  export async function getAdminContent(date: string, cohort: string) {
    await ensureStoreLoaded();
    const row = STORE.get(keyOf(date, cohort));
    return row ? ensureRow(row) : null;
  }
  
  export async function listAdminContents(opts?: {
    cohort?: string;
    start?: string; // inclusive
    end?: string;   // inclusive
    limit?: number;
  }) {
    await ensureStoreLoaded();
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
    await ensureStoreLoaded();
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
    await ensureStoreLoaded();
    const set = new Set<string>();
    for (const row of STORE.values()) {
      if (row.date) set.add(row.date);
    }
    return Array.from(set).sort();
  }
  
export type ResolveDailyResult = {
  resolvedFrom: "admin" | "common" | "none";
    status?: "published" | "draft"; // deprecated: always treated as published
    category: string | null;
    priority: string | null;
    content: AdminContent | null;
    updatedAt: string | null;
  };
  
  // Content API uses this to resolve what to show for a given day/cohort.
  // For now we resolve only from admin uploads. (Evergreen can be re-added later.)
export async function resolveDailyContent(date: string, cohort: string): Promise<ResolveDailyResult> {
  await ensureStoreLoaded();

  const d = normDate(date);
  const c = normCohort(cohort);

  // 1) Try exact cohort first
  const exact = await getAdminContent(d, c);
  if (exact) {
    return {
      resolvedFrom: "admin",
      status: "published",
      category: exact.category ?? null,
      priority: exact.priority ?? null,
      content: exact.content,
      updatedAt: exact.updatedAt,
    };
  }

  // 2) Fallback to `common` when cohort-specific content does not exist
  if (c && c !== "common") {
    const common = await getAdminContent(d, "common");
    if (common) {
      return {
        resolvedFrom: "common",
        status: "published",
        category: common.category ?? null,
        priority: common.priority ?? null,
        content: common.content,
        updatedAt: common.updatedAt,
      };
    }
  }

  return {
    resolvedFrom: "none",
    status: "published",
    category: null,
    priority: null,
    content: null,
    updatedAt: null,
  };
}