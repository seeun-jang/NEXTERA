import { Stepper } from "@/components/common";

// 사건 처리 5단계(스토리보드 03의 "사건 처리 단계"). 03~05 화면 상단에 같은 모양으로 둔다.
const STAGES = ["사건 감지", "사건 확인", "정책 확인", "AI 판단", "승인·실행"] as const;
export type Stage = (typeof STAGES)[number];

export function FlowSteps({ current }: { current: Stage }) {
  const idx = STAGES.indexOf(current);
  return (
    <div className="nx-flowsteps">
      <Stepper steps={STAGES.map((label, i) => ({ label, state: i < idx ? "done" : i === idx ? "current" : "todo" }))} />
    </div>
  );
}
