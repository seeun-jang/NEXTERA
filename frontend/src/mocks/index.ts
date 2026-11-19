// 서버 없이 §5 API 전체를 흉내 내는 mock. 시드 JSON(@seed)에서 출발하고 메모리에만 상태를 둔다.
// 판단은 모두 provider: "mock". 역할 검사(403)·차단(POL-03)·멱등 실행도 재현한다.
import type {
  Approval, Candidate, Check, Decision, Execution, Experiment, ExperimentChanges, Incident, Policy,
  Receipt, ReceiptEvent, Role, RoleId, Snapshot, Validation,
} from "@contracts/types";
import snapshotSeed from "@seed/snapshot_S0.json";
import policySeed from "@seed/policy_v1.2.json";
import rolesSeed from "@seed/roles.json";
import { ApiClientError } from "@/api/errors";
import { getClientRole } from "@/api/role";
import type { AnalyticsResponse, NexteraApi } from "@/api/types";
import { buildCandidates, estimateFor, HORIZON_TICKS, mockChoose } from "./data";

const POLICY_VERSION = "1.2";
const INCIDENT_ID = "INC-0412";
const DECISION_ID = "DR-0412-01";
const LATENCY_MS = 250; // 로딩 상태가 보이도록

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fail = (status: number, code: string, message: string, policy_id?: string): never => {
  throw new ApiClientError(status, { code, message, policy_id });
};

// ---------- 시뮬레이션 시계 ----------
function toSec(t: string) {
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}
function toTime(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}
export const addMinutes = (t: string, min: number) => toTime(toSec(t) + min * 60);

// ---------- 메모리 상태 ----------
interface Store {
  clock: number; // 초
  snapshots: Map<string, Snapshot>;
  decisions: Map<string, Decision>; // key = branch_id
  experiments: Map<string, Experiment>;
  candidates: Map<string, Candidate[]>; // key = branch_id
  validations: Validation[];
  approvals: Map<string, Approval>;
  approvalKeys: Map<string, string>;
  executions: Map<string, Execution>; // key = idempotency_key
  events: ReceiptEvent[];
  seq: number;
  branchSeq: number;
  validationSeq: number;
  approvalSeq: number;
}

const seedSnapshot = snapshotSeed as unknown as Snapshot;
const policies = (policySeed as unknown as { policies: Policy[] }).policies;
const roles = rolesSeed as unknown as Role[];

let S: Store = fresh();

function fresh(): Store {
  const st: Store = {
    clock: toSec(seedSnapshot.sim_time),
    snapshots: new Map([["S0", clone(seedSnapshot)]]),
    decisions: new Map(),
    experiments: new Map(),
    candidates: new Map(),
    validations: [],
    approvals: new Map(),
    approvalKeys: new Map(),
    executions: new Map(),
    events: [],
    seq: 0,
    branchSeq: 0,
    validationSeq: 0,
    approvalSeq: 0,
  };
  return st;
}

function now(advanceSec = 1) {
  S.clock += advanceSec;
  return toTime(S.clock);
}

function log(e: Omit<ReceiptEvent, "seq">) {
  S.events.push({ ...e, seq: ++S.seq });
}

function initEvents() {
  log({ at: toTime(S.clock), actor: "system", type: "incident_detected", summary: "사건 감지 INC-0412 · N4 열 위험·팬 교체 메모", ref_id: INCIDENT_ID });
  log({ at: now(2), actor: "operator", type: "severity_changed", summary: "심각도 수정 보통 → 높음", ref_id: INCIDENT_ID });
}
initEvents();

const snap = (id: string) => S.snapshots.get(id) ?? fail(404, "NOT_FOUND", `스냅샷 ${id}가 없습니다.`);
const deadlineOf = (s: Snapshot) => s.jobs.find((j) => j.id === "J07")?.deadline_min ?? 5;

function candidateById(id: string): Candidate {
  for (const list of S.candidates.values()) {
    const c = list.find((x) => x.id === id);
    if (c) return c;
  }
  return buildCandidates(snap("S0")).find((x) => x.id === id) ?? fail(400, "INVALID_REQUEST", `알 수 없는 행동 ${id}`);
}

// ---------- 판단 ----------
function runDecision(branchId: string, changes: ExperimentChanges = {}): { decision: Decision; candidates: Candidate[] } {
  const s = snap(branchId);
  const cands = buildCandidates(s, changes);
  const passed = cands.filter((c) => !c.filtered_out).length;
  log({ at: now(1), actor: "system", type: "policy_applied", summary: `정책 v${POLICY_VERSION} 적용 · 후보 ${cands.length} → ${passed}`, ref_id: branchId });
  const choice = mockChoose(cands, changes, deadlineOf(s));
  const decision: Decision = {
    decision_id: DECISION_ID,
    incident_id: INCIDENT_ID,
    snapshot_id: branchId,
    policy_version: POLICY_VERSION,
    branch_id: branchId,
    provider: "mock",
    selected_id: choice.id,
    probs: null,
    rationale: `${choice.rationale} (예시 문구)`,
    latency_ms: 0,
    fallback_reason: "MOCK_MODE",
    created_at: now(2),
  };
  S.decisions.set(branchId, decision);
  S.candidates.set(branchId, cands);
  const label = cands.find((c) => c.id === choice.id)?.label ?? choice.id;
  log({
    at: decision.created_at, actor: "model", type: "decision_made", provider: "mock", ref_id: branchId,
    is_assumption: branchId !== "S0",
    summary: branchId === "S0" ? `판단: ${label}` : `실험 ${branchId} 판단: ${label}`,
  });
  return { decision, candidates: cands };
}

function ensureBaseDecision() {
  if (!S.decisions.has("S0")) runDecision("S0");
}

function baseExperiment(): Experiment {
  ensureBaseDecision();
  const d = S.decisions.get("S0")!;
  return {
    branch_id: "S0", base_snapshot_id: "S0", changes: {},
    candidates: S.candidates.get("S0")!, decision: d, estimate: estimateFor(d.selected_id, {}, deadlineOf(snap("S0"))),
  };
}

// ---------- 검사 ----------
function runChecks(action: Candidate, branchId: string): Check[] {
  const s = snap(branchId);
  const checks: Check[] = [];
  const est = estimateFor(action.id, {}, deadlineOf(s));
  if (action.type === "job_migrate") {
    const to = String(action.params.to);
    const free = s.nodes.find((n) => n.id === to)?.gpus_free ?? 0;
    const need = Number(action.params.gpus ?? 8);
    checks.push({
      policy_id: "POL-03", name: "대상 노드 용량", criterion: `요청 GPU ${need} ≤ 여유`,
      observed: `${to} 여유 ${free}`, result: free >= need ? "pass" : "fail",
    });
    // 용량에서 막히면 실행 자체가 불가능하므로 이후 예측 검사는 하지 않는다.
    if (free < need) return checks;
  }
  const touchesP0 = action.params.job === "J09";
  checks.push({
    policy_id: "POL-01", name: "P0 작업 보호", criterion: "P0 작업 중단 없음",
    observed: touchesP0 ? "J09(N6) 중단 요청" : "J09(N6) 영향 없음", result: touchesP0 ? "fail" : "pass",
  });
  const peak = Math.max(...Object.values(est.peak_temp_c));
  checks.push({
    policy_id: "POL-02", name: "열 안전 한계", criterion: "예측 최고 ≤ 88°C",
    observed: `${peak}°C (추정)`, result: peak <= 88 ? "pass" : "fail",
  });
  if (action.type === "job_migrate") {
    // objective(POL-08) 검사: 차단하지 않고 warn만 남긴다.
    const slack = est.deadline_slack_min.J07;
    checks.push({
      policy_id: "POL-08", name: "작업 중단 제한", criterion: "재시작 후에도 마감 안",
      observed: `재시작 1.0분 · 마감 여유 ${slack}분`,
      result: slack >= 0 ? "pass" : "warn",
    });
  }
  if (action.requires_approval_role) {
    const pid = action.type === "cooling_change" ? "POL-05" : action.type === "job_defer" ? "POL-06" : "POL-04";
    checks.push({
      policy_id: pid, name: "승인 권한",
      criterion: action.requires_approval_role === "cooling_A" ? "냉각 운영 승인" : "GPU 운영 승인",
      observed: "아직 없음", result: "needs_approval",
    });
  }
  return checks;
}

function notFoundApproval(id: string): never {
  return fail(404, "NOT_FOUND", `승인 요청 ${id}가 없습니다.`);
}

const APPROVAL_POLICY: Record<string, string> = { job_migrate: "POL-04", cooling_change: "POL-05", job_defer: "POL-06" };

// ---------- 실행 ----------
function applyAction(before: Snapshot, action: Candidate, at: string): Snapshot {
  const after = clone(before);
  after.snapshot_id = `${before.snapshot_id}-exec`;
  after.parent_id = before.snapshot_id;
  after.sim_time = addMinutes(at, 1.5);
  after.source = "sim_executed";
  const n = (id: string) => after.nodes.find((x) => x.id === id)!;
  if (action.id === "A-MIG-J07-N2") {
    Object.assign(n("N4"), { temp_c: 72, gpu_util_pct: 2, power_kw: 1.2, gpus_free: 8, job_ids: [], flags: ["fan_issue"] });
    Object.assign(n("N2"), { temp_c: 65, gpu_util_pct: 95, power_kw: 5.2, gpus_free: 0, job_ids: ["J07"], flags: [] });
    const j = after.jobs.find((x) => x.id === "J07")!;
    j.node_id = "N2";
  } else if (action.id === "A-COOL-Z2-UP") {
    const z = after.zones.find((x) => x.id === "Z2")!;
    z.cooling_level += 1;
    Object.assign(n("N4"), { temp_c: 83 });
  } else if (action.id === "A-DEF-J08-30") {
    Object.assign(n("N5"), { temp_c: 60, gpu_util_pct: 4, power_kw: 1.2, gpus_free: 8, job_ids: [] });
    const j = after.jobs.find((x) => x.id === "J08")!;
    j.status = "deferred";
    j.node_id = null;
  }
  for (const z of after.zones) {
    z.power_kw = Math.round(after.nodes.filter((x) => x.zone_id === z.id).reduce((a, x) => a + x.power_kw, 0) * 10) / 10;
  }
  return after;
}

function doExecute(action: Candidate, approvalId: string | null, key: string): Execution {
  const prior = S.executions.get(key);
  if (prior) return prior; // 같은 요청은 한 번만 적용
  for (const e of S.executions.values()) {
    if (e.status === "succeeded") fail(409, "ALREADY_EXECUTED", "이 결정은 이미 실행되었습니다.");
  }
  const before = clone(snap("S0"));
  const t0 = now(0);
  const recheck: Check[] = [
    { policy_id: "-", name: "상태", criterion: "승인 시점 최신 상태", observed: `${before.sim_time} 기준 변화 없음`, result: "pass" },
    { policy_id: `v${POLICY_VERSION}`, name: "정책", criterion: "버전 동일", observed: `v${POLICY_VERSION} 그대로`, result: "pass" },
    ...runChecks(action, "S0").filter((c) => c.result !== "needs_approval"),
    ...(approvalId ? [{ policy_id: APPROVAL_POLICY[action.type] ?? "-", name: "권한", criterion: "승인자 역할 일치", observed: "승인됨", result: "pass" as const }] : []),
  ];
  log({ at: t0, actor: "system", type: "rechecked", summary: "실행 직전 재검사 통과", ref_id: approvalId ?? action.id });
  const finish = estimateFor(action.id, {}, deadlineOf(before)).job_finish_min.J07;
  const deadlineAt = before.jobs.find((j) => j.id === "J07")?.deadline_at ?? "14:05:00";
  const finishAt = addMinutes(before.sim_time, finish);
  const steps =
    action.type === "job_migrate"
      ? [
          { label: "승인", at: t0, ok: true },
          { label: "실행 직전 재검사 통과", at: t0, ok: true },
          { label: "체크포인트 저장", at: t0, ok: true },
          { label: "N2에서 재시작 완료", at: addMinutes(t0, 1), ok: true },
          { label: "J07 완료 (예상)", at: finishAt, ok: true },
        ]
      : [
          { label: "승인", at: t0, ok: true },
          { label: "실행 직전 재검사 통과", at: t0, ok: true },
          { label: "가상 환경에 적용", at: t0, ok: true },
          { label: "J07 완료 (예상)", at: finishAt, ok: true },
        ];
  const exec: Execution = {
    execution_id: "EXE-0412-01",
    approval_id: approvalId,
    action_id: action.id,
    recheck,
    status: "succeeded",
    steps,
    before,
    after: applyAction(before, action, t0),
    sla: {
      job_id: "J07", finish_at: finishAt, deadline_at: deadlineAt,
      slack_min: Math.round((toSec(deadlineAt) - toSec(finishAt)) / 6) / 10,
      met: toSec(finishAt) <= toSec(deadlineAt),
    },
    source: "sim_executed",
  };
  S.executions.set(key, exec);
  log({ at: t0, actor: "simulator", type: "executed", summary: `${action.label} · 성공 · 시뮬레이션`, ref_id: exec.execution_id });
  log({ at: exec.sla.finish_at, actor: "simulator", type: "executed", summary: `J07 완료 · ${exec.sla.met ? `마감 준수 · 여유 ${exec.sla.slack_min}분` : "마감 미준수"}`, ref_id: exec.execution_id });
  return exec;
}

// ---------- 영수증 ----------
function buildReceipt(): Receipt {
  ensureBaseDecision();
  const d = S.decisions.get("S0")!;
  const exec = [...S.executions.values()].find((e) => e.status === "succeeded") ?? null;
  const branches = [...S.decisions.values()].map((x) => ({
    branch_id: x.branch_id,
    changes: S.experiments.get(x.branch_id)?.changes ?? {},
    selected_id: x.selected_id,
    provider: x.provider,
    executed: x.branch_id === "S0" && !!exec,
  }));
  const forced = S.validations.filter((v) => v.origin === "operator_forced").map((v) => candidateById(v.action_id));
  const cands = [...(S.candidates.get("S0") ?? [])];
  for (const f of forced) {
    const i = cands.findIndex((c) => c.id === f.id);
    if (i >= 0) cands[i] = { ...cands[i], origin: "operator_forced" };
  }
  return {
    decision_id: d.decision_id,
    incident_id: d.incident_id,
    policy_version: d.policy_version,
    snapshot_id: "S0",
    provider: d.provider,
    status: exec ? "executed" : "open",
    branches,
    candidates: cands,
    validations: clone(S.validations),
    approvals: clone([...S.approvals.values()]),
    execution: exec,
    events: clone(S.events),
  };
}

// ---------- API ----------
export const mockApi: NexteraApi = {
  async health() {
    await sleep(80);
    return { status: "ok", contract_version: "1.0.0", provider_mode: "mock", zoro1_reachable: false };
  },

  async resetDemo() {
    await sleep(LATENCY_MS);
    S = fresh();
    initEvents();
    return { snapshot_id: "S0" };
  },

  async getState(snapshotId = "S0") {
    await sleep(LATENCY_MS);
    return clone(snap(snapshotId));
  },

  async getIncident(id) {
    await sleep(LATENCY_MS);
    if (id !== INCIDENT_ID) fail(404, "NOT_FOUND", `사건 ${id}가 없습니다.`);
    const exec = [...S.executions.values()].some((e) => e.status === "succeeded");
    const incident: Incident = {
      id: INCIDENT_ID,
      severity: "high",
      title: "N4 열 위험 · P1 작업 J07 실행 중",
      node_ids: ["N4"],
      job_ids: ["J07"],
      detected_at: "14:00:00",
      status: exec ? "executed" : S.approvals.size ? "awaiting_approval" : "needs_decision",
      policy_refs: ["POL-01", "POL-02", "POL-03", "POL-04", "POL-05"],
      snapshot_id: "S0",
      no_action_forecast: estimateFor(null),
    };
    return incident;
  },

  async getPolicies(version = POLICY_VERSION) {
    await sleep(LATENCY_MS);
    if (version !== POLICY_VERSION) fail(404, "NOT_FOUND", `정책 버전 ${version}이 없습니다.`);
    return { version, policies: clone(policies), roles: clone(roles), candidates: buildCandidates(snap("S0")) };
  },

  async decide(req) {
    await sleep(600);
    const branch = req.branch_id ?? req.snapshot_id ?? "S0";
    return clone(runDecision(branch));
  },

  async createExperiment(req) {
    await sleep(700);
    ensureBaseDecision();
    const base = snap(req.base_snapshot_id);
    const branchId = `${req.base_snapshot_id}-b${++S.branchSeq}`;
    const b = clone(base);
    b.snapshot_id = branchId;
    b.parent_id = base.snapshot_id;
    b.source = "assumption";
    const j07 = b.jobs.find((j) => j.id === "J07")!;
    if (req.changes.deadline_min !== undefined) {
      j07.deadline_min = req.changes.deadline_min;
      j07.deadline_at = addMinutes(b.sim_time, req.changes.deadline_min);
    }
    if (req.changes.j07_priority) j07.priority = req.changes.j07_priority;
    if (req.changes.n2_gpus_free !== undefined) b.nodes.find((n) => n.id === "N2")!.gpus_free = req.changes.n2_gpus_free;
    if (req.changes.cooling_max !== undefined) b.zones.find((z) => z.id === "Z2")!.cooling_max = req.changes.cooling_max;
    S.snapshots.set(branchId, b);
    const { decision, candidates } = runDecision(branchId, req.changes);
    const exp: Experiment = {
      branch_id: branchId,
      base_snapshot_id: req.base_snapshot_id,
      changes: clone(req.changes),
      candidates,
      decision,
      estimate: estimateFor(decision.selected_id, req.changes, deadlineOf(b)),
    };
    S.experiments.set(branchId, exp);
    const desc = Object.entries(req.changes).map(([k, v]) => `${k}=${v}`).join(", ");
    log({ at: now(1), actor: "operator", type: "experiment_run", summary: `실험 ${branchId} (${desc} 가정)`, ref_id: branchId, is_assumption: true });
    return clone(exp);
  },

  async compareExperiment(branchId) {
    await sleep(LATENCY_MS);
    const branch = S.experiments.get(branchId) ?? fail(404, "NOT_FOUND", `실험 분기 ${branchId}가 없습니다.`);
    return { base: clone(baseExperiment()), branch: clone(branch), changed_keys: Object.keys(branch.changes) };
  },

  async futures(req) {
    await sleep(500);
    const s = snap(req.snapshot_id);
    const estimates = req.action_ids.map((id) => estimateFor(id, {}, deadlineOf(s)));
    log({ at: now(1), actor: "simulator", type: "futures_simulated", summary: `병렬 미래 ${req.action_ids.length}안 시뮬레이션 (${req.horizon_ticks ?? HORIZON_TICKS}틱)`, ref_id: req.snapshot_id });
    return { estimates };
  },

  async validate(req) {
    await sleep(LATENCY_MS);
    ensureBaseDecision();
    const action = candidateById(req.action_id);
    const checks = runChecks(action, "S0");
    const blocked = checks.some((c) => c.result === "fail");
    const needs = checks.some((c) => c.result === "needs_approval");
    const at = now(2);
    const v: Validation = {
      validation_id: `VAL-0412-${String(++S.validationSeq).padStart(2, "0")}`,
      decision_id: req.decision_id,
      action_id: action.id,
      origin: req.origin,
      snapshot_id: "S0",
      policy_version: POLICY_VERSION,
      checks,
      verdict: blocked ? "blocked" : needs ? "conditional" : "allowed",
      approval_id: null,
      log: [
        `${at} validate ${action.label}${req.origin === "operator_forced" ? " (operator_forced)" : ""}`,
        ...checks.map((c) => `${at} ${c.policy_id} ${c.name} ${c.observed} ${c.result.toUpperCase()}`),
        `${at} result ${blocked ? "BLOCKED · 실행 큐 제외" : needs ? "CONDITIONAL · 승인 필요" : "ALLOWED"}`,
      ],
    };
    if (blocked) {
      const failed = checks.find((c) => c.result === "fail")!;
      log({ at, actor: "system", type: "blocked", summary: `${req.origin === "operator_forced" ? "테스트 " : ""}차단 · ${action.label} · ${failed.policy_id}`, ref_id: v.validation_id });
    } else {
      log({ at, actor: "system", type: "validated", summary: `안전 검사 ${needs ? "조건부 허용" : "허용"} · ${action.label}`, ref_id: v.validation_id });
    }
    if (!blocked && needs && action.requires_approval_role) {
      const existing = [...S.approvals.values()].find((a) => a.action_id === action.id && a.status === "pending");
      if (existing) {
        v.approval_id = existing.approval_id;
      } else {
        const id = `APR-0412-${String(++S.approvalSeq).padStart(2, "0")}`;
        const other: RoleId = action.requires_approval_role === "gpu_B" ? "cooling_A" : "gpu_B";
        const t = now(1);
        S.approvals.set(id, {
          approval_id: id, decision_id: req.decision_id, action_id: action.id,
          required_role: action.requires_approval_role, notified_roles: [action.requires_approval_role, other],
          status: "pending", comments: [], decided_by: null, decided_at: null, expires_at: addMinutes(t, 5),
        });
        v.approval_id = id;
        log({ at: t, actor: "system", type: "approval_requested", summary: `승인 요청 ${id} 생성 · 필요 역할 ${action.requires_approval_role}`, ref_id: id });
      }
    }
    S.validations.push(v);
    return clone(v);
  },

  async getApproval(id) {
    await sleep(LATENCY_MS);
    return clone(S.approvals.get(id) ?? notFoundApproval(id));
  },

  async commentApproval(id, text) {
    await sleep(LATENCY_MS);
    const a = S.approvals.get(id) ?? notFoundApproval(id);
    const role = getClientRole();
    const at = now(8);
    a.comments.push({ role, text, at });
    log({ at, actor: role, type: "comment", summary: `의견 등록: ${text}`, ref_id: id });
    return clone(a);
  },

  async decideApproval(id, req) {
    await sleep(LATENCY_MS);
    const a = S.approvals.get(id) ?? notFoundApproval(id);
    const role = getClientRole();
    const action = candidateById(a.action_id);
    if (role !== a.required_role) {
      log({ at: now(2), actor: role, type: "blocked", summary: `권한 없는 승인 시도 거부 · ${APPROVAL_POLICY[action.type] ?? "권한"}`, ref_id: id });
      fail(403, "ROLE_FORBIDDEN", `현재 역할은 이 행동을 결정할 권한이 없습니다 (${APPROVAL_POLICY[action.type] ?? "권한"}).`, APPROVAL_POLICY[action.type]);
    }
    if (a.status !== "pending") {
      if (S.approvalKeys.get(id) === req.idempotency_key) return clone(a);
      fail(409, "ALREADY_EXECUTED", "이미 결정된 승인 요청입니다.");
    }
    const map = { approve: "approved", request_changes: "changes_requested", reject: "rejected", escalate: "escalated" } as const;
    const evt = { approve: "approved", request_changes: "changes_requested", reject: "rejected", escalate: "escalated" } as const;
    const label = { approve: "승인", request_changes: "수정 요청", reject: "거부", escalate: "이관" } as const;
    a.status = map[req.action];
    a.decided_by = role;
    a.decided_at = now(5);
    S.approvalKeys.set(id, req.idempotency_key);
    log({ at: a.decided_at, actor: role, type: evt[req.action], summary: `${label[req.action]}${req.note ? ` · ${req.note}` : ""}`, ref_id: id });
    return clone(a);
  },

  async execute(req) {
    await sleep(700);
    if ("approval_id" in req) {
      const a = S.approvals.get(req.approval_id) ?? notFoundApproval(req.approval_id);
      if (a.status !== "approved") {
        const action = candidateById(a.action_id);
        fail(403, "ROLE_FORBIDDEN", "권한자 승인 전에는 실행할 수 없습니다.", APPROVAL_POLICY[action.type]);
      }
      return clone(doExecute(candidateById(a.action_id), a.approval_id, req.idempotency_key));
    }
    const action = candidateById(req.action_id);
    if (action.requires_approval_role) {
      fail(403, "ROLE_FORBIDDEN", "승인이 필요한 행동입니다.", APPROVAL_POLICY[action.type]);
    }
    return clone(doExecute(action, null, req.idempotency_key));
  },

  async getReceipt(decisionId) {
    await sleep(LATENCY_MS);
    if (decisionId !== DECISION_ID) fail(404, "NOT_FOUND", `결정 ${decisionId}가 없습니다.`);
    return buildReceipt();
  },

  async listReceipts() {
    await sleep(LATENCY_MS);
    return S.decisions.size ? [buildReceipt()] : [];
  },

  async getAnalytics(): Promise<AnalyticsResponse> {
    await sleep(LATENCY_MS);
    // 화면 설계용 예시 값(스토리보드 SCREEN 13). is_example=true → "예시 데이터 · 측정값 아님".
    return {
      is_example: true,
      total_decisions: 24,
      blocked_attempts: 3,
      escalation_rate_pct: 12.5,
      deadline_met: { met: 21, total: 24 },
      consistency: { same: 23, total: 24 },
      results: { succeeded: 20, held: 3, failed: 1 },
      recent: [
        { decision_id: "DR-0412-01", incident_id: "INC-0412", action_label: "J07을 N2로 이동", status: "executed", deadline_met: true },
        { decision_id: "DR-0410-02", incident_id: "INC-0410", action_label: "J05 연기", status: "executed", deadline_met: false },
        { decision_id: "DR-0408-03", incident_id: "INC-0408", action_label: "J02를 N5로 이동", status: "held", deadline_met: false },
      ],
    };
  },
};
