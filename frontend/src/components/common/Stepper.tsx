import { Icon } from "./Icon";

export interface Step {
  label: string;
  state: "done" | "current" | "todo";
}

/** 진행 단계(AI 제안 → 정책 검사 → 승인 → 실행 …). 완료는 파란 체크, 현재는 파란 테두리 점. */
export function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol className="nx-stepper">
      {steps.map((s, i) => (
        <li key={s.label} className={`nx-step nx-step--${s.state}`}>
          {i > 0 && <span className="nx-step-line" aria-hidden="true" />}
          <span className="nx-step-dot">{s.state === "done" ? <Icon name="check" size={12} strokeWidth={3} /> : null}</span>
          <span className="nx-step-label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
