export type Cohort = `${number}s` | "all";

export type AdminContent = {
  id: string; // e.g. "2026-01-19__1990s"
  date: string; // "YYYY-MM-DD" or "evergreen"
  cohort: Cohort;
  title?: string;
  body: string;
  sources?: { label: string; url: string }[];
  status: "published" | "draft";
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  category?: string;
  priority?: "high" | "medium" | "low";
  keyChange?: string;
  previousContent?: string;
  currentContent?: string;
};

export const adminContents: AdminContent[] = [
  {
    id: "evergreen__all",
    date: "evergreen",
    cohort: "all",
    title: "항상 보여줄 기본 콘텐츠",
    body: "오늘의 콘텐츠가 아직 준비되지 않았습니다. 내일 다시 확인해 주세요.",
    status: "published",
    createdAt: "2026-01-19T09:00:00+09:00",
    updatedAt: "2026-01-19T09:00:00+09:00",
  },
  {
    id: "2026-01-19__1990s",
    date: "2026-01-19",
    cohort: "1990s",
    title: "Next.js App Router 최적화",
    body: "예시) 1990년대생을 위한 오늘의 지식 콘텐츠입니다.",
    category: "프로그래밍",
    priority: "medium",
    keyChange: "정적 셸을 먼저 보여주고, 동적 콘텐츠를 스트리밍으로 붙여 체감 속도가 개선됩니다.",
    previousContent: "이전에는 동적 요소가 하나라도 있으면 전체가 서버 렌더링되어 초기 로딩 체감이 느려질 수 있었습니다.",
    currentContent: "이제는 정적인 부분을 먼저 보여주고, 필요한 데이터만 점진적으로 로딩하는 구조로 더 빠른 UX를 만들 수 있습니다.",
    status: "published",
    createdAt: "2026-01-19T09:10:00+09:00",
    updatedAt: "2026-01-19T09:10:00+09:00",
  },
  {
    id: "2026-01-19__all",
    date: "2026-01-19",
    cohort: "all",
    title: "모두에게 해당되는 오늘의 지식",
    body: "예시) 모든 사용자에게 공통으로 보여줄 오늘의 콘텐츠입니다.",
    status: "published",
    createdAt: "2026-01-19T09:20:00+09:00",
    updatedAt: "2026-01-19T09:20:00+09:00",
  },
];