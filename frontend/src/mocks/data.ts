// mock 전용 예시 값. 스토리보드 화면의 예시 수치는 "이 폴더 안에서만" 쓴다(§2-4).
// 응답은 항상 provider: "mock"이라 화면에는 MOCK 칩이 붙는다. live에서는 서버 시뮬레이터 값으로 바뀐다.
import type { Candidate, Estimate, ExperimentChanges, Snapshot } from "@contracts/types";

export const HORIZON_TICKS = 10; // 5분

/** 상황 설정(01) 값. 계약서의 ExperimentChanges에 데모 전용 N4 현재 온도를 더한 것 — mock 안에서만 쓴다. */
export type SimChanges = ExperimentChanges & { n4_temp_c?: number };
export const BASE_N4_TEMP = 81;
export const THERMAL_LIMIT = 88;
export const BASE_APPROVAL_DELAY_MIN = 0.5; // 승인 지연 추정(가정)

type Pt = [number, number]; // [t_min, temp_c]

/** 꺾은선 기준점을 30초 간격 점으로 펼친다 */
function series(points: Pt[], horizonMin = 5): { t_min: number; temp_c: number }[] {
  const out: { t_min: number; temp_c: number }[] = [];
  for (let t = 0; t <= horizonMin + 1e-9; t += 0.5) {
    let i = 0;
    while (i < points.length - 2 && t > points[i + 1][0]) i++;
    const [t0, v0] = points[i];
    const [t1, v1] = points[i + 1];
    const f = t1 === t0 ? 0 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    out.push({ t_min: Math.round(t * 10) / 10, temp_c: Math.round((v0 + (v1 - v0) * f) * 10) / 10 });
  }
  return out;
}

interface Profile {
  n4: Pt[];
  n2?: Pt[];
  j07Finish: number; // 승인 지연 0.5분 포함
  coolingDeltaPct: number;
  throttleMin: number;
  risk: Estimate["risk"];
  riskNote: string;
  extraJobFinish?: Record<string, number>;
  violations: string[];
}

const NO_ACTION: Profile = {
  n4: [[0, 81], [1.5, 85], [3, 88], [5, 92]],
  j07Finish: 3.2,
  coolingDeltaPct: 0,
  throttleMin: 3.5,
  risk: "high",
  riskNote: "약 3분 뒤 안전 한계 88°C 도달",
  violations: ["POL-02"],
};

const PROFILES: Record<string, Profile> = {
  "A-COOL-Z2-UP": {
    n4: [[0, 81], [1, 83], [2, 84], [3, 83.5], [5, 82]],
    j07Finish: 2.5, coolingDeltaPct: 18, throttleMin: 0,
    risk: "medium", riskNote: "팬 이상 노드 고부하 유지", violations: [],
  },
  "A-MIG-J07-N2": {
    n4: [[0, 81], [0.5, 82], [1.5, 76], [3, 72], [5, 70]],
    n2: [[0, 46], [1.5, 52], [3, 63], [5, 65]],
    j07Finish: 3.5, coolingDeltaPct: 0, throttleMin: 0,
    risk: "low", riskNote: "N4 정비 가능", violations: [],
  },
  "A-DEF-J08-30": {
    n4: [[0, 81], [1.5, 84.5], [2.5, 86], [3.5, 85], [5, 84]],
    j07Finish: 2.8, coolingDeltaPct: -6, throttleMin: 0.8,
    risk: "medium", riskNote: "한계까지 2°C", extraJobFinish: { J08: 25 }, violations: [],
  },
  "A-INFO": NO_ACTION,
  "A-ESC": NO_ACTION,
};

const BASE_COOLING_KWH = 0.42; // Z2 냉각 5분 (mock 예시)
const IT_KWH = 2.1; // 25.2 kW × 5분

export function estimateFor(actionId: string | null, changes: SimChanges = {}, deadlineMin = 5): Estimate {
  const base = (actionId && PROFILES[actionId]) || NO_ACTION;
  // N4 현재 온도를 바꾸면 N4 예측 곡선 전체를 같은 만큼 올리거나 내린다 (단순 가정).
  const off = (changes.n4_temp_c ?? BASE_N4_TEMP) - BASE_N4_TEMP;
  const p: Profile = off ? { ...base, n4: base.n4.map(([t, v]) => [t, v + off] as Pt) } : base;
  const needsApproval = actionId === "A-COOL-Z2-UP" || actionId === "A-MIG-J07-N2" || actionId === "A-DEF-J08-30";
  const delay = changes.approval_delay_min ?? BASE_APPROVAL_DELAY_MIN;
  const finish = Math.round((p.j07Finish + (needsApproval ? delay - BASE_APPROVAL_DELAY_MIN : 0)) * 10) / 10;
  const horizon = deadlineMin > 5 ? Math.ceil(deadlineMin) : 5;
  const temp_series = [{ node_id: "N4", points: series(p.n4, horizon) }];
  if (p.n2) temp_series.push({ node_id: "N2", points: series(p.n2, horizon) });
  const peak: Record<string, number> = {};
  for (const s of temp_series) peak[s.node_id] = Math.max(...s.points.map((x) => x.temp_c));
  const cooling = Math.round(BASE_COOLING_KWH * (1 + p.coolingDeltaPct / 100) * 100) / 100;
  return {
    action_id: actionId,
    horizon_ticks: horizon * 2,
    peak_temp_c: peak,
    temp_series,
    cooling_kwh: cooling,
    cooling_kwh_delta_pct: p.coolingDeltaPct,
    total_kwh: Math.round((IT_KWH + cooling) * 100) / 100,
    job_finish_min: { J07: finish, ...(p.extraJobFinish ?? {}) },
    deadline_slack_min: { J07: Math.round((deadlineMin - finish) * 10) / 10 },
    throttle_min: p.throttleMin,
    completed_work: actionId === "A-DEF-J08-30" ? 32 : 40, // GPU·분, mock 예시
    remaining_work: actionId === "A-DEF-J08-30" ? 18 : 10,
    risk: riskOf(p, peak.N4),
    risk_note:
      base === NO_ACTION
        ? noActionNote(temp_series[0].points)
        : peak.N4 > THERMAL_LIMIT
          ? `N4 예측 최고 ${peak.N4}°C · 안전 한계 초과`
          : p.riskNote,
    violations: [...p.violations, ...(finish > deadlineMin ? ["DEADLINE_MISS"] : [])],
    source: "sim_estimate",
  };
}

function riskOf(p: Profile, n4Peak: number): Estimate["risk"] {
  if (n4Peak > THERMAL_LIMIT) return "high";
  return p.risk;
}

function noActionNote(points: { t_min: number; temp_c: number }[]): string {
  const hit = points.find((x) => x.temp_c >= THERMAL_LIMIT);
  return hit ? `약 ${hit.t_min}분 뒤 안전 한계 ${THERMAL_LIMIT}°C 도달` : `5분 안에는 안전 한계 ${THERMAL_LIMIT}°C 아래`;
}

/** 스냅샷에서 후보 7개를 만들고 필수 정책(hard)으로 걸러낸다. 백엔드 core/candidates.py + policy.py의 mock 판. */
export function buildCandidates(snap: Snapshot, changes: ExperimentChanges = {}): Candidate[] {
  const node = (id: string) => snap.nodes.find((n) => n.id === id)!;
  const j07 = snap.jobs.find((j) => j.id === "J07")!;
  const j07Priority = changes.j07_priority ?? j07.priority;
  const z2 = snap.zones.find((z) => z.id === "Z2")!;
  const coolingMax = changes.cooling_max ?? z2.cooling_max;
  const n2Free = changes.n2_gpus_free ?? node("N2").gpus_free;

  const migrate = (id: string, to: string, free: number): Candidate => {
    let reason: string | null = null;
    if (j07Priority === "P0") reason = "POL-01";
    else if (free < j07.gpus) reason = "POL-03";
    return {
      id, type: "job_migrate", label: `J07을 ${to}로 이동`, params: { job: "J07", to, gpus: j07.gpus },
      requires_approval_role: "gpu_B", filtered_out: reason !== null, filter_reason: reason, origin: "generated",
    };
  };

  const list: Candidate[] = [];
  if (z2.cooling_level < coolingMax) {
    list.push({
      id: "A-COOL-Z2-UP", type: "cooling_change", label: `Z2 냉각 강화 (레벨 ${z2.cooling_level} → ${z2.cooling_level + 1})`,
      params: { zone: "Z2", from: z2.cooling_level, to: z2.cooling_level + 1 },
      requires_approval_role: "cooling_A", filtered_out: false, filter_reason: null, origin: "generated",
    });
  }
  list.push(migrate("A-MIG-J07-N2", "N2", n2Free));
  list.push({
    id: "A-DEF-J08-30", type: "job_defer", label: "J08(P2) 30분 연기", params: { job: "J08", minutes: 30 },
    requires_approval_role: "gpu_B", filtered_out: false, filter_reason: null, origin: "generated",
  });
  list.push({
    id: "A-INFO", type: "request_info", label: "추가 정보 요청", params: {},
    requires_approval_role: null, filtered_out: false, filter_reason: null, origin: "generated",
  });
  list.push({
    id: "A-ESC", type: "escalate", label: "운영자 호출 (이관)", params: {},
    requires_approval_role: null, filtered_out: false, filter_reason: null, origin: "generated",
  });
  list.push(migrate("A-MIG-J07-N3", "N3", node("N3").gpus_free));
  list.push({
    id: "A-DEF-J09", type: "job_defer", label: "J09(P0) 연기", params: { job: "J09" },
    requires_approval_role: null, filtered_out: true, filter_reason: "POL-01", origin: "generated",
  });
  return list;
}

/** mock 판단: 마감 안에 끝나는 행동 중 정책 v1.2 목표 순서(마감 → 에너지)로 고른다. 규칙 기준선과 같은 논리. */
export function mockChoose(cands: Candidate[], changes: SimChanges, deadlineMin: number): { id: string; rationale: string } {
  const ok = cands.filter((c) => !c.filtered_out);
  const has = (id: string) => ok.some((c) => c.id === id);
  const est = (id: string) => estimateFor(id, changes, deadlineMin);
  const finish = (id: string) => est(id).job_finish_min.J07;
  const hot = (id: string) => Math.max(...Object.values(est(id).peak_temp_c)) > THERMAL_LIMIT;
  const fits = (id: string) => has(id) && finish(id) <= deadlineMin && !hot(id);
  const label = (id: string) => cands.find((c) => c.id === id)?.label ?? id;
  /** 앞 순위 후보를 왜 못 골랐는지 한 줄로 */
  const whyNot = (id: string): string | null => {
    const c = cands.find((x) => x.id === id);
    if (!c) return id === "A-COOL-Z2-UP" ? "냉각 강화(이미 상한)" : `${id}(후보 없음)`;
    if (c.filtered_out) return `${label(id)}(${c.filter_reason} 차단)`;
    if (finish(id) > deadlineMin) return `${label(id)}(마감 ${deadlineMin}분 초과)`;
    if (hot(id)) return `${label(id)}(N4 ${THERMAL_LIMIT}°C 초과 예측)`;
    return null;
  };

  const RATIONALE: Record<string, string> = {
    "A-MIG-J07-N2": "운영자 메모의 N4 부하 자제 요청과 N2의 여유 GPU 8장을 근거로 이동을 선택했습니다.",
    "A-COOL-Z2-UP": "이동하면 재시작 1분 때문에 마감을 넘기므로, 마감 안에 끝나는 냉각 강화를 선택했습니다. N4 팬 이상은 주의로 남깁니다.",
    "A-DEF-J08-30": "J07을 그대로 두고 같은 구역의 P2 작업 J08을 연기해 발열과 냉각 에너지를 줄입니다.",
  };
  // 목표가 에너지 우선이면 냉각 강화를 맨 뒤로 보낸다.
  const order =
    changes.objective === "energy"
      ? ["A-DEF-J08-30", "A-MIG-J07-N2", "A-COOL-Z2-UP"]
      : ["A-MIG-J07-N2", "A-COOL-Z2-UP", "A-DEF-J08-30"];
  const pick = order.find(fits);
  const before = (pick ? order.slice(0, order.indexOf(pick)) : order).map(whyNot).filter(Boolean);
  const lead = before.length ? `쓸 수 없는 행동: ${before.join(", ")}. ` : "";
  if (pick) {
    const base =
      pick === "A-COOL-Z2-UP" && before.length
        ? "마감 안에 끝나는 냉각 강화를 선택했습니다. N4 팬 이상은 주의로 남깁니다."
        : RATIONALE[pick];
    return { id: pick, rationale: `${lead}${base}` };
  }
  return { id: "A-ESC", rationale: `${lead}마감과 열 한계를 함께 지키는 허용 후보가 없어 운영자에게 이관합니다.` };
}
