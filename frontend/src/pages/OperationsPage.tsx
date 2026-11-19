import { useNavigate } from "react-router-dom";
import { Button, Card, Kpi, PageHeader, Section, StatusChip } from "@/components/common";
import { IncidentList, NodeBoard, SimChart } from "@/components/screens/sim";
import { nodeViews } from "@/sim/engine";
import { useRun } from "@/state/run";

// SCREEN 02 · 운영 현황 — 설정한 상황의 노드 · 구역 · 일, 그리고 사건을 중요도 순으로 보여 준다.
export default function OperationsPage() {
  const navigate = useNavigate();
  const run = useRun();
  const r1 = run.rounds[0];
  const { base, analysis } = r1;
  const views = nodeViews(base);
  const running = views.reduce((a, v) => a + v.running.length, 0);
  const waiting = views.reduce((a, v) => a + v.waiting.length, 0);
  const hottest = [...base.nodes].sort((a, b) => b.temp - a.temp)[0];
  const alertNodes = analysis.incidents.map((x) => x.node);
  const chartNodes = [...new Set([...analysis.incidents.filter((x) => x.kind === "heat").map((x) => x.node), hottest.id])].slice(0, 4);

  return (
    <>
      <PageHeader crumbs={["운영 현황"]} title="운영 현황 · Operations" right={<><StatusChip variant="sim" /><StatusChip variant="neutral">{run.name}</StatusChip></>} />
      <div className="nx-content">
        <div className="nx-kpis nx-kpis--5">
          <Kpi label="노드" value={base.nodes.length} unit="개" sub={`냉각 구역 ${base.zones.length}개`} icon="layers" />
          <Kpi label="실행 중인 일" value={running} unit="개" sub={`대기 ${waiting}개`} icon="activity" />
          <Kpi label="최고 온도" value={hottest.temp.toFixed(1)} unit="°C" sub={hottest.id} icon="thermometer" />
          <Kpi label="사건" value={analysis.incidents.length} unit="건" sub="조치가 없을 때 기준" icon="alert" tone={analysis.incidents.length ? "dark" : "light"} />
          <Kpi label="냉각 에너지" value={analysis.sim.energy} unit="kWh" sub="30분 · 추정" icon="bolt" />
        </div>

        <Section title="조치가 필요한 사건" desc="조치 없이 두면 88°C를 넘는 노드와 마감을 놓치는 일 · 한계까지 짧을수록, 우선순위가 높을수록 위">
          <Card>
            {analysis.incidents.length ? <IncidentList items={analysis.incidents} /> : <p className="caption">조치가 필요한 사건이 없습니다.</p>}
          </Card>
        </Section>

        <div className="nx-split">
          <Section title="노드 현황" desc="GPU 합이 8장 이하면 동시에 실행, 넘는 일은 그 노드에서 대기" className="nx-split-main">
            <NodeBoard state={base} sim={analysis.sim} alert={alertNodes} />
          </Section>
          <Section title="조치가 없을 때 온도" desc="0~15분 예측 · 시뮬레이션 추정" className="nx-split-side">
            <Card>
              <SimChart sim={analysis.sim} nodes={chartNodes} />
            </Card>
          </Section>
        </div>

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate("/scenario")}>
            상황 다시 설정
          </Button>
          <Button arrow onClick={() => navigate(analysis.incidents[0] ? `/incidents/${analysis.incidents[0].id}` : "/policies")}>
            {analysis.incidents[0] ? "사건 상세 보기" : "운영 정책 보기"}
          </Button>
        </div>
      </div>
    </>
  );
}
