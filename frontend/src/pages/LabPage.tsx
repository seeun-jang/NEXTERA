import { Placeholder } from "./Placeholder";

// SCREEN 06 · 조건 실험 · Dynamic Constraint Lab — CP2. 구현할 때 이 파일 전체를 교체한다(§8 표 참고).
export default function LabPage() {
  return (
    <Placeholder
      no="06"
      title="조건 실험 · Dynamic Constraint Lab"
      crumbs={["조건 실험", "INC-0412"]}
      api="POST /api/experiments"
      cp="CP2"
      parts={["조건 6개: 실제 값 / 실험 값", "변경 1개 강조·변경 요약", "실험에서 바꿀 수 없는 필수 정책", "재판단 요청 JSON", "주 행동: 변경 조건으로 재판단 → 07"]}
    />
  );
}
