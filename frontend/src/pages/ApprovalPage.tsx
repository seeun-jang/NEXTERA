import { Placeholder } from "./Placeholder";

// SCREEN 10 · 협업 · 승인 — CP3. 구현할 때 이 파일 전체를 교체한다(§8 표 참고).
export default function ApprovalPage() {
  return (
    <Placeholder
      no="10"
      title="협업 · 승인"
      crumbs={["협업·승인"]}
      api="GET/POST /api/approvals/:id"
      cp="CP3"
      parts={["단계 표시", "제안 요약", "필요한 승인자(B 필수·A 참조)", "의견 목록·입력", "내 결정: 승인/수정 요청/거부·이관", "A로 보면 승인 비활성 + 사유", "주 행동: 승인 → 11"]}
    />
  );
}
