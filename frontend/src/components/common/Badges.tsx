import type { Check, Policy, Priority } from "@contracts/types";
import { Icon } from "./Icon";

export function PriorityBadge({ priority }: { priority: Priority | "idle" }) {
  return <span className={`nx-badge nx-badge--${priority}`}>{priority === "idle" ? "대기" : priority}</span>;
}

/** 정책 ID 칩. policy를 넘기면 마우스를 올렸을 때 정책 문구가 보인다. */
export function PolicyTag({ id, policy }: { id: string; policy?: Policy }) {
  return (
    <span className="nx-policy" title={policy ? `${policy.text} · v${policy.version}` : undefined}>
      {id}
    </span>
  );
}

const RESULT_LABEL: Record<Check["result"], string> = {
  pass: "통과",
  needs_approval: "승인 필요",
  warn: "주의",
  fail: "차단",
};

/** 통과·승인 필요·주의·차단 표시. 색만이 아니라 아이콘 모양 + 글자로 구분한다. */
export function ResultMark({ result, label }: { result: Check["result"]; label?: string }) {
  const icon = result === "pass" ? "check" : result === "fail" ? "x" : "alert";
  return (
    <span className={`nx-result nx-result--${result}`}>
      <span className="nx-result-icon">
        <Icon name={icon} size={12} strokeWidth={3} />
      </span>
      {label ?? RESULT_LABEL[result]}
    </span>
  );
}

/** 안전 검사 표의 한 행. <table className="nx-table"> 안에서 쓴다. */
export function CheckRow({ check, policy }: { check: Check; policy?: Policy }) {
  return (
    <tr>
      <td className="strong">{check.name}</td>
      <td>
        <PolicyTag id={check.policy_id} policy={policy} />
      </td>
      <td>{check.criterion}</td>
      <td className="mono">{check.observed}</td>
      <td>
        <ResultMark result={check.result} />
      </td>
    </tr>
  );
}
