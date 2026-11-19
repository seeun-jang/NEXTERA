import { Placeholder } from "./Placeholder";

// SCREEN 05 · Zoro-1 의사결정 센터 — CP1. 구현할 때 이 파일 전체를 교체한다(§8 표 참고).
export default function DecisionPage() {
  return (
    <Placeholder
      no="05"
      title="Zoro-1 의사결정 센터"
      crumbs={["의사결정", "INC-0412"]}
      api="POST /api/decide"
      cp="CP1"
      parts={["모델 호출 배지(zoro1/MOCK)", "입력 스냅샷·적용 정책·메모 원문", "판단 요청 구조 JSON", "후보 5개(승인 요건)", "판단 결과 + 확률(zoro1일 때만) + 근거", "주 행동: 조건 변경 실험 → 06"]}
    />
  );
}
