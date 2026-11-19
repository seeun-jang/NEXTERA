import type { Job, Node, Snapshot } from "@contracts/types";
import { Icon, PriorityBadge } from "@/components/common";

const THROTTLE_C = 85;

const isAlert = (n: Node) => n.flags.includes("fan_issue") || n.flags.includes("rising") || n.temp_c >= THROTTLE_C - 5;

/** 노드 카드: 노드·우선순위 / 온도 / 작업·사용률 / 상태 — 4줄만 */
function NodeCard({ node, job }: { node: Node; job?: Job }) {
  const alert = isAlert(node);
  let status: { text: string; tone: "warn" | "info" | "muted" } | null = null;
  if (alert) {
    const why = [node.flags.includes("rising") && "온도 상승", node.flags.includes("fan_issue") && "팬 이상"].filter(Boolean).join(" · ");
    status = { text: why || "온도 주의", tone: "warn" };
  } else if (node.flags.includes("protected")) status = { text: "P0 보호 작업", tone: "info" };
  else if (node.gpus_free > 0) status = { text: `여유 GPU ${node.gpus_free}장`, tone: "info" };
  else if (node.gpu_util_pct >= 95) status = { text: "여유 GPU 없음", tone: "muted" };

  return (
    <div className={`nx-node${alert ? " alert" : ""}`}>
      <div className="nx-node-top">
        <span className="nx-node-id">{node.id}</span>
        <PriorityBadge priority={job ? job.priority : "idle"} />
      </div>
      <div className="nx-node-temp num">{node.temp_c}°C</div>
      <div className="nx-node-line">
        <span className="mono">{job ? job.id : "작업 없음"}</span>
        <span className="num">GPU {node.gpu_util_pct}%</span>
      </div>
      <div className={`nx-bar${alert ? " ink" : ""}`}>
        <span style={{ width: `${node.gpu_util_pct}%` }} />
      </div>
      <div className={`nx-node-foot nx-node-foot--${status?.tone ?? "none"}`}>
        {status?.tone === "warn" && (
          <span className="nx-result nx-result--warn">
            <span className="nx-result-icon">
              <Icon name="alert" size={12} strokeWidth={3} />
            </span>
          </span>
        )}
        {status?.text ?? "정상"}
      </div>
    </div>
  );
}

/** 냉각 구역별 노드 묶음 (SCREEN 02). 구역 제목 줄에 냉각 레벨·전력·이상 보고를 한 번만 보여 준다. */
export function NodeGrid({ snapshot }: { snapshot: Snapshot }) {
  const jobOf = (n: Node) => snapshot.jobs.find((j) => n.job_ids.includes(j.id));
  return (
    <div className="nx-zones">
      {snapshot.zones.map((z) => {
        const nodes = snapshot.nodes.filter((n) => n.zone_id === z.id);
        const fan = nodes.find((n) => n.flags.includes("fan_issue"));
        return (
          <div key={z.id} className={`nx-zone${fan ? " nx-zone--warn" : ""}`}>
            <div className="nx-zone-head">
              <span className="name">{z.id} 냉각 구역</span>
              <span className="meta">
                냉각 레벨 {z.cooling_level}/{z.cooling_max}
                <i aria-hidden="true" />
                {z.power_kw.toFixed(1)} kW
                <i aria-hidden="true" />
                {fan ? <b>{fan.id} 팬 이상 보고</b> : "정상"}
              </span>
            </div>
            <div className="nx-nodes">
              {nodes.map((n) => (
                <NodeCard key={n.id} node={n} job={jobOf(n)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
