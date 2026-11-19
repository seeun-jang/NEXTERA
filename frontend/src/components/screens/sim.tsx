// 새 상황 모델 화면 조각 — 노드 판, 사건 목록, 계획 단계, 역할 칩, 온도 차트.
import { Link } from "react-router-dom";
import { PriorityBadge, TempChart, type ChartSeries } from "@/components/common";
import { nodeViews, STEP_NAME, stepRole, type Incident, type Plan, type SimResult, type State } from "@/sim/engine";
import { LIMIT_C, NODE_GPUS, ROLE_NAME, THROTTLE_C, type Role } from "@/sim/model";

export function RoleChips({ roles }: { roles: Role[] }) {
  if (!roles.length) return <span className="caption">승인 없음</span>;
  return (
    <span className="nx-rolechips">
      {roles.map((r) => (
        <span key={r} className={`nx-rolechip nx-rolechip--${r}`}>{ROLE_NAME[r]}</span>
      ))}
    </span>
  );
}

export function IncidentList({ items, link = true, solved = [] }: { items: Incident[]; link?: boolean; solved?: string[] }) {
  return (
    <ol className="nx-inc-list">
      {items.map((x, i) => (
        <li key={x.id} className={`nx-inc${i === 0 ? " top nx-incident" : ""}${solved.includes(x.id) ? " solved" : ""}`}>
          <span className="nx-inc-rank mono">{i + 1}</span>
          <span className={`nx-inc-kind nx-inc-kind--${x.kind}`}>{x.kind === "heat" ? "과열" : "마감"}</span>
          <div className="nx-inc-main">
            <strong>{x.title}</strong>
            <span className="caption">{x.detail}</span>
          </div>
          <PriorityBadge priority={x.priority} />
          <span className="nx-inc-t mono">{x.tLimit}분</span>
          {link && (
            <Link to={`/incidents/${x.id}`} className="nx-linkbtn">
              상세
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}

/** 노드 판: 노드마다 온도 · 팬 · GPU 사용 · 실행/대기 일 */
export function NodeBoard({ state, sim, alert = [] }: { state: State; sim?: SimResult; alert?: string[] }) {
  const views = nodeViews(state);
  return (
    <div className="nx-board">
      {state.nodes.map((n) => {
        const v = views.find((x) => x.id === n.id)!;
        const peak = sim?.peak[n.id];
        return (
          <div key={n.id} className={`nx-node${alert.includes(n.id) ? " alert" : ""}`}>
            <div className="nx-node-top">
              <span className="nx-node-id">{n.id} · {v.zone}</span>
              {n.fan && <span className="nx-fan">팬 이상</span>}
            </div>
            <div className="nx-node-temp">{n.temp.toFixed(1)}°C</div>
            {peak !== undefined && <div className="nx-node-line"><span>예측 최고</span><b className={peak >= LIMIT_C ? "over" : ""}>{peak}°C</b></div>}
            <div className="nx-node-line"><span>GPU</span><b>{v.usedGpus}/{NODE_GPUS}장</b></div>
            <span className="nx-sb-gpu" aria-hidden="true"><span style={{ width: `${(v.usedGpus / NODE_GPUS) * 100}%` }} /></span>
            <div className="nx-node-jobs">
              {v.running.map((j) => <span key={j.id} className="nx-jobchip" title={`${j.priority} · ${j.gpus}장 · 마감 ${j.deadline}분`}>{j.id}<em>{j.gpus}</em></span>)}
              {v.waiting.map((j) => <span key={j.id} className="nx-jobchip wait" title={`대기 · ${j.priority} · ${j.gpus}장`}>{j.id}<em>대기</em></span>)}
              {v.deferred.map((j) => <span key={j.id} className="nx-jobchip defer" title="연기">{j.id}<em>연기</em></span>)}
              {!v.running.length && !v.waiting.length && !v.deferred.length && <span className="caption">비어 있음</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StepList({ plan }: { plan: Plan }) {
  return (
    <ol className="nx-planlist">
      {plan.steps.map((st, i) => (
        <li key={i}>
          <span className="nx-plan-kind">{STEP_NAME[st.kind]}</span>
          <span>{plan.stepText[i]}</span>
          <span className={`nx-rolechip nx-rolechip--${stepRole(st)}`}>{ROLE_NAME[stepRole(st)]}</span>
        </li>
      ))}
    </ol>
  );
}

/** 노드별 예측 온도 차트 (0~30분) */
export function SimChart({ sim, nodes, labels, height = 220 }: { sim: SimResult; nodes: string[]; labels?: Record<string, string>; height?: number }) {
  const series: ChartSeries[] = nodes.filter((id) => (sim.series[id]?.length ?? 0) > 1).map((id, i) => ({
    id,
    label: labels?.[id] ?? id,
    style: i === 0 ? "forecast" : "compare",
    points: sim.series[id].filter((p) => p.t <= 15).map((p) => ({ x: p.t, y: p.temp })),
  }));
  if (!series.length) return <p className="caption">예측 곡선이 없습니다.</p>;
  const all = series.flatMap((s) => s.points.map((p) => p.y));
  const lo = Math.min(60, Math.floor(Math.min(...all) / 5) * 5);
  const hi = Math.max(95, Math.ceil(Math.max(...all) / 5) * 5);
  return (
    <TempChart
      series={series}
      thresholds={[{ y: LIMIT_C, label: `한계 ${LIMIT_C}°C`, kind: "limit" }, { y: THROTTLE_C, label: `스로틀 ${THROTTLE_C}°C`, kind: "throttle" }]}
      xDomain={[0, 15]}
      yDomain={[lo, hi]}
      xTicks={[0, 5, 10, 15].map((v) => ({ value: v, label: `${v}분` }))}
      yTicks={[lo, Math.round((lo + hi) / 2), hi]}
      height={height}
      ariaLabel={`예측 온도: ${nodes.join(", ")}`}
    />
  );
}
