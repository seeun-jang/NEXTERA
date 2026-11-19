import { Placeholder } from "./Placeholder";

// SCREEN 03 · 사건 상세 · N4 열 위험 — CP1. 구현할 때 이 파일 전체를 교체한다(§8 표 참고).
export default function IncidentPage() {
  return (
    <Placeholder
      no="03"
      title="사건 상세 · N4 열 위험"
      crumbs={["운영 현황", "사건", "INC-0412"]}
      api="GET /api/incidents/:id"
      cp="CP1"
      parts={["온도 추이 + 조치 없을 때 5분 예측", "관련 운영 제약 POL-01~05", "왜 단순 임계값 규칙으로는 부족한가", "실행 작업·냉각 상태·정비 메모", "사건 처리 5단계", "주 행동: 회사 운영 정책 확인 → 04"]}
    />
  );
}
