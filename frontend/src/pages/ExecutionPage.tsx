import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Icon, Kpi, PageHeader, Section, StatusChip } from "@/components/common";
import { NodeBoard, StepList } from "@/components/screens/sim";
import { useRoundParam } from "@/state/run";

// SCREEN 09 · 실행 및 결과 — 승인된 계획을 실행 직전에 다시 검사한 뒤 가상 환경에서만 적용하고 전·후를 비교한다.
export default function ExecutionPage() {
  const navigate = useNavigate();
  const { round } = useParams<{ round: string }>();
  const r = useRoundParam(round);
  const plan = r.chosen;
  if (!plan || !r.executed) {
    return (
      <>
        <PageHeader crumbs={["협업·승인", "실행 및 결과"]} title="실행 및 결과" />
        <div className="nx-content">
          <Card><p className="caption">아직 실행되지 않았습니다. 필요한 역할이 모두 승인해야 실행됩니다.</p></Card>
          <div className="nx-actions"><Button arrow onClick={() => navigate(`/approvals/${r.no}`)}>협업·승인으로</Button></div>
        </div>
      </>
    );
  }
  const beforePeak = Math.max(...Object.values(r.analysis.sim.peak));
  const touched = [...new Set(plan.steps.flatMap((s) => ("job" in s ? [s.job] : [])))];
  const jobs = r.base.jobs.filter((j) => touched.includes(j.id) || r.analysis.incidents.some((x) => x.target === j.id));

  return (
    <>
      <PageHeader crumbs={["협업·승인", "실행 및 결과"]} title={`실행 및 결과 · ${r.no}회차`} right={<><StatusChip variant="executed">시뮬레이터 실행</StatusChip><StatusChip variant="sim" /></>} />
      <div className="nx-content">
        <div className="nx-exec-banner">
          <span className="nx-exec-mark"><Icon name="check" size={20} strokeWidth={3} /></span>
          <div>
            <strong>실행 성공 · 시뮬레이션</strong>
            <span>{plan.strategy} · {plan.steps.length}단계 · 승인 {plan.roles.length}개 · 실제 설비 제어 아님</span>
          </div>
        </div>

        <div className="nx-kpis nx-kpis--3">
          <Kpi label="해결된 문제" value={plan.solved.length} unit="건" sub={`남은 문제 ${plan.remaining.length}건`} icon="check" tone="dark" />
          <Kpi label="예측 최고 온도" value={plan.peak} unit="°C" sub={`조치 없음 ${beforePeak}°C`} icon="thermometer" />
          <Kpi label="냉각 에너지" value={plan.energy} unit="kWh" sub={`조치 없음 ${r.analysis.sim.energy}kWh · 30분 추정`} icon="bolt" />
        </div>

        <div className="nx-split">
          <Section title="적용한 단계" desc="실행 직전 재검사 → 단계별 적용 → 시뮬레이션 갱신" className="nx-split-main">
            <Card>
              <StepList plan={plan} />
              <table className="nx-table" style={{ marginTop: 14 }}>
                <thead><tr><th>일</th><th>실행 전 예상 완료</th><th>실행 후 예상 완료</th><th>마감</th></tr></thead>
                <tbody>
                  {jobs.map((j) => {
                    const after = plan.sim.finish[j.id] ?? r.analysis.sim.finish[j.id] ?? 0;
                    return (
                      <tr key={j.id}>
                        <td className="strong">{j.id} <span className="caption">{j.priority} · {j.gpus}장</span></td>
                        <td>{r.analysis.sim.finish[j.id] ?? "—"}분</td>
                        <td className={after > j.deadline ? "warn" : ""}>{after}분 · {plan.state.jobs.find((x) => x.id === j.id)?.node}</td>
                        <td>{j.deadline}분</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </Section>
          <Section title="실행 후 노드" desc="예측 최고 온도 포함" className="nx-split-side">
            <NodeBoard state={plan.state} sim={plan.sim} alert={plan.remaining.map((x) => x.node)} />
          </Section>
        </div>

        <div className="nx-actions">
          <Button arrow onClick={() => navigate(`/rounds/${r.no}`)}>회차 결과 보기</Button>
        </div>
      </div>
    </>
  );
}
