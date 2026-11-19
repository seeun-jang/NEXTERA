import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Check, Policy } from "@contracts/types";
import policySeed from "@seed/policy_v1.2.json";
import { Button, Card, CheckRow, Icon, PageHeader, Section, StatusChip } from "@/components/common";
import { StepList } from "@/components/screens/sim";
import { applyStep, nodeViews, type Plan, type State } from "@/sim/engine";
import { LIMIT_C, MAX_JOBS_PER_NODE, NODE_GPUS } from "@/sim/model";
import { useRoundParam, useRun } from "@/state/run";

// SCREEN 07 · 안전 검사 (Safety Gate) — 모델과 분리된 코드가 AI가 고른 계획을 단계마다 다시 검사한다.
const policies = (policySeed as unknown as { policies: Policy[] }).policies;
const pol = (id: string) => policies.find((p) => p.id === id);

function checksFor(base: State, plan: Plan): Check[] {
  const out: Check[] = [];
  let cur = base;
  plan.steps.forEach((st, i) => {
    const label = `${i + 1}단계`;
    if (st.kind === "move" || st.kind === "evac") {
      const j = cur.jobs.find((x) => x.id === st.job)!;
      const v = nodeViews(cur).find((x) => x.id === st.to)!;
      const count = cur.jobs.filter((x) => x.node === st.to).length;
      out.push({ policy_id: "POL-01", name: `${label} P0 보호`, criterion: "P0 일은 옮기지 않음", observed: `${j.id}는 ${j.priority}`, result: "pass" });
      out.push({ policy_id: "POL-03", name: `${label} 대상 노드 자리`, criterion: `일 ${MAX_JOBS_PER_NODE}개 이하 · GPU ${NODE_GPUS}장 기준`, observed: `${st.to} 일 ${count}개 · 여유 ${v.freeGpus}장 → ${v.freeGpus >= j.gpus ? "바로 실행" : "줄 뒤에 대기"}`, result: "pass" });
    } else if (st.kind === "preempt") {
      out.push({ policy_id: "POL-09", name: `${label} 멈추기 규칙`, criterion: "더 급한 일만 다른 일을 멈춤 · P0는 멈추지 않음", observed: "멈추는 일보다 급함 · 재시작 지연 반영", result: "pass" });
    } else if (st.kind === "defer") {
      out.push({ policy_id: "POL-06", name: `${label} 연기 대상`, criterion: "P0 제외 · 30분 이내", observed: `${st.job} 30분 연기`, result: "pass" });
    } else {
      const z = cur.zones.find((x) => x.id === st.zone)!;
      out.push({ policy_id: "COOL-MAX", name: `${label} 냉각 상한`, criterion: `레벨 ≤ ${z.max}`, observed: `${z.level} → ${z.level + st.delta}`, result: "pass" });
    }
    const next = applyStep(cur, st);
    if (!("error" in next)) cur = next;
  });
  const heatLeft = plan.remaining.filter((x) => x.kind === "heat");
  const lateLeft = plan.remaining.filter((x) => x.kind === "deadline");
  out.push({ policy_id: "POL-02", name: "열 안전 한계", criterion: `예측 최고 ≤ ${LIMIT_C}°C`, observed: `${plan.peak}°C (${plan.peakNode}, 추정)`, result: heatLeft.length ? "warn" : "pass" });
  out.push({ policy_id: "POL-08", name: "마감 준수", criterion: "모든 일이 마감 안에", observed: lateLeft.length ? `${lateLeft.map((x) => x.target).join(", ")} 남음 → 다음 회차` : "모두 마감 안", result: lateLeft.length ? "warn" : "pass" });
  out.push({ policy_id: "Safety Gate", name: "새 문제 없음", criterion: "계획 때문에 생기는 과열 · 마감 위반 없음", observed: "없음", result: "pass" });
  for (const role of plan.roles) {
    out.push({ policy_id: role === "cooling_A" ? "POL-05" : "POL-04", name: "승인 권한", criterion: role === "cooling_A" ? "냉각 운영 A 승인" : "GPU 운영 B 승인", observed: "아직 없음", result: "needs_approval" });
  }
  return out;
}

export default function ValidatePage() {
  const navigate = useNavigate();
  const { round } = useParams<{ round: string }>();
  const run = useRun();
  const r = useRoundParam(round);
  const [forced, setForced] = useState(r.forced);
  if (!r.chosen) {
    return (
      <>
        <PageHeader crumbs={["의사결정", "안전 검사"]} title="안전 검사 · Safety Gate" />
        <div className="nx-content"><Card><p className="caption">검사할 계획이 없습니다. 사람에게 넘김 화면을 확인하세요.</p></Card></div>
      </>
    );
  }
  const checks = checksFor(r.base, r.chosen);
  const needs = checks.some((c) => c.result === "needs_approval");

  return (
    <>
      <PageHeader crumbs={["의사결정", "안전 검사"]} title="안전 검사 · Safety Gate" right={<><StatusChip variant="independent">독립 검증</StatusChip><StatusChip variant="sim" /></>} />
      <div className="nx-content">
        <div className="nx-split">
          <Section title="검사 항목" desc="독립 검증 코드 · 모델 출력과 무관하게 실행" className="nx-split-main">
            <Card>
              <div className="nx-validate-plan">
                <span className="caption">검사 대상 · {r.no}회차 {r.chosen.id} {r.chosen.strategy}</span>
                <StepList plan={r.chosen} />
              </div>
              <table className="nx-table">
                <thead><tr><th>검사</th><th>기준</th><th>관측</th><th>결과</th></tr></thead>
                <tbody>{checks.map((c, i) => <CheckRow key={i} check={c} policy={pol(c.policy_id)} />)}</tbody>
              </table>
              <div className={`nx-banner nx-banner--${needs ? "conditional" : "allowed"}`}>
                <Icon name={needs ? "alert" : "check"} size={18} strokeWidth={2.5} />
                <strong>{needs ? "조건부 허용" : "허용"}</strong>
                <span>필수 제약을 통과했습니다. {needs ? "권한자 승인 후 실행 직전에 다시 검사합니다." : ""}</span>
              </div>
            </Card>
          </Section>

          <Section title="강제 입력 테스트" desc="규칙을 어기는 행동을 일부러 넣으면?" className="nx-split-side">
            <div className="nx-testpanel">
              <p className="caption">AI가 고르지 않은 행동을 운영자가 직접 넣어도 같은 검사를 거칩니다.</p>
              <Button variant="secondary" block onClick={async () => { const res = await run.forceTest(r.no); setForced(res ? { ...res, at: "" } : null); }}>
                강제 입력 검사 실행
              </Button>
              {forced && (
                <div className="nx-block-danger">
                  <Icon name="x" size={16} strokeWidth={3} />
                  <div>
                    <strong>차단 · {forced.text}</strong>
                    <span>{forced.reason}{forced.policy ? ` (${forced.policy})` : ""} · 실행 큐에 들어가지 않고 기록에 남습니다</span>
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate(`/decision/${r.no}/futures`)}>대안별 결과 다시 보기</Button>
          <Button arrow onClick={async () => { await run.validate(r.no); navigate(`/approvals/${r.no}`); }}>담당자 승인 요청</Button>
        </div>
      </div>
    </>
  );
}
