import { adminContents, AdminContent, Cohort } from "../data/adminContents";

export function birthYearToCohort(year: number): Cohort {
  const decade = Math.floor(year / 10) * 10;
  return `${decade}s`;
}

export function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function pickTodayContent(params: {
  date: string;
  cohort: Cohort;
}): AdminContent | null {
  const { date, cohort } = params;

  // status가 없던(과거/롤백) 데이터는 기본적으로 공개로 간주
  const isPublished = (c: AdminContent) => (c.status ?? "published") === "published";

  // 1) 오늘 + cohort
  let found =
    adminContents.find((c) => c.date === date && c.cohort === cohort && isPublished(c)) ??
    null;

  // 2) 오늘 + all
  if (!found) {
    found =
      adminContents.find((c) => c.date === date && c.cohort === "all" && isPublished(c)) ??
      null;
  }

  // 3) evergreen + cohort
  if (!found) {
    found =
      adminContents.find(
        (c) => c.date === "evergreen" && c.cohort === cohort && isPublished(c)
      ) ?? null;
  }

  // 4) evergreen + all
  if (!found) {
    found =
      adminContents.find(
        (c) => c.date === "evergreen" && c.cohort === "all" && isPublished(c)
      ) ?? null;
  }

  return found;
}