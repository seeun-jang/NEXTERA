import type { Candidate, Decision } from "@contracts/types";
import { Icon, StatusChip } from "@/components/common";
import { approvalLabel } from "./labels";

/** 정책을 통과한 후보 목록. 선택된 후보는 검정 테두리, 확률은 provider=zoro1일 때만 막대로 보여 준다. */
export function CandidateList({ candidates, decision }: { candidates: Candidate[]; decision: Decision }) {
  const passed = candidates.filter((c) => !c.filtered_out);
  const showProbs = decision.provider === "zoro1" && decision.probs !== null;
  return (
    <ul className="nx-cands">
      {passed.map((c) => {
        const selected = c.id === decision.selected_id;
        const p = showProbs ? decision.probs?.[c.id] ?? 0 : null;
        return (
          <li key={c.id} className={`nx-cand${selected ? " selected" : ""}`}>
            <span className="nx-cand-radio" aria-hidden="true">
              {selected && <Icon name="check" size={12} strokeWidth={3} />}
            </span>
            <div className="nx-cand-main">
              <div className="nx-cand-label">{c.label}</div>
              <div className="nx-cand-meta">
                <span className={c.requires_approval_role ? "need" : "free"}>{approvalLabel(c)}</span>
                <span className="mono caption">{c.id}</span>
              </div>
            </div>
            {p !== null ? (
              <div className="nx-cand-prob">
                <span className="num">{Math.round(p * 100)}%</span>
                <span className="nx-bar">
                  <span style={{ width: `${p * 100}%` }} />
                </span>
              </div>
            ) : (
              selected && <StatusChip variant={decision.provider === "zoro1" ? "zoro1" : "mock"}>{decision.provider === "zoro1" ? "Zoro-1 선택" : "모의 선택"}</StatusChip>
            )}
          </li>
        );
      })}
    </ul>
  );
}
