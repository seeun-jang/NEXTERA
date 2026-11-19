import { Icon } from "./Icon";

// 단계 안내 띠 — 모든 앱 화면 위에 "지금 어느 단계 · 이 화면에서 하는 일 · 다음 화면"을 보여 준다.
// 단계 색은 식별용(상태 의미 없음). 색만으로 구분하지 않도록 단계 이름·번호를 항상 글자로 함께 쓴다.

export const PARTS = [
  { key: "setup", name: "상황 설정", color: "var(--st-1)" },
  { key: "observe", name: "상황 파악", color: "var(--st-2)" },
  { key: "decide", name: "판단", color: "var(--st-3)" },
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
  /** 본 흐름의 갈림길 화면이면, 진행 막대에서 대신 표시할 단계 번호 */
  alt?: string;
}

// 흐름: 처음에 상황과 조건을 정하고(01), 뒤로 갈수록 그 설정이 만든 결과를 본다(02~11).
export const STEPS: Step[] = [
  { no: "01", title: "상황 설정", part: 0, desc: "노드 · 냉각 구역 · 일을 정합니다. 이후 화면은 모두 이 설정이 만든 결과입니다.", next: "02 운영 현황", match: (p) => p.startsWith("/scenario") },
  { no: "02", title: "운영 현황", part: 1, desc: "설정한 상황의 노드와 일, 그리고 사건을 중요도 순으로 봅니다.", next: "03 사건 상세", match: (p) => p.startsWith("/operations") },
  { no: "03", title: "사건 상세", part: 1, desc: "AI를 부르기 전에 무엇이 문제이고 어떤 제약이 걸렸는지 확인합니다.", next: "04 운영 정책", match: (p) => p.startsWith("/incidents/") },
  { no: "04", title: "운영 정책", part: 2, desc: "회사 규칙과 멈추기 규칙이 AI가 고를 수 있는 계획의 범위를 정합니다.", next: "05 의사결정 센터", match: (p) => p.startsWith("/policies") },
  { no: "05", title: "의사결정 센터", part: 2, desc: "검증된 계획(후보) 중 AI가 무엇을 골랐는지 확인합니다.", next: "06 대안별 결과", match: (p) => /^\/decision\/[^/]+$/.test(p) },
  { no: "06", title: "대안별 결과", part: 2, desc: "같은 상황에서 계획만 바꿨을 때의 결과를 나란히 비교합니다.", next: "07 안전 검사", match: (p) => p.endsWith("/futures") },
  { no: "07", title: "안전 검사", part: 3, desc: "모델과 분리된 코드가 고른 계획을 단계마다 다시 검사합니다.", next: "08 협업·승인", match: (p) => p.endsWith("/validate") },
  { no: "08", title: "협업·승인", part: 3, desc: "계획에 필요한 역할이 각각 승인해야 실행됩니다.", next: "09 실행 및 결과", match: (p) => p.startsWith("/approvals") },
  { no: "08", alt: "08", title: "사람에게 넘김", part: 3, desc: "안전한 계획이 없어 AI가 사람에게 판단을 넘긴 경우입니다. 설비는 건드리지 않고 요청이 기록됩니다.", next: "11 결정 영수증", match: (p) => p.endsWith("/handoff") },
  { no: "09", title: "실행 및 결과", part: 3, desc: "실행 직전에 다시 검사한 뒤 가상 환경에서만 실행하고 결과를 비교합니다.", next: "10 회차 요약", match: (p) => p.startsWith("/executions") },
  { no: "10", title: "회차 요약", part: 3, desc: "실행 뒤 상태로 남은 문제를 다시 계산해, 다음 회차로 갈지 멈출지 정합니다.", next: "05 다음 회차 또는 11 결정 영수증", match: (p) => p.startsWith("/rounds") },
  { no: "11", title: "결정 영수증", part: 4, desc: "상황 설정부터 회차별 결정 · 승인 · 실행까지 하나의 기록으로 봅니다.", next: "12 기록·분석", match: (p) => p.startsWith("/receipts") },
  { no: "12", title: "기록·분석", part: 4, desc: "쌓인 결정 기록에서 실패 패턴을 찾아 정책과 시스템 개선으로 연결합니다.", match: (p) => p.startsWith("/analytics") },
];
const TOTAL = STEPS.filter((s) => !s.alt).length;

export function stepOf(pathname: string): Step | undefined {
  return STEPS.find((s) => s.match(pathname));
}

export function StageGuide({ pathname }: { pathname: string }) {
  const step = stepOf(pathname);
  if (!step) return null;
  const part = PARTS[step.part];
  const ref = step.alt ? STEPS.find((s) => s.no === step.alt && !s.alt) ?? step : step;
  const idx = STEPS.indexOf(ref);
  const main = STEPS.filter((s) => !s.alt);
  return (
    <div className="nx-stage" style={{ ["--stage" as string]: part.color }}>
      <div className="nx-stage-top">
        <span className="nx-stage-part">
          <i />
          단계 {step.part + 1} · {part.name}
        </span>
        <span className="nx-stage-step">
          <b className="mono">{step.no}</b> / {TOTAL} · {step.title}
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
          const steps = main.filter((s) => s.part === pi);
          return (
            <div key={p.key} className={`nx-stage-seg${pi === step.part ? " on" : pi < step.part ? " done" : ""}`} style={{ ["--seg" as string]: p.color }}>
              <span className="nx-stage-seg-name">{p.name}</span>
              <span className="nx-stage-ticks">
                {steps.map((s) => (
                  <span key={s.no} className={s === ref ? "cur" : STEPS.indexOf(s) < idx ? "past" : ""} title={`${s.no} ${s.title}`} />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
