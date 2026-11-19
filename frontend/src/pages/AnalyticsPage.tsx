import { Placeholder } from "./Placeholder";

// SCREEN 13 · 기록 · 분석 — P1. 구현할 때 이 파일 전체를 교체한다(§8 표 참고).
export default function AnalyticsPage() {
  return (
    <Placeholder
      no="13"
      title="기록 · 분석"
      crumbs={["기록·분석", "운영 분석"]}
      api="GET /api/analytics"
      cp="P1"
      parts={["필터 4종", "KPI 6", "사건 유형별 분포", "실패 패턴 → 개선 조치", "최근 결정 표(클릭 → 12)"]}
    />
  );
}
