import { Placeholder } from "./Placeholder";

// SCREEN 04 · 운영 정책 — CP1. 구현할 때 이 파일 전체를 교체한다(§8 표 참고).
export default function PoliciesPage() {
  return (
    <Placeholder
      no="04"
      title="운영 정책"
      crumbs={["운영 정책", "활성 정책"]}
      api="GET /api/policies?version=1.2"
      cp="CP1"
      parts={["활성 정책 8개 표(유형 칩)", "역할별 권한 표", "AI가 고를 수 있는 행동 범위 7 → 5", "매뉴얼 발췌", "주 행동: 정책 적용 후 AI 판단 → 05"]}
    />
  );
}
