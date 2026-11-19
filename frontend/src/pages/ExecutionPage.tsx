import { useNavigate } from "react-router-dom";
import type { Execution, Snapshot } from "@contracts/types";
import { api } from "@/api/client";
import { Button, Card, CheckRow, EmptyState, ErrorState, Icon, Kpi, PageHeader, PageSkeleton, Section, StatusChip } from "@/components/common";
import { useApi } from "@/hooks/useApi";
import { useDemo } from "@/state/DemoContext";

// SCREEN 11 · 실행 및 결과 — 승인된 행동을 시뮬레이터에서 실행하고 전·후를 비교한다. 실제 설비를 제어하지 않는다.
// 계약에 실행 조회 GET이 없어 결정 영수증(GET /api/receipts/:id)의 execution을 읽는다.

interface Row {
  k: string;
  before: string;
  after: string;
}

/** 실행 전·후 스냅샷에서 달라진 값만 행으로 만든다 */
function diffRows(b: Snapshot, a: Snapshot): Row[] {
  const rows: Row[] = [];
  for (const nb of b.nodes) {
    const na = a.nodes.find((n) => n.id === nb.id);
    if (!na) continue;
    if (nb.temp_c !== na.temp_c) rows.push({ k: `${nb.id} 온도`, before: `${nb.temp_c}°C`, after: `${na.temp_c}°C` });
    if (nb.gpu_util_pct !== na.gpu_util_pct) rows.push({ k: `${nb.id} GPU 사용률`, before: `${nb.gpu_util_pct}%`, after: `${na.gpu_util_pct}%` });
  }
  for (const jb of b.jobs) {
    const ja = a.jobs.find((j) => j.id === jb.id);
    if (!ja) continue;
    if (jb.node_id !== ja.node_id) rows.push({ k: `${jb.id} 위치`, before: jb.node_id ?? "—", after: ja.node_id ?? (ja.status === "deferred" ? "연기됨" : "—") });
  }
  const zonesChanged = b.zones.filter((zb) => a.zones.find((z) => z.id === zb.id)?.cooling_level !== zb.cooling_level);
  for (const zb of zonesChanged) {
    const za = a.zones.find((z) => z.id === zb.id)!;
    rows.push({ k: `${zb.id} 냉각 레벨`, before: `${zb.cooling_level} / ${zb.cooling_max}`, after: `${za.cooling_level} / ${za.cooling_max}` });
  }
  if (!zonesChanged.length) rows.push({ k: "냉각 설정", before: "—", after: "변경 없음" });
  const kw = (s: Snapshot) => Math.round(s.nodes.reduce((x, n) => x + n.power_kw, 0) * 10) / 10;
  rows.push({ k: "클러스터 전력", before: `${kw(b).toFixed(1)} kW`, after: `${kw(a).toFixed(1)} kW` });
  return rows;
}

function hottestDrop(e: Execution) {
  const id = e.before.nodes.reduce((x, n) => (n.temp_c > x.temp_c ? n : x)).id;
  return { id, before: e.before.nodes.find((n) => n.id === id)!.temp_c, after: e.after.nodes.find((n) => n.id === id)!.temp_c };
}

export default function ExecutionPage() {
  const navigate = useNavigate();
  const { decisionId } = useDemo();
  const did = decisionId ?? "DR-0412-01";
  const { data, error, loading, reload } = useApi(() => api.getReceipt(did), [did]);

  const header = (
    <PageHeader
      crumbs={["협업·승인", "실행"]}
      title="실행 및 결과"
      right={
        <>
          <StatusChip variant="sim" />
          <StatusChip variant="executed" />
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

  const e = data.execution;
  if (!e)
    return (
      <>
        {header}
        <div className="nx-content">
          <Card>
            <EmptyState
              title="아직 실행된 행동이 없습니다"
              description="권한자가 승인하면 실행 직전 재검사를 거쳐 여기서 결과를 볼 수 있습니다."
              action={<Button variant="secondary" onClick={() => navigate("/approvals")}>협업·승인으로</Button>}
            />
          </Card>
        </div>
      </>
    );

  const cand = data.candidates.find((c) => c.id === e.action_id);
  const drop = hottestDrop(e);
  const rows = diffRows(e.before, e.after);
  const ok = e.status === "succeeded";

  return (
    <>
      {header}
      <div className="nx-content">
        <div className={`nx-exec-banner${ok ? "" : " bad"}`}>
          <span className="nx-exec-mark">
            <Icon name={ok ? "check" : "x"} size={22} strokeWidth={3} />
          </span>
          <div>
            <strong>{ok ? "실행 성공 · 시뮬레이션" : e.status === "held" ? "실행 보류 · 재검사 실패" : "실행 실패"}</strong>
            <span>
              승인된 행동: {cand?.label ?? e.action_id}
              {e.approval_id ? ` · ${e.approval_id}` : ""} · 실제 설비 제어 아님
            </span>
          </div>
        </div>

        <div className="nx-kpis nx-kpis--3">
          <Kpi tone="dark" icon="thermometer" label={`${drop.id} 온도`} value={`${drop.before} → ${drop.after}`} unit="°C" sub="실행 전 → 실행 후" />
          <Kpi tone="dark" icon="clock" label={`${e.sla.job_id} 완료 (예상)`} value={e.sla.finish_at.slice(0, 5)} sub={`마감 ${e.sla.deadline_at.slice(0, 5)}`} />
          <Kpi tone="dark" icon="shield" label="SLA 결과" value={e.sla.met ? "준수" : "미준수"} sub={`마감 여유 ${e.sla.slack_min}분 (예상)`} />
        </div>

        <div className="nx-split">
          <Section title="실행 전 · 후" desc={`전 = ${e.before.sim_time} · 후 = ${e.after.sim_time} 스냅샷 · 달라진 값만`} className="nx-split-main">
            <Card>
              <table className="nx-table">
                <thead>
                  <tr>
                    <th>항목</th>
                    <th>실행 전</th>
                    <th style={{ width: 40 }} />
                    <th>실행 후</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.k}>
                      <td className="strong">{r.k}</td>
                      <td className="muted">{r.before}</td>
                      <td className="caption">→</td>
                      <td className={r.after !== r.before && r.after !== "변경 없음" ? "nx-after" : "muted"}>{r.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>

          <Section title="실행 단계" desc="틱마다 상태를 기록합니다" className="nx-split-side">
            <Card className="nx-fill-top">
              <ol className="nx-steps-v">
                {e.steps.map((s, i) => (
                  <li key={i} className={s.ok ? "ok" : "bad"}>
                    <span className="dot">
                      <Icon name={s.ok ? "check" : "x"} size={11} strokeWidth={3} />
                    </span>
                    <span className="lbl">{s.label}</span>
                    <span className="mono caption">{s.at}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </Section>
        </div>

        <div className="nx-split">
          <Section title="실행 직전 재검사" desc="승인 시점의 최신 상태·정책 버전·권한으로 다시 확인한 결과" className="nx-split-main">
            <Card>
              <table className="nx-table">
                <thead>
                  <tr>
                    <th>검사</th>
                    <th style={{ width: 90 }}>정책</th>
                    <th>기준</th>
                    <th>현재 값</th>
                    <th style={{ width: 110 }}>결과</th>
                  </tr>
                </thead>
                <tbody>
                  {e.recheck.map((c, i) => (
                    <CheckRow key={i} check={c} />
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>
          <Section title="오류 처리" desc="실패해도 멈추지 않습니다" className="nx-split-side">
            <Card className="nx-fill-top">
              <dl className="nx-kv nx-kv--wide">
                <dt>재시작 실패</dt><dd>체크포인트에서 복구하고 운영자를 호출합니다.</dd>
                <dt>재검사 실패</dt><dd>실행을 보류하고 의사결정 센터로 되돌립니다.</dd>
                <dt>시뮬레이터 응답 없음</dt><dd>1회 재시도 후 "실행 실패"로 기록합니다.</dd>
              </dl>
            </Card>
          </Section>
        </div>

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate("/operations")}>운영 현황으로</Button>
          <Button arrow onClick={() => navigate(`/receipts/${did}`)}>결정 영수증 확인</Button>
        </div>
      </div>
    </>
  );
}
