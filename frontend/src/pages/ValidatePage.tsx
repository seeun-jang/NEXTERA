import { Placeholder } from "./Placeholder";

// SCREEN 09 · 안전 검사 · Safety Gate — CP2. 구현할 때 이 파일 전체를 교체한다(§8 표 참고).
export default function ValidatePage() {
  return (
    <Placeholder
      no="09"
      title="안전 검사 · Safety Gate"
      crumbs={["의사결정", "안전 검사"]}
      api="POST /api/validate"
      cp="CP2"
      parts={["검사 대상", "CheckRow 5행", "조건부 허용 배너", "실행 직전 재검사 항목 4", "점선 패널: J07→N3 강제 입력 → 차단 블록 + 로그", "주 행동: 담당자 승인 요청 → 10"]}
    />
  );
}
