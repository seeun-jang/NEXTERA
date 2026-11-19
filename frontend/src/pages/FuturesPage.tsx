import { Placeholder } from "./Placeholder";

// SCREEN 08 · 병렬 미래 · Parallel Futures — P1. 구현할 때 이 파일 전체를 교체한다(§8 표 참고).
export default function FuturesPage() {
  return (
    <Placeholder
      no="08"
      title="병렬 미래 · Parallel Futures"
      crumbs={["의사결정", "병렬 미래"]}
      api="POST /api/futures"
      cp="P1"
      parts={["같은 S0·마감 5분에서 행동 3개", "온도 예측 미니 차트", "최고 온도·냉각 에너지·J07 완료·위험·제약 위반", "완료 작업량·잔여량", "주 행동: 실행 전 안전 검사 → 09"]}
    />
  );
}
