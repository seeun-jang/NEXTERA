import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/api/client";
import { Button, Card, ErrorState, Icon, PageHeader, PageSkeleton, PolicyTag, PriorityBadge, Section, StatusChip, TempChart, type IconName } from "@/components/common";
import { useApi } from "@/hooks/useApi";

// SCREEN 03 · 사건 상세 — AI를 부르기 전에 무엇이 문제이고 어떤 제약이 걸려 있는지 사람이 먼저 이해하는 화면.
const SEVERITY_LABEL = { low: "낮음", medium: "보통", high: "높음" } as const;
const THROTTLE_C = 85;
const LIMIT_C = 88;

function toMin(t: string) {
  return t.split(":").map(Number).reduce((acc, v, i) => acc + v * [60, 1, 1 / 60][i], 0);
}

export default function IncidentPage() {
  const navigate = useNavigate();
  const { id = "INC-0412" } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi(
    () => Promise.all([api.getIncident(id), api.getState("S0"), api.getPolicies()]),
    [id],
  );

  const header = (
    <PageHeader
      crumbs={["운영 현황", "사건", id]}
      title="사건 상세 · N4 열 위험"
      right={
        <>
          <StatusChip variant="sim" />
          {data && <StatusChip variant="ink">심각도 {SEVERITY_LABEL[data[0].severity]}</StatusChip>}
        </>
      }
    />
  );
  if (loading && !data) return <>{header}<PageSkeleton /></>;
  if (error || !data)
    return (
      <>
        {header}
        <div className="nx-content">
          <Card>
            <ErrorState error={error} onRetry={reload} />
          </Card>
        </div>
      </>
    );

  const [incident, snap, pol] = data;
  const node = snap.nodes.find((n) => n.id === incident.node_ids[0])!;
  const job = snap.jobs.find((j) => j.id === incident.job_ids[0])!;
  const zone = snap.zones.find((z) => z.id === node.zone_id)!;
  const note = snap.notes.find((n) => n.node_id === node.id);
  const spare = snap.nodes.filter((n) => n.gpus_free >= job.gpus);
  const policies = incident.policy_refs.map((pid) => pol.policies.find((p) => p.id === pid)).filter(Boolean);

  // 차트: 관측(과거 10분) + 조치 없음 예측(앞으로 5분), x = 지금 기준 상대 분
  const hist = snap.history.find((h) => h.node_id === node.id)?.points ?? [];
  const now = toMin(snap.sim_time);
  const observed = hist.map((p) => ({ x: toMin(p.t) - now, y: p.temp_c }));
  const fc = incident.no_action_forecast.temp_series.find((s) => s.node_id === node.id)?.points ?? [];
  const forecast = fc.map((p) => ({ x: p.t_min, y: p.temp_c }));
  const reach = (c: number) => fc.find((p) => p.temp_c >= c)?.t_min;
  const tThrottle = reach(THROTTLE_C);
  const tLimit = reach(LIMIT_C);
  const xMin = observed[0]?.x ?? -10;
  const xMax = forecast[forecast.length - 1]?.x ?? 5;
  const clock = (offset: number) => {
    const m = now + offset;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
  };

  const reasons: { icon: IconName; title: string; body: string }[] = [
    {
      icon: "thermometer",
      title: "냉각만 올리면 효과가 제한됩니다",
      body: `${node.id} 팬 이상이 보고돼 있어 ${zone.id} 냉각을 올려도 열 제거가 덜 되고 설비 부담이 커집니다.`,
    },
    {
      icon: "clock",
      title: "옮기면 마감이 빠듯해집니다",
      body: `${job.id}는 마감 ${job.deadline_min}분의 ${job.priority} 작업이라, 옮기면 재시작에 ${job.restart_cost_min}분이 듭니다.`,
    },
    {
      icon: "users",
      title: "옮길 자리와 승인 권한도 봐야 합니다",
      body: `여유 GPU가 ${job.gpus}장 이상인 노드는 ${spare.map((n) => n.id).join(", ") || "없음"}뿐이고, ${job.priority} 작업 이동은 GPU 운영 승인이 필요합니다.`,
    },
  ];

  return (
    <>
      {header}
      <div className="nx-content">

        <div className="nx-split">
          <Section
            title={`${node.id} 온도 추이와 예측`}
            desc="실선 = 지난 10분 관측 · 점선 = 아무 조치도 하지 않았을 때 5분 예측"
            right={<StatusChip variant="estimate" />}
            className="nx-split-main"
          >
            <Card>
              <TempChart
                ariaLabel={`${node.id} 관측 온도와 조치 없음 예측`}
                series={[
                  { id: "obs", points: observed, style: "observed", area: true },
                  { id: "fc", points: forecast, style: "forecast", label: "예측" },
                ]}
                thresholds={[
                  { y: THROTTLE_C, label: `스로틀 ${THROTTLE_C}°C`, kind: "throttle" },
                  { y: LIMIT_C, label: `안전 한계 ${LIMIT_C}°C`, kind: "limit" },
                ]}
                marker={{ x: 0, label: "지금" }}
                xDomain={[xMin, xMax]}
                yDomain={[70, 95]}
                yTicks={[70, 75, 80, 85, 90, 95]}
                xTicks={[xMin, xMin / 2, 0, xMax].map((v) => ({ value: v, label: clock(v) }))}
                height={260}
              />
              <div className="nx-callout">
                <Icon name="info" size={16} />
                {tThrottle !== undefined
                  ? `조치가 없으면 약 ${tThrottle}분 뒤 스로틀 구간(${THROTTLE_C}°C)${tLimit !== undefined ? `, 약 ${tLimit}분 뒤 안전 한계(${LIMIT_C}°C)` : ""}에 도달할 것으로 추정됩니다.`
                  : "예측 구간 안에서는 스로틀 구간에 도달하지 않습니다."}
              </div>
            </Card>
          </Section>

          <Section title="관련 운영 제약" desc={`운영 정책 v${pol.version} 중 이 사건에 걸린 규칙`} className="nx-split-side">
            <Card className="nx-fill-top">
              <ul className="nx-rulelist">
                {policies.map((p) => (
                  <li key={p!.id}>
                    <PolicyTag id={p!.id} policy={p!} />
                    <span>{p!.text}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Section>
        </div>

        <Section title="왜 단순 임계값 규칙으로는 부족한가" desc={`"${THROTTLE_C}°C를 넘으면 냉각을 올린다" 규칙은 아래 세 가지를 보지 못합니다.`}>
          <div className="nx-reasons">
            {reasons.map((r) => (
              <div key={r.title} className="nx-reason">
                <span className="nx-reason-icon">
                  <Icon name={r.icon} size={20} strokeWidth={1.8} />
                </span>
                <div>
                  <strong>{r.title}</strong>
                  <p>{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="현재 상황" desc="실행 중인 작업 · 냉각 상태 · 정비 메모">
          <div className="nx-facts">
            <Card title="실행 작업" right={<PriorityBadge priority={job.priority} />}>
              <dl className="nx-kv">
                <dt>작업</dt><dd className="mono">{job.id}</dd>
                <dt>GPU</dt><dd>{job.gpus}장 ({job.node_id})</dd>
                <dt>남은 작업</dt><dd>{job.remaining_min}분</dd>
                <dt>마감까지</dt><dd><strong>{job.deadline_min}분 · {job.deadline_at?.slice(0, 5)}</strong></dd>
              </dl>
            </Card>
            <Card title="냉각 상태" right={<span className="caption">{zone.id} 구역</span>}>
              <dl className="nx-kv">
                <dt>현재 레벨</dt><dd>{zone.cooling_level} / {zone.cooling_max}</dd>
                <dt>{node.id} 팬</dt><dd><strong>{node.flags.includes("fan_issue") ? "이상 보고" : "정상"}</strong></dd>
                <dt>여유 노드</dt><dd>{spare.map((n) => `${n.id} · GPU ${n.gpus_free}`).join(", ") || "없음"}</dd>
                <dt>구역 전력</dt><dd>{zone.power_kw.toFixed(1)} kW</dd>
              </dl>
            </Card>
            <Card title="정비 메모" right={note && <span className="caption">{note.author} · {note.created_at.slice(0, 5)}</span>}>
              {note ? <div className="nx-note">{note.text}</div> : <p className="muted">메모 없음</p>}
              <p className="caption" style={{ marginTop: 10 }}>메모는 원문 그대로 AI 판단 입력에 들어갑니다. 정책을 덮어쓰지는 않습니다.</p>
            </Card>
          </div>
        </Section>

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate("/operations")}>
            운영 현황으로
          </Button>
          <Button arrow onClick={() => navigate("/policies")}>
            회사 운영 정책 확인
          </Button>
        </div>
      </div>
    </>
  );
}
