import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, PageHeader, Section, StatusChip, TempChart, type ChartSeries } from "@/components/common";
import { RoleChips } from "@/components/screens/sim";
import { LIMIT_C, THROTTLE_C } from "@/sim/model";
import { useRoundParam } from "@/state/run";

// SCREEN 06 · 대안별 결과 — 같은 상황에서 계획만 바꿨을 때의 결과를 나란히 비교한다 (최고 온도 · 에너지 · 일별 완료 · 풀리는/남는 문제).
export default function FuturesPage() {
  const navigate = useNavigate();
  const { round } = useParams<{ round: string }>();
  const r = useRoundParam(round);
  const { analysis, chosen, base } = r;
  const plans = analysis.candidates.slice(0, 4);
  const focus = analysis.incidents.find((x) => x.kind === "heat")?.node ?? chosen?.peakNode ?? base.nodes[0].id;
  // 노드별 온도 곡선이 있는 것만 그린다 (서버 후보에는 최고 온도만 오고 곡선은 없을 수 있다)
  const pts = (sr?: { t: number; temp: number }[]) => (sr ?? []).filter((p) => p.t <= 15).map((p) => ({ x: p.t, y: p.temp }));
  const series: ChartSeries[] = [
    { id: "none", label: "그대로", style: "compare" as ChartSeries["style"], points: pts(analysis.sim.series[focus]) },
    ...plans.map((p) => ({ id: p.id, label: p.id, style: (p.id === chosen?.id ? "forecast" : "compare") as ChartSeries["style"], points: pts(p.sim.series[focus]) })),
  ].filter((x) => x.points.length > 1);
  const ys = series.length ? series.flatMap((s) => s.points.map((p) => p.y)) : [60, 95];
  const lo = Math.min(60, Math.floor(Math.min(...ys) / 5) * 5);
  const hi = Math.max(95, Math.ceil(Math.max(...ys) / 5) * 5);
  const jobs = base.jobs.filter((j) => analysis.incidents.some((x) => x.target === j.id || x.node === j.node));

  return (
    <>
      <PageHeader crumbs={["의사결정", "대안별 결과"]} title="대안별 결과 · Parallel Futures" right={<><StatusChip variant="sim" /><StatusChip variant="estimate" /></>} />
      <div className="nx-content">
        <div className="nx-changed nx-changed--neutral">
          <span className="nx-changed-label">같은 조건</span>
          <strong>{r.no}회차 상황 · 같은 발열 모델 — 계획만 다르게</strong>
          <span className="caption">상황과 조건은 01 상황 설정에서 바꿉니다</span>
        </div>

        <div className="nx-futures">
          <Section title={`${focus} 예측 온도`} desc="0~15분 · 굵은 선 = AI 선택" className="nx-futures-chart">
            <Card>
              {series.length === 0 ? <p className="caption">계획별 온도 곡선이 없습니다. 아래 표의 최고 온도를 참고하세요.</p> : <TempChart
                series={series}
                thresholds={[{ y: LIMIT_C, label: `한계 ${LIMIT_C}°C`, kind: "limit" }, { y: THROTTLE_C, label: `스로틀 ${THROTTLE_C}°C`, kind: "throttle" }]}
                xDomain={[0, 15]} yDomain={[lo, hi]}
                xTicks={[0, 5, 10, 15].map((v) => ({ value: v, label: `${v}분` }))}
                yTicks={[lo, Math.round((lo + hi) / 2), hi]}
                height={240}
                ariaLabel="계획별 예측 온도"
              />}
            </Card>
          </Section>
        </div>

        <Section title="계획별 예상 결과" desc="시뮬레이션 추정 · 같은 기준으로 계산">
          <Card>
            <table className="nx-table nx-ftable">
              <thead>
                <tr>
                  <th>후보</th>
                  <th>최고 온도</th>
                  <th>냉각 에너지</th>
                  {jobs.map((j) => <th key={j.id}>{j.id} 완료 / 마감</th>)}
                  <th>풀리는 문제</th>
                  <th>남는 문제</th>
                  <th>승인</th>
                </tr>
              </thead>
              <tbody>
                <tr className="muted">
                  <td>조치 없음</td>
                  <td>{Object.values(analysis.sim.peak).length ? `${Math.max(...Object.values(analysis.sim.peak))}°C` : "—"}</td>
                  <td>{analysis.sim.energy}kWh</td>
                  {jobs.map((j) => <td key={j.id}>{analysis.sim.finish[j.id] ?? "—"}분 / {j.deadline}분</td>)}
                  <td>—</td>
                  <td>{analysis.incidents.length}</td>
                  <td>—</td>
                </tr>
                {plans.map((p) => (
                  <tr key={p.id} className={p.id === chosen?.id ? "chosen" : ""}>
                    <td><strong>{p.id}</strong> <span className="caption">{p.strategy}</span></td>
                    <td className={p.peak >= LIMIT_C ? "warn" : ""}>{p.peak}°C</td>
                    <td>{p.energy}kWh</td>
                    {jobs.map((j) => {
                      const f = p.sim.finish[j.id];
                      const dl = p.state.jobs.find((x) => x.id === j.id)?.deadline ?? j.deadline;
                      return <td key={j.id} className={f !== undefined && f > dl ? "warn" : ""}>{f ?? "—"}분 / {dl}분</td>;
                    })}
                    <td>{p.solved.length}</td>
                    <td className={p.remaining.length ? "warn" : ""}>{p.remaining.length}</td>
                    <td><RoleChips roles={p.roles} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="caption" style={{ marginTop: 10 }}>연기는 일을 미래로 넘긴 것이라 절감으로 보지 않습니다. 옮기거나 멈춘 일은 재시작 지연만큼 늦게 끝납니다.</p>
          </Card>
        </Section>

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate(`/decision/${r.no}`)}>의사결정 센터</Button>
          <Button arrow onClick={() => navigate(`/decision/${r.no}/validate`)} disabled={!chosen}>실행 전 안전 검사</Button>
        </div>
      </div>
    </>
  );
}
