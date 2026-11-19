import { useNavigate } from "react-router-dom";
import type { Incident, Snapshot } from "@contracts/types";
import { api } from "@/api/client";
import { Button, Card, ErrorState, Icon, Kpi, PageHeader, PageSkeleton, Section, StatusChip, TempChart } from "@/components/common";
import { NodeGrid } from "@/components/screens/NodeGrid";
import { useApi } from "@/hooks/useApi";
import { useDemo } from "@/state/DemoContext";

// SCREEN 02 · 운영 현황 — 구역: ① 클러스터 요약 ② 조치가 필요한 사건 ③ 노드 현황 · 온도 추이
// 모든 수치는 GET /api/state·/api/incidents 응답에서 계산한다(하드코딩 금지).
const SEVERITY_LABEL = { low: "낮음", medium: "보통", high: "높음" } as const;
const STATUS_LABEL = { needs_decision: "판단 필요", awaiting_approval: "승인 대기", executed: "실행됨", closed: "종료" } as const;
const THROTTLE_C = 85;
const LIMIT_C = 88;

/** "HH:MM:SS" 두 시각 사이의 분 */
function minutesBetween(a: string, b: string) {
  const m = (t: string) => t.split(":").map(Number).reduce((acc, v, i) => acc + v * [60, 1, 1 / 60][i], 0);
  return m(b) - m(a);
}

function IncidentBanner({ incident, snap, onOpen }: { incident: Incident; snap: Snapshot; onOpen: () => void }) {
  const node = snap.nodes.find((n) => n.id === incident.node_ids[0]);
  const job = snap.jobs.find((j) => j.id === incident.job_ids[0]);
  const note = snap.notes.find((n) => n.node_id === node?.id);
  const hist = snap.history.find((h) => h.node_id === node?.id)?.points ?? [];
  const rise = node && hist.length ? Math.round(node.temp_c - hist[0].temp_c) : null;

  return (
    <div className="nx-incident">
      <div className="nx-incident-mark" aria-hidden="true">
        <Icon name="alert" size={22} strokeWidth={2.4} />
      </div>
      <div className="nx-incident-main">
        <div className="nx-incident-meta">
          <StatusChip variant="ink">심각도 {SEVERITY_LABEL[incident.severity]}</StatusChip>
          <span className="mono">{incident.id}</span>
          <span className="muted">
            감지 {incident.detected_at} · {STATUS_LABEL[incident.status]}
          </span>
        </div>
        <div className="nx-incident-title">{incident.title}</div>
        <div className="nx-incident-facts">
          {node && (
            <div className="fact">
              <span className="k">현재 온도</span>
              <span className="v num">
                {node.temp_c}°C{rise !== null && <small> · 10분간 +{rise}°C</small>}
              </span>
            </div>
          )}
          {node && (
            <div className="fact">
              <span className="k">스로틀까지</span>
              <span className="v num">{Math.max(0, THROTTLE_C - node.temp_c)}°C 남음</span>
            </div>
          )}
          {job && (
            <div className="fact">
              <span className="k">
                {job.id} ({job.priority}) 마감
              </span>
              <span className="v num">
                {job.deadline_at?.slice(0, 5)} · {job.deadline_min}분 남음
              </span>
            </div>
          )}
          {note && (
            <div className="fact fact--note">
              <span className="k">
                {note.author} 메모 · {note.created_at.slice(0, 5)}
              </span>
              <span className="v">{note.text}</span>
            </div>
          )}
        </div>
      </div>
      <div className="nx-incident-cta">
        <Button arrow onClick={onOpen}>
          사건 상세 보기
        </Button>
      </div>
    </div>
  );
}

export default function OperationsPage() {
  const navigate = useNavigate();
  const { incidentId } = useDemo();
  const { data, error, loading, reload } = useApi(
    () => Promise.all([api.getState("S0"), api.getIncident(incidentId)]),
    [incidentId],
  );

  const header = (simTime?: string) => (
    <PageHeader
      crumbs={["NEXTERA", "운영 현황"]}
      title="운영 현황"
      right={
        <>
          <StatusChip variant="sim" />
          {simTime && <StatusChip variant="neutral">시뮬레이션 시각 {simTime}</StatusChip>}
        </>
      }
    />
  );

  if (loading && !data) return <>{header()}<PageSkeleton /></>;
  if (error || !data)
    return (
      <>
        {header()}
        <div className="nx-content">
          <Card>
            <ErrorState error={error} onRetry={reload} />
          </Card>
        </div>
      </>
    );

  const [snap, incident] = data;
  const avgUtil = Math.round(snap.nodes.reduce((a, n) => a + n.gpu_util_pct, 0) / snap.nodes.length);
  const hottest = snap.nodes.reduce((a, n) => (n.temp_c > a.temp_c ? n : a));
  const hist = snap.history.find((h) => h.node_id === hottest.id)?.points ?? [];
  const delta = hist.length ? Math.round(hottest.temp_c - hist[0].temp_c) : null;
  const span = hist.length ? Math.round(minutesBetween(hist[0].t, hist[hist.length - 1].t)) : null;
  const totalKw = Math.round(snap.nodes.reduce((a, n) => a + n.power_kw, 0) * 10) / 10;
  const gpusPerNode = snap.nodes[0]?.gpus_total;
  const activeIncidents = incident.status === "closed" ? 0 : 1;

  // 온도 추이: x = 마지막 점 기준 상대 분(-10 ~ 0)
  const lastT = hist.length ? hist[hist.length - 1].t : snap.sim_time;
  const points = hist.map((p) => ({ x: -minutesBetween(p.t, lastT), y: p.temp_c }));
  const yMin = hist.length ? Math.floor((Math.min(...points.map((p) => p.y)) - 2) / 5) * 5 : 70;
  const xTicks = hist.length
    ? [0, Math.floor(hist.length / 2), hist.length - 1].map((i) => ({ value: points[i].x, label: hist[i].t.slice(0, 5) }))
    : [];

  return (
    <>
      {header(snap.sim_time)}
      <div className="nx-content">
        <Section title="클러스터 요약" desc={`노드 ${snap.nodes.length}개 · 냉각 구역 ${snap.zones.length}개 · 노드당 GPU ${gpusPerNode}장`}>
          <div className="nx-kpis">
            <Kpi tone="dark" icon="layers" label="평균 GPU 사용률" value={avgUtil} unit="%" meter={avgUtil} sub={`${snap.nodes.length}개 노드 평균`} />
            <Kpi
              tone="dark"
              icon="thermometer"
              label="최고 노드 온도"
              value={hottest.temp_c}
              unit="°C"
              sub={delta !== null ? `${hottest.id} · ${span}분간 ${delta >= 0 ? "+" : ""}${delta}°C` : hottest.id}
            />
            <Kpi tone="dark" icon="bolt" label="클러스터 전력" value={totalKw.toFixed(1)} unit="kW" sub="노드 합계" />
            <Kpi tone="dark" icon="alert" label="활성 사건" value={activeIncidents} unit="건" sub={`${incident.id} · 심각도 ${SEVERITY_LABEL[incident.severity]}`} />
          </div>
        </Section>

        {activeIncidents > 0 && (
          <Section title="조치가 필요한 사건" desc="AI 판단을 부르기 전에 무엇이 문제이고 어떤 제약이 걸려 있는지 확인합니다.">
            <IncidentBanner incident={incident} snap={snap} onOpen={() => navigate(`/incidents/${incident.id}`)} />
          </Section>
        )}

        <div className="nx-split">
          <Section title="노드 현황" desc="냉각 구역별 온도와 GPU 사용률" className="nx-split-main">
            <Card>
              <NodeGrid snapshot={snap} />
            </Card>
          </Section>

          {hist.length > 0 && (
            <Section title={`${hottest.id} 온도 추이`} desc={`최근 ${span}분 · 스로틀 ${THROTTLE_C}°C / 안전 한계 ${LIMIT_C}°C`} className="nx-split-side">
              <Card className="nx-fill">
                <TempChart
                  ariaLabel={`${hottest.id} 최근 ${span}분 온도 추이`}
                  series={[{ id: hottest.id, points, style: "observed", area: true, currentLabel: `현재 ${hottest.temp_c}°C` }]}
                  thresholds={[
                    { y: THROTTLE_C, label: `스로틀 ${THROTTLE_C}°C`, kind: "throttle" },
                    { y: LIMIT_C, label: `안전 한계 ${LIMIT_C}°C`, kind: "limit" },
                  ]}
                  xDomain={[points[0].x, 0]}
                  yDomain={[yMin, 90]}
                  yTicks={Array.from({ length: (90 - yMin) / 5 + 1 }, (_, i) => yMin + i * 5)}
                  xTicks={xTicks}
                  height={290}
                />
              </Card>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
