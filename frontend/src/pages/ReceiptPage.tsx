import { Placeholder } from "./Placeholder";

// SCREEN 12 · 결정 영수증 · Decision Receipt — CP3. 구현할 때 이 파일 전체를 교체한다(§8 표 참고).
export default function ReceiptPage() {
  return (
    <Placeholder
      no="12"
      title="결정 영수증 · Decision Receipt"
      crumbs={["기록·분석", "결정 영수증"]}
      api="GET /api/receipts/:id"
      cp="CP3"
      parts={["사건·정책 버전·입력 스냅샷·판단 제공자", "① 조건과 실험 분기", "② 후보와 독립 검사", "③ 권한자 승인", "④ 결정 흐름(MOCK·가정 칩 보존)", "주 행동: 기록 상세 보기 → 13"]}
    />
  );
}
