// 판단 엔진 (mock) — 명세의 "운영 현황 · 행동 종류 · 중단 규칙 · 후보 생성 · 회차 반복"을 순수 함수로 구현한다.
// 백엔드가 같은 입력(노드 · 구역 · 일)을 받아 같은 출력(사건 · 후보 · 회차)을 돌려주면 이 파일만 교체하면 된다.
// 발열 · 속도 계수는 시연용 단순 모델이다(시뮬레이션 추정). 전수 탐색이 아니므로 "최적"이 아니라 "검증된 전략안 중 선택"이다.
import {
  DEFER_MIN, DT, HORIZON_MIN, LIMIT_C, MAX_CANDIDATES, MAX_JOBS_PER_NODE, NODE_GPUS, PRI_RANK, RECOVER_MIN, RESTART_MIN, RETURN_C,
  THROTTLE_C, zoneOfNode, type JobCfg, type NodeCfg, type Pri, type Role, type Situation, type ZoneCfg,
} from "./model";

// ---------- 상태 ----------
export interface JobState extends JobCfg {
  seq: number; // 노드 안 순서 (작을수록 앞)
  delay: number; // 남은 재시작 지연(분)
  deferUntil: number; // 이 시각(분)까지 연기
  home: string | null; // 임시 대피 중이면 원래 노드
}
export interface State {
  nodes: NodeCfg[];
  zones: ZoneCfg[];
  jobs: JobState[];
}

export function toState(s: Situation): State {
  return {
    nodes: s.nodes.map((n) => ({ ...n })),
    zones: s.zones.map((z) => ({ ...z })),
    jobs: s.jobs.map((j, i) => ({ ...j, seq: i, delay: 0, deferUntil: 0, home: null })),
  };
}
const cloneState = (s: State): State => JSON.parse(JSON.stringify(s));
const zoneLevel = (s: State, nodeId: string) => s.zones.find((z) => z.id === zoneOfNode(nodeId))?.level ?? 1;
const round1 = (x: number) => Math.round(x * 10) / 10;

/** 노드 안에서 줄 순서대로 GPU 합이 8장 이하인 만큼 실행. 못 들어가는 일은 대기하고, 뒤의 작은 일이 빈자리에 들어갈 수 있으면 먼저 실행한다 (백엔드 규칙과 같음) */
function splitQueue<T extends { gpus: number; seq: number }>(jobs: T[]): { running: T[]; waiting: T[] } {
  const sorted = [...jobs].sort((a, b) => a.seq - b.seq);
  const running: T[] = [];
  const waiting: T[] = [];
  let sum = 0;
  for (const j of sorted) {
    if (sum + j.gpus <= NODE_GPUS) {
      running.push(j);
      sum += j.gpus;
    } else {
      waiting.push(j);
    }
  }
  return { running, waiting };
}

export interface NodeView {
  id: string;
  zone: string;
  running: JobState[];
  waiting: JobState[];
  deferred: JobState[];
  usedGpus: number;
  freeGpus: number;
}
/** 지금(0분) 시점의 노드별 실행 · 대기 */
export function nodeViews(s: State): NodeView[] {
  return s.nodes.map((n) => {
    const all = s.jobs.filter((j) => j.node === n.id);
    const active = all.filter((j) => j.deferUntil <= 0);
    const { running, waiting } = splitQueue(active);
    const used = running.reduce((a, j) => a + j.gpus, 0);
    return { id: n.id, zone: zoneOfNode(n.id), running, waiting, deferred: all.filter((j) => j.deferUntil > 0), usedGpus: used, freeGpus: NODE_GPUS - used };
  });
}

// ---------- 시뮬레이션 ----------
/** 발열 모델(시연용 가정): 평형 온도 = 40 + 6.25 × 실행 GPU × (팬 이상 1.5) − 6 × 냉각 레벨, 시간상수 4분 */
const eqTemp = (gpus: number, fan: boolean, level: number) => Math.max(38, 40 + 6.25 * gpus * (fan ? 1.5 : 1) - 6 * level);
const TAU = 4;
const COOLING_KW_PER_LEVEL = 1.2;

export interface SimResult {
  series: Record<string, { t: number; temp: number }[]>;
  peak: Record<string, number>;
  firstOver: Record<string, number | null>; // 88°C에 처음 닿는 시각
  finish: Record<string, number>; // 일별 예상 완료(분)
  energy: number; // 냉각 에너지 kWh (예측 구간)
}

export function simulate(s0: State): SimResult {
  const s = cloneState(s0);
  const rem: Record<string, number> = {};
  const done: Record<string, number> = {};
  for (const j of s.jobs) rem[j.id] = j.work;
  const temp: Record<string, number> = {};
  const series: Record<string, { t: number; temp: number }[]> = {};
  const peak: Record<string, number> = {};
  const firstOver: Record<string, number | null> = {};
  // 시작부터 한계 이상인 노드: RECOVER_MIN 안에 한계 아래로 내려오면 그때부터 다시 본다 (백엔드 규칙과 같음)
  const recovering: Record<string, boolean> = {};
  for (const n of s.nodes) {
    temp[n.id] = n.temp;
    series[n.id] = [{ t: 0, temp: round1(n.temp) }];
    peak[n.id] = n.temp;
    firstOver[n.id] = n.temp >= LIMIT_C ? 0 : null;
    recovering[n.id] = n.temp >= LIMIT_C;
  }
  let frontSeq = -1000;
  for (let t = 0; t < HORIZON_MIN - 1e-9; t += DT) {
    // 임시 대피한 일은 원래 노드가 식으면 그 노드 맨 앞으로 돌아온다
    for (const j of s.jobs) {
      if (j.home && done[j.id] === undefined && temp[j.home] < RETURN_C) {
        j.node = j.home;
        j.home = null;
        j.seq = frontSeq++;
        j.delay += RESTART_MIN;
      }
    }
    for (const n of s.nodes) {
      const active = s.jobs.filter((j) => j.node === n.id && done[j.id] === undefined && j.deferUntil <= t);
      const { running } = splitQueue(active);
      const speed = temp[n.id] >= THROTTLE_C ? 0.7 : 1;
      let gpus = 0;
      for (const j of running) {
        gpus += j.gpus;
        if (j.delay > 0) {
          j.delay = Math.max(0, j.delay - DT);
        } else {
          rem[j.id] -= speed * DT;
          if (rem[j.id] <= 1e-9) done[j.id] = round1(t + DT + rem[j.id] / speed);
        }
      }
      const eq = eqTemp(gpus, n.fan, zoneLevel(s, n.id));
      temp[n.id] += (eq - temp[n.id]) * (1 - Math.exp(-DT / TAU));
      const tt = round1(t + DT);
      series[n.id].push({ t: tt, temp: round1(temp[n.id]) });
      if (recovering[n.id]) {
        if (temp[n.id] < LIMIT_C) {
          recovering[n.id] = false;
          peak[n.id] = temp[n.id];
          firstOver[n.id] = null;
        } else if (tt >= RECOVER_MIN) {
          recovering[n.id] = false;
        }
        continue;
      }
      peak[n.id] = Math.max(peak[n.id], temp[n.id]);
      if (firstOver[n.id] === null && temp[n.id] >= LIMIT_C) firstOver[n.id] = tt;
    }
  }
  const finish: Record<string, number> = {};
  for (const j of s.jobs) finish[j.id] = done[j.id] ?? round1(HORIZON_MIN + j.delay + Math.max(0, rem[j.id]) + Math.max(0, j.deferUntil - HORIZON_MIN));
  for (const k of Object.keys(peak)) peak[k] = round1(peak[k]);
  const energy = round1(s.zones.reduce((a, z) => a + z.level * COOLING_KW_PER_LEVEL, 0) * (HORIZON_MIN / 60));
  return { series, peak, firstOver, finish, energy };
}

// ---------- 사건 ----------
export interface Incident {
  id: string; // HOT-N4 / LATE-J07 (백엔드와 같은 형식)
  kind: "heat" | "deadline";
  target: string; // 노드 또는 일
  node: string;
  tLimit: number; // 한계까지 남은 시간(분)
  priority: Pri;
  title: string;
  detail: string;
}
const PRI_BONUS: Record<Pri, number> = { P0: 6, P1: 3, P2: 0 };

/** 사건 = 조치 없이 두면 88°C를 넘는 노드, 마감을 놓치는 일. 한계까지 짧을수록 · 우선순위가 높을수록 위 */
export function incidents(s: State, sim: SimResult = simulate(s)): Incident[] {
  const views = nodeViews(s);
  const out: Incident[] = [];
  for (const n of s.nodes) {
    const t = sim.firstOver[n.id];
    if (t === null) continue;
    const v = views.find((x) => x.id === n.id)!;
    const pri = [...v.running, ...v.waiting].sort((a, b) => PRI_RANK[a.priority] - PRI_RANK[b.priority])[0]?.priority ?? "P2";
    out.push({ id: `HOT-${n.id}`, kind: "heat", target: n.id, node: n.id, tLimit: t, priority: pri, title: `${n.id} 과열 위험`, detail: `조치가 없으면 약 ${t}분 뒤 ${LIMIT_C}°C 도달${n.fan ? " · 팬 이상" : ""}` });
  }
  for (const j of s.jobs) {
    const f = sim.finish[j.id];
    if (f > j.deadline + 0.05) {
      out.push({ id: `LATE-${j.id}`, kind: "deadline", target: j.id, node: j.node, tLimit: j.deadline, priority: j.priority, title: `${j.id} 마감 위험`, detail: `예상 완료 ${f}분 · 마감 ${j.deadline}분 (${round1(f - j.deadline)}분 늦음)` });
    }
  }
  return out.sort((a, b) => a.tLimit - PRI_BONUS[a.priority] - (b.tLimit - PRI_BONUS[b.priority]) || PRI_RANK[a.priority] - PRI_RANK[b.priority]);
}

// ---------- 행동 ----------
export type Step =
  | { kind: "move"; job: string; to: string } // 떠맡기기
  | { kind: "preempt"; job: string } // 새치기
  | { kind: "evac"; job: string; to: string } // 임시 대피
  | { kind: "defer"; job: string } // 연기
  | { kind: "cool"; zone: string; delta: number }; // 냉각 변경

export const STEP_NAME: Record<Step["kind"], string> = { move: "떠맡기기", preempt: "새치기", evac: "임시 대피", defer: "연기", cool: "냉각 변경" };
export const stepRole = (st: Step): Role => (st.kind === "cool" ? "cooling_A" : "gpu_B");

export function describeStep(st: Step, s?: State): string {
  if (st.kind === "cool") {
    const z = s?.zones.find((x) => x.id === st.zone);
    return z ? `${st.zone} 냉각 레벨 ${z.level} → ${z.level + st.delta}` : `${st.zone} 냉각 ${st.delta > 0 ? "+" : ""}${st.delta}`;
  }
  const j = s?.jobs.find((x) => x.id === st.job);
  const tag = j ? `${st.job}(${j.priority} · ${j.gpus}장)` : st.job;
  if (st.kind === "move") return `${tag}을 ${st.to}로 떠맡기기`;
  if (st.kind === "evac") return `${tag}을 ${st.to}로 임시 대피 (식으면 복귀)`;
  if (st.kind === "preempt") return `${tag}을 ${j?.node ?? ""} 줄 맨 앞으로 새치기`;
  return `${tag} ${DEFER_MIN}분 연기`;
}

export interface StepError {
  error: string;
  policy?: string;
}
const moreUrgent = (a: JobCfg, b: JobCfg) => PRI_RANK[a.priority] < PRI_RANK[b.priority] || (a.priority === b.priority && a.deadline < b.deadline);

/** 행동 하나를 0분 시점에 적용한다. 규칙을 어기면 이유와 정책을 돌려준다 (Safety Gate 1차) */
export function applyStep(s0: State, st: Step): State | StepError {
  const s = cloneState(s0);
  if (st.kind === "cool") {
    const z = s.zones.find((x) => x.id === st.zone);
    if (!z) return { error: `${st.zone} 구역이 없습니다` };
    const to = z.level + st.delta;
    if (to > z.max) return { error: `${st.zone} 냉각 상한(${z.max})을 넘습니다`, policy: "COOL-MAX" };
    if (to < 1) return { error: "냉각 레벨은 1 아래로 내릴 수 없습니다" };
    z.level = to;
    return s;
  }
  const j = s.jobs.find((x) => x.id === st.job);
  if (!j) return { error: `${st.job} 일이 없습니다` };
  const before = nodeViews(s).find((v) => v.id === j.node)!;
  const wasRunning = before.running.some((x) => x.id === j.id);

  if (st.kind === "move" || st.kind === "evac") {
    if (j.priority === "P0") return { error: `${j.id}는 P0라 옮길 수 없습니다`, policy: "POL-01" };
    if (st.to === j.node) return { error: "같은 노드로는 옮길 수 없습니다" };
    if (!s.nodes.some((n) => n.id === st.to)) return { error: `${st.to} 노드가 없습니다` };
    const count = s.jobs.filter((x) => x.node === st.to).length;
    if (count >= MAX_JOBS_PER_NODE) return { error: `${st.to}에는 이미 일이 ${MAX_JOBS_PER_NODE}개라 더 세울 수 없습니다`, policy: "POL-03" };
    const home = j.node;
    j.node = st.to;
    j.seq = Math.max(...s.jobs.map((x) => x.seq)) + 1; // 빈자리 또는 줄 뒤에 세우기
    if (wasRunning) j.delay += RESTART_MIN;
    j.home = st.kind === "evac" ? home : null;
    return s;
  }
  if (st.kind === "preempt") {
    if (wasRunning) return { error: `${j.id}는 이미 실행 중입니다` };
    j.seq = Math.min(...s.jobs.filter((x) => x.node === j.node).map((x) => x.seq)) - 1;
    const after = nodeViews(s).find((v) => v.id === j.node)!;
    const stopped = before.running.filter((x) => !after.running.some((y) => y.id === x.id));
    for (const x of stopped) {
      const xs = s.jobs.find((y) => y.id === x.id)!;
      if (xs.priority === "P0") return { error: `P0인 ${xs.id}를 멈출 수 없습니다`, policy: "POL-01" };
      if (!moreUrgent(j, xs)) return { error: `${j.id}가 ${xs.id}보다 급하지 않아 멈출 수 없습니다`, policy: "POL-09" };
      xs.delay += RESTART_MIN; // 멈춘 일은 대기열 맨 앞(순서상 이미 앞)에서 재시작 지연을 안고 기다린다
    }
    return s;
  }
  // defer
  if (j.priority === "P0") return { error: `${j.id}는 P0라 멈출 수 없습니다`, policy: "POL-01" };
  if (j.deferUntil > 0) return { error: `${j.id}는 이미 연기되었습니다` };
  j.deferUntil = DEFER_MIN;
  if (wasRunning) j.delay += RESTART_MIN;
  return s;
}
const isErr = (x: State | StepError): x is StepError => (x as StepError).error !== undefined;

export function applySteps(s: State, steps: Step[]): State | StepError {
  let cur = s;
  for (const st of steps) {
    const r = applyStep(cur, st);
    if (isErr(r)) return r;
    cur = r;
  }
  return cur;
}

// ---------- 후보(계획) ----------
export interface Plan {
  id: string;
  strategy: string;
  steps: Step[];
  stepText: string[];
  roles: Role[];
  state: State;
  sim: SimResult;
  remaining: Incident[];
  solved: string[];
  peak: number;
  peakNode: string;
  energy: number;
  lateness: number; // 마감 초과 합(분)
  finishSum: number; // 일별 예상 완료 시각 합 — 옮기거나 멈추면 재시작 지연만큼 늘어난다
  pruned: number; // 정리 단계에서 뺀 불필요한 단계 수
}

interface Ctx {
  base: State;
  baseIds: Set<string>;
}

function nodeLoad(s: State, nodeId: string) {
  return nodeViews(s).find((v) => v.id === nodeId)!;
}

/** 옮길 노드 고르기: 지금 바로 실행 가능한 곳 중 옮긴 뒤 평형 온도가 가장 낮은 곳 */
function pickTarget(s: State, j: JobState, opts: { otherZone?: boolean; allowQueue?: boolean } = {}): string | null {
  const views = nodeViews(s);
  const cands = views
    .filter((v) => v.id !== j.node && s.jobs.filter((x) => x.node === v.id).length < MAX_JOBS_PER_NODE)
    .filter((v) => !opts.otherZone || v.zone !== zoneOfNode(j.node))
    .map((v) => {
      const n = s.nodes.find((x) => x.id === v.id)!;
      const queued = s.jobs.filter((x) => x.node === v.id && x.deferUntil <= 0).reduce((a, x) => a + x.gpus, 0);
      const fits = queued + j.gpus <= NODE_GPUS;
      return { id: v.id, fits, eq: eqTemp(Math.min(NODE_GPUS, v.usedGpus + (fits ? j.gpus : 0)), n.fan, zoneLevel(s, v.id)) + (n.fan ? 20 : 0) };
    })
    .filter((c) => c.fits || opts.allowQueue)
    .sort((a, b) => Number(b.fits) - Number(a.fits) || a.eq - b.eq);
  return cands[0]?.id ?? null;
}
function movableOn(s: State, nodeId: string, order: "lowFirst" | "bigFirst"): JobState[] {
  const v = nodeLoad(s, nodeId);
  return v.running
    .filter((j) => j.priority !== "P0")
    .sort((a, b) => (order === "lowFirst" ? PRI_RANK[b.priority] - PRI_RANK[a.priority] || b.gpus - a.gpus : b.gpus - a.gpus || PRI_RANK[b.priority] - PRI_RANK[a.priority]));
}

type Strategy = { key: string; name: string; next: (s: State, p: Incident, ctx: Ctx, i: number) => Step | null };

function spreadStep(s: State, p: Incident, otherZone = false): Step | null {
  if (p.kind === "heat") {
    for (const j of movableOn(s, p.node, "lowFirst")) {
      const to = pickTarget(s, j, { otherZone });
      if (to) return { kind: "move", job: j.id, to };
    }
    return null;
  }
  const j = s.jobs.find((x) => x.id === p.target)!;
  if (j.priority === "P0") return null;
  const to = pickTarget(s, j, { otherZone });
  return to ? { kind: "move", job: j.id, to } : null;
}
function preemptStep(s: State, p: Incident): Step | null {
  if (p.kind !== "deadline") return null;
  const v = nodeLoad(s, p.node);
  return v.waiting.some((x) => x.id === p.target) ? { kind: "preempt", job: p.target } : null;
}
function coolStep(s: State, p: Incident, delta = 1): Step | null {
  if (p.kind !== "heat") return null;
  const z = s.zones.find((x) => x.id === zoneOfNode(p.node))!;
  const d = Math.min(delta, z.max - z.level);
  return d > 0 ? { kind: "cool", zone: z.id, delta: d } : null;
}
function deferStep(s: State, p: Incident): Step | null {
  const v = nodeLoad(s, p.node);
  if (p.kind === "heat") {
    const j = v.running.filter((x) => x.priority === "P2").sort((a, b) => b.gpus - a.gpus)[0];
    return j ? { kind: "defer", job: j.id } : null;
  }
  // 마감 위험인 일 앞에서 자리를 차지한 낮은 우선순위 일을 미룬다
  const j = v.running.filter((x) => x.priority === "P2" && x.id !== p.target).sort((a, b) => b.gpus - a.gpus)[0];
  return j ? { kind: "defer", job: j.id } : null;
}

const STRATEGIES: Strategy[] = [
  { key: "spread", name: "열 분산", next: (s, p) => spreadStep(s, p) ?? preemptStep(s, p) },
  { key: "deadline", name: "마감 우선 (새치기)", next: (s, p) => preemptStep(s, p) ?? spreadStep(s, p) },
  {
    key: "evac", name: "임시 대피",
    next: (s, p) => {
      if (p.kind === "heat") {
        for (const j of movableOn(s, p.node, "bigFirst")) {
          const to = pickTarget(s, j);
          if (to) return { kind: "evac", job: j.id, to };
        }
        return null;
      }
      return preemptStep(s, p) ?? spreadStep(s, p);
    },
  },
  { key: "cool", name: "냉각 우선", next: (s, p) => coolStep(s, p) ?? preemptStep(s, p) ?? spreadStep(s, p) },
  { key: "cool2", name: "냉각 우선 (강)", next: (s, p) => coolStep(s, p, 2) ?? preemptStep(s, p) ?? spreadStep(s, p) },
  { key: "zone", name: "구역 몰기", next: (s, p) => spreadStep(s, p, true) ?? preemptStep(s, p) },
  { key: "defer", name: "저우선 연기", next: (s, p) => deferStep(s, p) ?? preemptStep(s, p) ?? spreadStep(s, p) },
  { key: "energy", name: "에너지 최소", next: (s, p) => deferStep(s, p) ?? preemptStep(s, p) ?? spreadStep(s, p) ?? coolStep(s, p) },
  { key: "mix", name: "혼합안 (냉각 + 분산)", next: (s, p, _c, i) => (i === 0 ? coolStep(s, p) : null) ?? spreadStep(s, p) ?? preemptStep(s, p) },
  { key: "minimal", name: "조작 최소", next: (s, _p, ctx) => bestSingleStep(s, ctx) },
];
export const STRATEGY_COUNT = STRATEGIES.length;

/** 조작 최소: 가능한 행동을 모두 한 번씩 적용해 보고 남는 문제가 가장 적은 것 */
function bestSingleStep(s: State, ctx: Ctx): Step | null {
  const opts: Step[] = [];
  for (const j of s.jobs) {
    if (j.priority !== "P0") for (const n of s.nodes) if (n.id !== j.node) opts.push({ kind: "move", job: j.id, to: n.id });
    opts.push({ kind: "preempt", job: j.id }, { kind: "defer", job: j.id });
  }
  for (const z of s.zones) opts.push({ kind: "cool", zone: z.id, delta: 1 });
  let best: { st: Step; score: number } | null = null;
  const cur = incidents(s).length;
  for (const st of opts) {
    const r = applyStep(s, st);
    if (isErr(r)) continue;
    const inc = incidents(r);
    if (inc.some((x) => !ctx.baseIds.has(x.id))) continue; // 새 문제를 만드는 행동은 제외
    const score = inc.length * 100 + inc.reduce((a, x) => a + Math.max(0, 30 - x.tLimit), 0) + (st.kind === "cool" ? 0.5 : 0);
    if (inc.length < cur && (!best || score < best.score)) best = { st, score };
  }
  return best?.st ?? null;
}

function buildPlan(id: string, strategy: string, base: State, steps: Step[], baseIds: Set<string>): Plan | StepError {
  const st = applySteps(base, steps);
  if (isErr(st)) return st;
  const sim = simulate(st);
  const remaining = incidents(st, sim);
  const peakNode = Object.entries(sim.peak).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  // 설명 문구는 행동을 적용하기 직전 상태 기준으로 만든다 (냉각 레벨 3 → 4처럼)
  const stepText: string[] = [];
  let cur = base;
  for (const x of steps) {
    stepText.push(describeStep(x, cur));
    cur = applyStep(cur, x) as State;
  }
  return {
    id, strategy, steps, stepText,
    roles: [...new Set(steps.map(stepRole))].sort() as Role[],
    state: st, sim, remaining,
    solved: [...baseIds].filter((x) => !remaining.some((r) => r.id === x)),
    peak: sim.peak[peakNode] ?? 0, peakNode,
    energy: sim.energy,
    lateness: round1(st.jobs.reduce((a, j) => a + Math.max(0, sim.finish[j.id] - j.deadline), 0)),
    finishSum: round1(st.jobs.reduce((a, j) => a + sim.finish[j.id], 0)),
    pruned: 0,
  };
}

export interface Rejected {
  strategy: string;
  reason: string;
  policy?: string;
}
export interface Analysis {
  incidents: Incident[];
  sim: SimResult;
  stats: { strategies: number; built: number; merged: number; pareto: number; safe: number; sent: number };
  candidates: Plan[];
  rejected: Rejected[];
  pickId: string | null;
  rationale: string;
  // ---- 서버(live) 판단에서만 채워진다
  provider?: "zoro1" | "rule" | "mock";
  fallbackReason?: string | null;
  probs?: Record<string, number> | null; // 후보별 확률 (Zoro-1 에 준 후보만)
  offered?: string[]; // Zoro-1 에 선택지로 준 후보 id
  agreement?: string | null; // 후보 순서를 바꿔 물었을 때 최종 선택이 1위였던 횟수 "3/4"
  needsReview?: boolean;
  latencyMs?: number;
}

/** 한 회차의 판단: 사건 계산 → 전략별 연쇄 계획 → 정리 · 합치기 · 열위 제거 → Safety Gate → 최대 24개 → 선택 */
export function analyze(base: State): Analysis {
  const sim = simulate(base);
  const inc = incidents(base, sim);
  const baseIds = new Set(inc.map((x) => x.id));
  const ctx: Ctx = { base, baseIds };
  const rejected: Rejected[] = [];
  const empty = { incidents: inc, sim, stats: { strategies: STRATEGIES.length, built: 0, merged: 0, pareto: 0, safe: 0, sent: 0 }, candidates: [], rejected, pickId: null };
  if (!inc.length) return { ...empty, rationale: "조치가 필요한 사건이 없습니다." };

  // 1) 전략마다 "가장 급한 문제 → 행동 1개 → 시뮬레이션"을 문제가 없어질 때까지 반복
  const raw: { strategy: string; steps: Step[] }[] = [];
  for (const strat of STRATEGIES) {
    let s = base;
    const steps: Step[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const probs = incidents(s);
      if (!probs.length) break;
      let step: Step | null = null;
      for (const p of probs) {
        step = strat.next(s, p, ctx, i);
        if (step && !seen.has(JSON.stringify(step))) break;
        step = null;
      }
      if (!step) break;
      const r = applyStep(s, step);
      seen.add(JSON.stringify(step));
      if (isErr(r)) {
        rejected.push({ strategy: strat.name, reason: r.error, policy: r.policy });
        break;
      }
      steps.push(step);
      s = r;
    }
    if (steps.length) raw.push({ strategy: strat.name, steps });
    else rejected.push({ strategy: strat.name, reason: "적용할 수 있는 행동이 없음" });
  }

  // 2) 불필요한 단계 제거
  let plans: Plan[] = [];
  raw.forEach((r, i) => {
    let steps = r.steps;
    const first = buildPlan(`P${i + 1}`, r.strategy, base, steps, baseIds);
    if ("error" in first) return;
    let plan: Plan = first;
    for (let k = steps.length - 1; k >= 0 && steps.length > 1; k--) {
      const trial = steps.filter((_, idx) => idx !== k);
      const tp = buildPlan(plan.id, r.strategy, base, trial, baseIds);
      if ("error" in tp) continue;
      const cur = plan;
      const subset = tp.remaining.every((x) => cur.remaining.some((y) => y.id === x.id));
      if (subset && tp.peak <= cur.peak + 0.5 && tp.lateness <= cur.lateness + 0.05) {
        steps = trial;
        plan = tp;
      }
    }
    // 정리 뒤 냉각 단계가 모두 빠진 혼합안은 실제 내용대로 부른다
    const strategy = r.strategy.startsWith("혼합안") && !steps.some((x) => x.kind === "cool") ? "열 분산 (혼합안 정리)" : r.strategy;
    plans.push({ ...plan, strategy, pruned: r.steps.length - steps.length });
  });
  const built = plans.length;

  // 3) 결과가 같은 계획 합치기 (단계가 적은 쪽을 남김)
  const key = (p: Plan) =>
    JSON.stringify([p.remaining.map((x) => x.id).sort(), Math.round(p.peak), p.energy, Object.values(p.sim.finish).map((x) => Math.round(x * 2) / 2)]);
  const byKey = new Map<string, Plan>();
  for (const p of plans) {
    const k = key(p);
    const prev = byKey.get(k);
    if (!prev || p.steps.length < prev.steps.length) byKey.set(k, prev && p.steps.length === prev.steps.length ? prev : p);
  }
  plans = [...byKey.values()];
  const merged = plans.length;

  // 4) Safety Gate: 새 문제를 만들거나(멈춘 일이 마감을 놓치는 경우 포함) 아무 문제도 풀지 못하는 계획은 제외
  plans = plans.filter((p) => {
    const created = p.remaining.filter((x) => !baseIds.has(x.id));
    if (created.length) {
      rejected.push({ strategy: p.strategy, reason: `새 문제 발생: ${created.map((x) => x.title).join(", ")}`, policy: created.some((x) => x.kind === "deadline") ? "POL-09" : "POL-02" });
      return false;
    }
    if (!p.solved.length) {
      rejected.push({ strategy: p.strategy, reason: "풀리는 문제가 없음" });
      return false;
    }
    return true;
  });
  const safe = plans.length;

  // 5) 모든 면에서 뒤지는 계획 제거 (남는 문제 · 마감 초과 · 최고 온도 · 냉각 에너지 · 작업 완료 시각 · 단계 수)
  const obj = (p: Plan) => [p.remaining.length, p.lateness, p.peak, p.energy, p.finishSum, p.steps.length];
  plans = plans.filter((p) => !plans.some((q) => q !== p && obj(q).every((v, i) => v <= obj(p)[i]) && obj(q).some((v, i) => v < obj(p)[i])));
  const pareto = plans.length;

  plans.sort((a, b) => a.remaining.length - b.remaining.length || a.lateness - b.lateness || a.steps.length - b.steps.length || a.energy - b.energy || a.peak - b.peak);
  const candidates = plans.slice(0, MAX_CANDIDATES).map((p, i) => ({ ...p, id: `C${i + 1}` }));
  const pick = candidates[0] ?? null;
  return {
    incidents: inc, sim,
    stats: { strategies: STRATEGIES.length, built, merged, pareto, safe, sent: candidates.length },
    candidates, rejected,
    pickId: pick?.id ?? null,
    rationale: pick
      ? `${pick.solved.length}개 문제를 풀고${pick.remaining.length ? ` ${pick.remaining.length}개가 남지만` : " 남는 문제가 없으며"}, 조작 ${pick.steps.length}단계 · 최고 ${pick.peak}°C · 냉각 에너지 ${pick.energy}kWh로 검증된 후보 중 가장 부담이 적습니다. (예시 판단)`
      : "Safety Gate를 통과한 후보가 없어 사람에게 넘깁니다.",
  };
}

/** 회차를 멈출지: 남은 문제 없음 / 안전한 후보 없음 / 직전 회차와 남은 문제가 같음 / 최대 회차 */
export function stopReason(prevRemaining: string[] | null, next: Analysis, round: number, maxRounds: number): string | null {
  if (!next.incidents.length) return "done";
  if (!next.candidates.length) return "no_safe";
  if (prevRemaining && JSON.stringify([...prevRemaining].sort()) === JSON.stringify(next.incidents.map((x) => x.id).sort())) return "same";
  if (round > maxRounds) return "max";
  return null;
}
