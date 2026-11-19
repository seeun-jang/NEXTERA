// 다중 작업 버전 API (/api/v2) — 백엔드 MULTI_API.md의 요청·응답 모양과, 화면이 쓰는 모양(sim/engine 타입) 사이의 얇은 층.
// 백엔드 응답 모양이 바뀌면 이 파일의 타입과 from*() 변환만 고치면 된다. 화면 코드는 건드리지 않는다.
import { ApiClientError } from "./errors";
import { getClientRole } from "./role";
import type { Incident, Plan, SimResult, State, Step } from "@/sim/engine";
import type { Pri, Role, Situation } from "@/sim/model";

const BASE = (import.meta.env.VITE_API_BASE ?? "http://localhost:8000").replace(/\/$/, "");

function sessionId(): string {
  try {
    let id = sessionStorage.getItem("nx-session");
    if (!id) {
      id = `S-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem("nx-session", id);
    }
    return id;
  } catch {
    return "S-anon";
  }
}

async function http<T>(method: "GET" | "POST", path: string, body?: unknown, role?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v2${path}`, {
      method,
      headers: { "Content-Type": "application/json", "X-Role": role ?? getClientRole(), "X-Session": sessionId() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError(0, { code: "NETWORK", message: `서버에 연결할 수 없습니다 (${BASE})` });
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiClientError(res.status, json?.error ?? { code: "INTERNAL", message: `HTTP ${res.status}` });
  return json as T;
}

// ---------- 서버 모양 (MULTI_API.md) ----------
export interface V2Node { id: string; zone: string; temp_c: number; gpus_total: number; gpus_used: number; gpus_free: number; running: string[]; waiting: string[] }
export interface V2Zone { id: string; node_ids: string[]; cooling_level: number; cooling_max: number }
export interface V2Job { id: string; gpus: number; priority: Pri; deadline_min: number | null; remaining_min: number; node: string; status: "running" | "waiting" | "deferred" }
export interface V2Problem { id: string; kind: "overheat" | "deadline"; node?: string | null; job?: string | null; priority: Pri; severity: string; time_min: number; text: string }
export interface V2NoAction { peak_c: number; reach_limit_min: number | null; temps: Record<string, number[]>; job_finish_min: Record<string, number>; late_jobs: string[] }
export interface V2StateResp {
  round: number; max_rounds: number; status: string;
  state: { nodes: V2Node[]; zones: V2Zone[]; jobs: V2Job[] };
  problems: V2Problem[]; no_action: V2NoAction; history: unknown[];
}
export interface V2Step { index: number; type: "move" | "jump" | "evacuate" | "defer" | "cool"; label: string; requires_approval_role: Role; job?: string; to?: string; preempt?: string[]; minutes?: number; zone?: string; level?: number }
export interface V2Candidate {
  id: string; label: string; strategies: string[]; steps: V2Step[]; required_roles: Role[];
  max_peak_c: number; max_peak_node: string; peak_c?: Record<string, number> | number; cooling_kwh: number; cooling_kwh_delta?: number;
  late_jobs: string[]; job_finish_min: Record<string, number>; resolved: string[]; remaining: string[]; new_problems: string[];
}
export interface V2Decision {
  status: "decided" | "handoff" | "no_problem"; provider: "zoro1" | "rule" | "mock"; selected_id: string | null;
  probs: Record<string, number> | null; rationale: string | null; fallback_reason: string | null; escalate?: unknown[];
}
export interface V2DecideResp { decision: V2Decision; candidates: V2Candidate[]; problems: V2Problem[]; escalate: unknown[] }
export interface V2ValidateResp { verdict: "conditional" | "blocked"; checks: { policy_id?: string; rule?: string; result: string; message?: string; text?: string }[]; required_roles: Role[] }
export interface V2ExecuteResp {
  status: "succeeded" | "held"; before: V2StateResp["state"]; after: V2StateResp["state"];
  resolved: (string | V2Problem)[]; remaining: (string | V2Problem)[];
  next: { status: "next_round" | "resolved" | "stalled" | "max_rounds" };
}
export interface V2ReceiptResp { events?: { at?: string; time?: string; actor?: string; type?: string; kind?: string; text?: string; summary?: string; round?: number }[] }

// ---------- 호출 ----------
export const v2 = {
  scenario: (s: Situation) => http<V2StateResp>("POST", "/scenario", toScenarioBody(s)),
  state: () => http<V2StateResp>("GET", "/state"),
  decide: () => http<V2DecideResp>("POST", "/decide", {}),
  validate: (body: { plan_id: string } | { steps: unknown[] }) => http<V2ValidateResp>("POST", "/validate", body),
  approve: (planId: string, role: string) => http<{ status: string }>("POST", "/approvals", { plan_id: planId, action: "approve" }, role),
  execute: (planId: string) => http<V2ExecuteResp>("POST", "/execute", { plan_id: planId }),
  receipt: () => http<V2ReceiptResp>("GET", "/receipt"),
};

// ---------- 화면 → 서버 ----------
/** 팬 이상은 서버가 받지 않는다(온도만 받음). 같은 노드 안 순서는 배열 순서 그대로. */
export function toScenarioBody(s: Situation) {
  return {
    nodes: s.nodes.map((n) => ({ id: n.id, temp_c: n.temp })),
    zones: s.zones.map((z) => ({ id: z.id, cooling_level: z.level, cooling_max: z.max })),
    jobs: s.jobs.map((j) => ({ id: j.id, gpus: j.gpus, priority: j.priority, deadline_min: j.deadline, remaining_min: j.work, node: j.node })),
    objective: "balanced",
  };
}
export function toServerStep(st: Step, base: State): Record<string, unknown> {
  if (st.kind === "cool") {
    const z = base.zones.find((x) => x.id === st.zone);
    return { type: "cool", zone: st.zone, level: (z?.level ?? 0) + st.delta };
  }
  if (st.kind === "move") return { type: "move", job: st.job, to: st.to };
  if (st.kind === "evac") return { type: "evacuate", job: st.job, to: st.to };
  if (st.kind === "defer") return { type: "defer", job: st.job, minutes: 30 };
  const j = base.jobs.find((x) => x.id === st.job);
  return { type: "jump", job: st.job, to: j?.node };
}

// ---------- 서버 → 화면 ----------
export function fromState(s: V2StateResp["state"], fans: Record<string, boolean> = {}): State {
  const order: Record<string, number> = {};
  s.nodes.forEach((n) => [...n.running, ...n.waiting].forEach((id, i) => (order[id] = i)));
  return {
    nodes: s.nodes.map((n) => ({ id: n.id, temp: n.temp_c, fan: !!fans[n.id] })),
    zones: s.zones.map((z) => ({ id: z.id, level: z.cooling_level, max: z.cooling_max })),
    jobs: s.jobs.map((j, i) => ({
      id: j.id, gpus: j.gpus, priority: j.priority, deadline: j.deadline_min ?? 999, work: j.remaining_min, node: j.node,
      seq: order[j.id] ?? 100 + i, delay: 0, deferUntil: j.status === "deferred" ? 30 : 0, home: null,
    })),
  };
}
export function fromProblem(p: V2Problem): Incident {
  const heat = p.kind === "overheat";
  const target = (heat ? p.node : p.job) ?? p.node ?? p.job ?? p.id;
  return { id: p.id, kind: heat ? "heat" : "deadline", target, node: p.node ?? "", tLimit: p.time_min, priority: p.priority, title: heat ? `${target} 과열 위험` : `${target} 마감 위험`, detail: p.text };
}
export function fromNoAction(na: V2NoAction, limit = 88): SimResult {
  const series: SimResult["series"] = {};
  const peak: SimResult["peak"] = {};
  const firstOver: SimResult["firstOver"] = {};
  for (const [id, temps] of Object.entries(na.temps ?? {})) {
    series[id] = temps.map((t, i) => ({ t: i * 0.5, temp: Math.round(t * 10) / 10 }));
    peak[id] = Math.round(Math.max(...temps) * 10) / 10;
    const hit = series[id].find((x) => x.temp >= limit);
    firstOver[id] = hit ? hit.t : null;
  }
  return { series, peak, firstOver, finish: na.job_finish_min ?? {}, energy: 0 };
}
const STEP_KIND: Record<V2Step["type"], Step["kind"]> = { move: "move", jump: "preempt", evacuate: "evac", defer: "defer", cool: "cool" };
export function fromStep(st: V2Step, base: State): Step {
  const kind = STEP_KIND[st.type];
  if (kind === "cool") {
    const z = base.zones.find((x) => x.id === st.zone);
    return { kind: "cool", zone: st.zone ?? "", delta: (st.level ?? 0) - (z?.level ?? 0) };
  }
  if (kind === "move" || kind === "evac") return { kind, job: st.job ?? "", to: st.to ?? "" };
  return { kind, job: st.job ?? "" } as Step;
}
export function fromCandidate(c: V2Candidate, base: State, problems: Incident[], after?: State): Plan {
  const remaining = c.remaining.map((id) => problems.find((p) => p.id === id) ?? { id, kind: "heat" as const, target: id, node: "", tLimit: 0, priority: "P2" as Pri, title: id, detail: "" });
  return {
    id: c.id,
    strategy: c.label || c.strategies.join(" + "),
    steps: c.steps.map((s) => fromStep(s, base)),
    stepText: c.steps.map((s) => s.label),
    roles: c.required_roles,
    state: after ?? base,
    sim: { series: {}, peak: { [c.max_peak_node]: c.max_peak_c }, firstOver: {}, finish: c.job_finish_min ?? {}, energy: c.cooling_kwh },
    remaining,
    solved: c.resolved,
    peak: c.max_peak_c,
    peakNode: c.max_peak_node,
    energy: c.cooling_kwh,
    lateness: c.late_jobs.length,
    finishSum: Object.values(c.job_finish_min ?? {}).reduce((a, x) => a + x, 0),
    pruned: 0,
  };
}
export const STOP_FROM_NEXT: Record<V2ExecuteResp["next"]["status"], string | null> = { next_round: null, resolved: "done", stalled: "same", max_rounds: "max" };
export const problemId = (x: string | V2Problem) => (typeof x === "string" ? x : x.id);
