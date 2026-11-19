import { Placeholder } from "./Placeholder";

// SCREEN 07 · A/B 판단 비교 — CP2. 구현할 때 이 파일 전체를 교체한다(§8 표 참고).
export default function ComparePage() {
  return (
    <Placeholder
      no="07"
      title="A/B 판단 비교"
      crumbs={["조건 실험", "S0 vs 분기"]}
      api="GET /api/experiments/:branch/compare"
      cp="CP2"
      parts={["바뀐 변수 배너", "A(실제)·B(가정) 두 열", "완료–마감 막대", "B에서 이동을 골랐다면 설명", "주 행동: 대안별 예상 결과 보기 → 08"]}
    />
  );
}
