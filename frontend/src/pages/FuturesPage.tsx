import { useNavigate, useParams } from "react-router-dom";
import type { Candidate, Estimate } from "@contracts/types";
import { api } from "@/api/client";
import { Button, Card, ErrorState, Icon, PageHeader, PageSkeleton, ProviderChip, Section, StatusChip, TempChart } from "@/components/common";
import { approvalLabel } from "@/components/screens/labels";
import { useApi } from "@/hooks/useApi";
import { futuresOnce } from "@/state/decisionCache";

// SCREEN 08 · 병렬 미래 (Parallel Futures) — 같은 스냅샷 · 같은 마감 · 같은 시드에서 행동만 바꿔 5분 미래를 비교한다.
// 조건을 바꾸는 06·07과 다른 축이다. 모든 수치는 시뮬레이터 추정.
const RISK = { low: "낮음", medium: "보통", high: "높음" } as const;
const LETTER = ["A", "B", "C"];

function FutureCard({ letter, cand, est, selected, provider }: { letter: string; cand: Candidate; est: Estimate; selected: boolean; provider: "zoro1" | "mock" | "rule" }) {
  const n4 = est.temp_series.find((s) => s.node_id === "N4")?.points ?? [];
  const n2 = est.temp_series.find((s) => s.node_id === "N2")?.points ?? [];
  const finish = est.job_finish_min.J07;
  const slack = est.deadline_slack_min.J07;
  const violations = est.violations.filter((v) => v !== "DEADLINE_MISS");
  const maxX = n4[n4.length - 1]?.t_min ?? 5;
  const extra = Object.entries(est.job_finish_min).filter(([j]) => j !== "J07");
  const rows: { k: string; v: string; strong?: boolean }[] = [
    { k: "N4 최고 온도", v: `${est.peak_temp_c.N4}°C${est.throttle_min > 0 ? ` · 스로틀 약 ${est.throttle_min}분` : ""}`, strong: true },
    { k: "냉각 에너지 (Z2)", v: est.cooling_kwh_delta_pct === 0 ? "변화 없음" : `${est.cooling_kwh_delta_pct > 0 ? "+" : ""}${est.cooling_kwh_delta_pct}%` },
    { k: "J07 완료", v: `${finish}분 · 마감 ${slack >= 0 ? `여유 ${slack}분` : `${-slack}분 초과`}` },
    ...extra.map(([j, m]) => ({ k: `${j} 완료`, v: `${m}분 (지연)` })),
    { k: "운영 위험", v: `${RISK[est.risk]} · ${est.risk_note}` },
    { k: "제약 위반", v: violations.length ? violations.join(", ") : "없음" },
    { k: "완료 / 잔여 작업량", v: `${est.completed_work} / ${est.remaining_work} GPU·분` },
  ];
  return (
    <div className={`nx-future${selected ? " selected" : ""}`}>
      <div className="nx-future-head">
        <span className="nx-abtag">{letter}</span>
        <div>
          <strong>{cand.label}</strong>
          <span className="caption">{approvalLabel(cand)}</span>
        </div>
        {selected && (
          <span className="nx-future-pick">
            <ProviderChip provider={provider} />
          </span>
        )}
      </div>
      <TempChart
        ariaLabel={`${cand.label} 실행 시 N4 온도 예측`}
        series={[
          { id: "n4", points: n4.map((p) => ({ x: p.t_min, y: p.temp_c })), style: "forecast", label: "N4" },
          ...(n2.length ? [{ id: "n2", points: n2.map((p) => ({ x: p.t_min, y: p.temp_c })), style: "compare" as const, label: "N2" }] : []),
        ]}
        thresholds={[
          { y: 88, label: "한계 88°C", kind: "limit" },
          { y: 85, label: "스로틀 85°C", kind: "throttle" },
        ]}
        xDomain={[0, maxX]}
        yDomain={[60, 92]}
        yTicks={[60, 70, 80, 90]}
        xTicks={[0, maxX / 2, maxX].map((v) => ({ value: v, label: `${v}분` }))}
        height={170}
      />
      <dl className="nx-abrows">
        {rows.map((r) => (
          <div key={r.k}>
            <dt>{r.k}</dt>
            <dd>{r.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function FuturesPage() {
  const navigate = useNavigate();
  const { id = "DR-0412-01" } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi(async () => {
    const rc = await api.getReceipt(id);
    const s0 = rc.branches.find((b) => b.branch_id === "S0");
    // 실행 가능한 행동(승인 대상 3개)만 비교 — 추가 정보 요청·이관은 상태를 바꾸지 않는다
    const actions = rc.candidates.filter((c) => !c.filtered_out && c.requires_approval_role);
    const estimates = await futuresOnce(`${id}@${s0?.selected_id}@${rc.events[0]?.at}`, () =>
      api.futures({ decision_id: id, snapshot_id: "S0", action_ids: actions.map((a) => a.id), horizon_ticks: 10 }).then((r) => r.estimates),
    );
    return { rc, actions, estimates, selected: s0?.selected_id };
  }, [id]);

  const header = (
    <PageHeader
      crumbs={["의사결정", "병렬 미래"]}
      title="병렬 미래 · Parallel Futures"
      right={
        <>
          <StatusChip variant="sim" />
          <StatusChip variant="estimate" />
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

  const { rc, actions, estimates, selected } = data;
  if (!actions.length)
    return (
      <>
        {header}
        <div className="nx-content">
          <Card>
            <ErrorState error={new Error("아직 AI 판단이 없습니다. 의사결정 센터에서 판단을 먼저 실행하세요.")} onRetry={() => navigate(`/decision/${id}`)} />
          </Card>
        </div>
      </>
    );

  return (
    <>
      {header}
      <div className="nx-content">
        <div className="nx-changed nx-changed--neutral">
          <span className="nx-changed-label">같은 조건</span>
          <strong>시나리오 S0 · 마감 5분 · 같은 난수 시드 — 행동만 다르게</strong>
          <span className="caption">조건을 바꾸는 실험은 06 조건 실험 · 07 A/B 비교에서 합니다</span>
        </div>

        <Section title={`행동 ${actions.length}개의 5분 미래`} desc="온도 · 냉각 에너지 · 마감 · 위험 · 제약 위반을 같은 기준으로 계산">
          <div className="nx-futures">
            {actions.map((a, i) => {
              const est = estimates.find((e) => e.action_id === a.id);
              return est ? <FutureCard key={a.id} letter={LETTER[i] ?? String(i + 1)} cand={a} est={est} selected={a.id === selected} provider={rc.provider} /> : null;
            })}
          </div>
        </Section>

        <div className="nx-callout">
          <Icon name="info" size={16} />
          모든 수치는 시뮬레이터 추정입니다. 0분 = {"14:00:00"}, 승인 지연 0.5분 가정. 작업 연기는 일을 미래로 넘긴 것이라 절감으로 오해하지 않도록 완료·잔여 작업량을 함께 봅니다.
        </div>

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate("/lab/S0")}>
            조건 실험으로
          </Button>
          <Button arrow onClick={() => navigate(`/decision/${id}/validate`)}>
            실행 전 안전 검사
          </Button>
        </div>
      </div>
    </>
  );
}
