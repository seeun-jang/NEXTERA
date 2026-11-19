import { Icon } from "./Icon";

// 단계 안내 띠 — 모든 앱 화면 위에 "지금 어느 단계 · 이 화면에서 하는 일 · 다음 화면"을 보여 준다.
// 단계 색은 식별용(상태 의미 없음). 색만으로 구분하지 않도록 단계 이름·번호를 항상 글자로 함께 쓴다.

export const PARTS = [
  { key: "observe", name: "상황", color: "var(--st-1)" },
  { key: "decide", name: "판단", color: "var(--st-2)" },
  { key: "lab", name: "판단 실험", color: "var(--st-3)" },
  { key: "control", name: "통제된 실행", color: "var(--st-4)" },
  { key: "record", name: "결정 영수증", color: "var(--st-5)" },
] as const;

interface Step {
  no: string;
  title: string;
  part: number; // PARTS 인덱스
  desc: string;
  next?: string;
  match: (p: string) => boolean;
}

export const STEPS: Step[] = [
  { no: "02", title: "운영 현황", part: 0, desc: "클러스터 상태를 보고 조치가 필요한 사건을 찾습니다.", next: "03 사건 상세", match: (p) => p.startsWith("/operations") },
  { no: "03", title: "사건 상세", part: 0, desc: "AI를 부르기 전에 무엇이 문제이고 어떤 제약이 걸렸는지 확인합니다.", next: "04 운영 정책", match: (p) => p.startsWith("/incidents/") },
  { no: "04", title: "운영 정책", part: 1, desc: "회사 규칙이 AI가 고를 수 있는 행동의 범위를 정합니다.", next: "05 의사결정 센터", match: (p) => p.startsWith("/policies") },
  { no: "05", title: "의사결정 센터", part: 1, desc: "정책을 통과한 후보 중 Zoro-1이 무엇을 골랐는지 확인합니다.", next: "06 조건 실험", match: (p) => /^\/decision\/[^/]+$/.test(p) },
  { no: "06", title: "조건 실험", part: 2, desc: "조건 하나만 바꿔 같은 상황을 다시 판단합니다. 실제 운영 값은 바뀌지 않습니다.", next: "07 A/B 판단 비교", match: (p) => p.startsWith("/lab") && !p.endsWith("/compare") },
  { no: "07", title: "A/B 판단 비교", part: 2, desc: "원래 조건과 바꾼 조건의 판단을 나란히 놓고 왜 달라졌는지 봅니다.", next: "08 병렬 미래 또는 09 안전 검사", match: (p) => p.startsWith("/lab") && p.endsWith("/compare") },
  { no: "08", title: "병렬 미래", part: 2, desc: "같은 조건에서 행동만 바꿨을 때의 5분 미래를 비교합니다.", next: "09 안전 검사", match: (p) => p.endsWith("/futures") },
  { no: "09", title: "안전 검사", part: 3, desc: "모델과 분리된 코드가 AI의 선택이 회사 규칙상 허용되는지 검사합니다.", next: "10 협업·승인", match: (p) => p.endsWith("/validate") },
  { no: "10", title: "협업·승인", part: 3, desc: "권한 있는 담당자만 실행을 승인할 수 있습니다.", next: "11 실행 및 결과", match: (p) => p.startsWith("/approvals") },
  { no: "11", title: "실행 및 결과", part: 3, desc: "실행 직전에 다시 검사한 뒤 가상 환경에서만 실행하고 결과를 비교합니다.", next: "12 결정 영수증", match: (p) => p.startsWith("/executions") },
  { no: "12", title: "결정 영수증", part: 4, desc: "한 번의 결정에 대한 조건 · 후보 · 검사 · 승인 · 실행을 하나의 기록으로 봅니다.", next: "13 기록·분석", match: (p) => p.startsWith("/receipts") },
  { no: "13", title: "기록·분석", part: 4, desc: "쌓인 결정 기록에서 실패 패턴을 찾아 정책과 시스템 개선으로 연결합니다.", match: (p) => p.startsWith("/analytics") },
];

export function stepOf(pathname: string): Step | undefined {
  return STEPS.find((s) => s.match(pathname));
}

export function StageGuide({ pathname }: { pathname: string }) {
  const step = stepOf(pathname);
  if (!step) return null;
  const part = PARTS[step.part];
  const idx = STEPS.indexOf(step);
  return (
    <div className="nx-stage" style={{ ["--stage" as string]: part.color }}>
      <div className="nx-stage-top">
        <span className="nx-stage-part">
          <i />
          단계 {step.part + 1} · {part.name}
        </span>
        <span className="nx-stage-step">
          <b className="mono">{step.no}</b> / 13 · {step.title}
        </span>
        <span className="nx-stage-desc">{step.desc}</span>
        {step.next && (
          <span className="nx-stage-next">
            다음 <Icon name="arrow-right" size={14} /> <b>{step.next}</b>
          </span>
        )}
      </div>
      <div className="nx-stage-bar" aria-label={`전체 12단계 중 ${idx + 1}번째`}>
        {PARTS.map((p, pi) => {
          const steps = STEPS.filter((s) => s.part === pi);
          return (
            <div key={p.key} className={`nx-stage-seg${pi === step.part ? " on" : pi < step.part ? " done" : ""}`} style={{ ["--seg" as string]: p.color }}>
              <span className="nx-stage-seg-name">{p.name}</span>
              <span className="nx-stage-ticks">
                {steps.map((s) => (
                  <span key={s.no} className={s === step ? "cur" : STEPS.indexOf(s) < idx ? "past" : ""} title={`${s.no} ${s.title}`} />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
