// shared/contracts/types.ts — CONTRACT_VERSION 1.0.0
// 소유: 대환. 변경은 공통 프롬프트 §10 계약 변경 절차를 따른다.
// JSON 필드는 snake_case. 시각은 시뮬레이션 시각 "HH:MM:SS", 상대 시간은 분 단위(t_min).

export type Provider = "zoro1" | "mock" | "rule";
export type Priority = "P0" | "P1" | "P2";
export type RoleId = "operator" | "cooling_A" | "gpu_B" | "policy_admin";
export type DataSource = "seed" | "sim_estimate" | "sim_executed" | "assumption";
export type ActionType = "cooling_change" | "job_migrate" | "job_defer" | "request_info" | "escalate";

export interface Node {
  id: string; zone_id: string; temp_c: number; gpu_util_pct: number; power_kw: number;
  gpus_total: number; gpus_free: number; job_ids: string[];
  flags: ("fan_issue" | "protected" | "rising")[];
}
export interface Job {
  id: string; priority: Priority; node_id: string | null; gpus: number; remaining_min: number;
  deadline_min: number | null; deadline_at: string | null; restart_cost_min: number;
  status: "running" | "queued" | "deferred" | "done";
}
export interface Zone { id: string; cooling_level: number; cooling_max: number; power_kw: number; flags: string[]; }
export interface Note { id: string; author: string; created_at: string; node_id: string | null; text: string; } // text는 원문 그대로
export interface TempPoint { t: string; temp_c: number; }
export interface Snapshot {
  snapshot_id: string; parent_id: string | null; sim_time: string; tick_s: 30;
  nodes: Node[]; jobs: Job[]; zones: Zone[]; notes: Note[];
  history: { node_id: string; points: TempPoint[] }[]; source: DataSource;
}
export interface Incident {
  id: string; severity: "low" | "medium" | "high"; title: string; node_ids: string[];
  job_ids: string[]; detected_at: string; status: "needs_decision" | "awaiting_approval" | "executed" | "closed";
  policy_refs: string[]; snapshot_id: string; no_action_forecast: Estimate;
}
export interface Policy {
  id: string; type: "hard" | "approval" | "objective"; text: string; scope: string;
  version: string; params?: Record<string, number | string>;
}
export interface Role { id: RoleId; label: string; can_approve: ActionType[]; can_edit_policy: boolean; }

export interface Candidate {
  id: string; type: ActionType; label: string; params: Record<string, string | number>;
  requires_approval_role: RoleId | null; filtered_out: boolean; filter_reason: string | null; // 정책 ID
  origin: "generated" | "operator_forced";
}
export interface Decision {
  decision_id: string; incident_id: string; snapshot_id: string; policy_version: string;
  branch_id: string; provider: Provider; selected_id: string; probs: Record<string, number> | null; // zoro1일 때만
  rationale: string | null; latency_ms: number; fallback_reason: string | null; created_at: string;
}
export interface Estimate {
  action_id: string | null; horizon_ticks: number; // null = 조치 없음
  peak_temp_c: Record<string, number>; temp_series: { node_id: string; points: { t_min: number; temp_c: number }[] }[];
  cooling_kwh: number; cooling_kwh_delta_pct: number; total_kwh: number;
  job_finish_min: Record<string, number>; deadline_slack_min: Record<string, number>; throttle_min: number;
  completed_work: number; remaining_work: number; risk: "low" | "medium" | "high"; risk_note: string;
  violations: string[]; source: "sim_estimate";
}
export interface ExperimentChanges {
  deadline_min?: number; cooling_max?: number; n2_gpus_free?: number;
  j07_priority?: Priority; objective?: "energy" | "balanced" | "performance"; approval_delay_min?: number;
}
export interface Experiment {
  branch_id: string; base_snapshot_id: string; changes: ExperimentChanges;
  candidates: Candidate[]; decision: Decision; estimate: Estimate;
}
export interface Check {
  policy_id: string; name: string; criterion: string; observed: string;
  result: "pass" | "fail" | "needs_approval" | "warn"; // warn = objective 정책, 차단하지 않음
}
export interface Validation {
  validation_id: string; decision_id: string; action_id: string;
  origin: "model" | "operator_forced"; snapshot_id: string; policy_version: string; checks: Check[];
  verdict: "allowed" | "conditional" | "blocked"; approval_id: string | null; log: string[];
}
export interface Comment { role: RoleId; text: string; at: string; }
export interface Approval {
  approval_id: string; decision_id: string; action_id: string; required_role: RoleId;
  notified_roles: RoleId[]; status: "pending" | "approved" | "changes_requested" | "rejected" | "escalated" | "expired";
  comments: Comment[]; decided_by: RoleId | null; decided_at: string | null; expires_at: string;
}
export interface Execution {
  execution_id: string; approval_id: string | null; action_id: string; recheck: Check[];
  status: "succeeded" | "held" | "failed"; steps: { label: string; at: string; ok: boolean }[];
  before: Snapshot; after: Snapshot;
  sla: { job_id: string; finish_at: string; deadline_at: string; slack_min: number; met: boolean };
  source: "sim_executed";
}
export type ReceiptEventType = "incident_detected" | "severity_changed" | "policy_applied" | "decision_made"
  | "experiment_run" | "futures_simulated" | "validated" | "blocked" | "approval_requested" | "comment"
  | "approved" | "changes_requested" | "rejected" | "escalated" | "rechecked" | "executed"
  | "execution_failed" | "model_error" | "fallback";
export interface ReceiptEvent {
  seq: number; at: string; actor: "system" | "model" | "simulator" | RoleId;
  type: ReceiptEventType; summary: string; ref_id?: string; provider?: Provider; is_assumption?: boolean;
  data?: Record<string, unknown>;
}
export interface Receipt {
  decision_id: string; incident_id: string; policy_version: string; snapshot_id: string;
  provider: Provider; status: "open" | "executed" | "held" | "failed";
  branches: { branch_id: string; changes: ExperimentChanges; selected_id: string; provider: Provider; executed: boolean }[];
  candidates: Candidate[]; validations: Validation[]; approvals: Approval[]; execution: Execution | null;
  events: ReceiptEvent[]; // 추가만, seq 오름차순
}
export interface ApiError { error: { code: string; message: string; policy_id?: string; detail?: unknown } }

// ---- 요청 본문 (§5) ----
export interface DecideRequest { incident_id: string; snapshot_id: string; policy_version: string; branch_id?: string; }
export interface DecideResponse { decision: Decision; candidates: Candidate[]; }
export interface ExperimentRequest { decision_id: string; base_snapshot_id: string; changes: ExperimentChanges; policy_version: string; }
export interface CompareResponse { base: Experiment; branch: Experiment; changed_keys: string[]; }
export interface FuturesRequest { decision_id: string; snapshot_id: string; action_ids: string[]; horizon_ticks: number; }
export interface FuturesResponse { estimates: Estimate[]; }
export interface ValidateRequest { decision_id: string; action_id: string; origin: "model" | "operator_forced"; }
export interface ApprovalDecisionRequest {
  action: "approve" | "request_changes" | "reject" | "escalate"; note?: string; idempotency_key: string;
}
export type ExecuteRequest =
  | { approval_id: string; idempotency_key: string }
  | { decision_id: string; action_id: string; idempotency_key: string };
export interface PoliciesResponse { version: string; policies: Policy[]; roles: Role[]; candidates: Candidate[]; }
export interface HealthResponse { status: "ok"; contract_version: string; provider_mode: Provider; zoro1_reachable: boolean; }
