// 저장소(지난 시연 기록) — GET /api/v2/archive, /api/v2/archive/{id}. 백엔드 FRONT_ARCHIVE_NOTE.md 모양 그대로.
// 결정 영수증의 "누적 기록"은 최근 10건만 보이고, 빠진 기록은 지워지지 않고 여기 남는다(접속자별 최대 200건).
import { ApiClientError } from "./errors";
import { getClientRole } from "./role";
import { sessionId } from "./session";

const BASE = (import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? "http://localhost:8000" : "")).replace(/\/$/, "");

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v2${path}`, { headers: { "X-Role": getClientRole(), "X-Session": sessionId() } });
  } catch {
    throw new ApiClientError(0, { code: "NETWORK", message: `서버에 연결할 수 없습니다 (${BASE || "같은 서버"})` });
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiClientError(res.status, json?.error ?? { code: "INTERNAL", message: `HTTP ${res.status}` });
  return json as T;
}

export type ArchiveStatus = "open" | "resolved" | "handoff" | "stalled" | "max_rounds";
export type ArchiveResult = "성공" | "실패" | "진행 중";

export interface ArchiveItem {
  archive_id: string;
  run_id: number;
  session: string;
  started_at: number;
  last_at: number;
  name: string | null;
  summary: string;
  status: ArchiveStatus;
  result: ArchiveResult;
  round_count: number;
  executed_rounds: number;
  problem_ids: string[];
  kinds: ("overheat" | "deadline")[];
  providers: ("zoro1" | "rule" | "mock")[];
  first_selection: string | null;
  in_receipt_window: boolean;
}
export interface ArchiveList {
  scope: "mine" | "all";
  total: number;
  offset: number;
  limit: number;
  receipt_window: number;
  items: ArchiveItem[];
}
export interface ArchiveRound {
  round: number;
  status: "decided" | "handoff" | "no_problem";
  provider: "zoro1" | "rule" | "mock";
  created_at?: number;
  problems: { id: string; kind: "overheat" | "deadline"; severity: string; priority: string; text: string }[];
  candidates: number;
  sent: number;
  selected_id: string | null;
  strategy?: string | null;
  steps: string[];
  selected_label?: string | null;
  required_roles?: string[];
  approved_by?: string[];
  probs?: Record<string, number> | null;
  agreement?: string | null;
  needs_review?: boolean;
  is_fallback?: boolean;
  latency_ms?: number | null;
  rationale?: string | null;
  escalate?: string[];
  executed: boolean;
  deadline_met?: boolean | null;
  resolved: string[];
  remaining: string[];
  next: "next_round" | "resolved" | "stalled" | "max_rounds" | null;
}
export interface ArchiveScenario {
  name: string | null;
  objective?: string;
  nodes: { id: string; temp_c: number; fan?: boolean }[];
  zones: { id: string; cooling_level: number; cooling_max: number }[];
  jobs: { id: string; gpus: number; priority: "P0" | "P1" | "P2"; deadline_min: number | null; remaining_min: number; node: string }[];
}
export interface ArchiveEvent {
  round: number;
  ts: number;
  actor: string;
  type: string;
  summary: string;
}
export interface ArchiveDetail extends ArchiveItem {
  scenario: ArchiveScenario;
  rounds: ArchiveRound[];
  events: ArchiveEvent[];
}

export interface ArchiveQuery {
  scope?: "mine" | "all";
  kind?: "overheat" | "deadline";
  result?: ArchiveResult;
  q?: string;
  limit?: number;
  offset?: number;
}

export const archiveApi = {
  list: (q: ArchiveQuery = {}) => {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
    return get<ArchiveList>(`/archive${p.toString() ? `?${p}` : ""}`);
  },
  detail: (id: string) => get<ArchiveDetail>(`/archive/${encodeURIComponent(id)}`),
};

// ---------- 화면 문구 ----------
export const STATUS_TEXT: Record<ArchiveStatus, string> = {
  open: "진행 중",
  resolved: "모두 해결",
  handoff: "사람에게 넘김 (안전한 계획 없음)",
  stalled: "사람에게 넘김 (진전 없음)",
  max_rounds: "최대 회차 도달",
};
export const NEXT_TEXT: Record<NonNullable<ArchiveRound["next"]>, string> = {
  next_round: "다음 회차로",
  resolved: "모두 해결",
  stalled: "진전 없어 사람에게 넘김",
  max_rounds: "최대 회차 → 사람에게 넘김",
};
export const PROVIDER_TEXT: Record<string, string> = { zoro1: "Zoro-1", rule: "규칙", mock: "MOCK" };
export const KIND_TEXT: Record<string, string> = { overheat: "과열", deadline: "마감" };
export const ROLE_TEXT: Record<string, string> = { cooling_A: "A · 냉각", gpu_B: "B · GPU", operator: "관제 운영자" };
export const ACTOR_TEXT: Record<string, string> = {
  operator: "관제 운영자", system: "시스템", zoro1: "Zoro-1", rule: "규칙", mock: "MOCK",
  safety_gate: "안전 검사", executor: "시뮬레이터", cooling_A: "A · 냉각", gpu_B: "B · GPU",
};
export const fmtTime = (ts: number) => {
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
