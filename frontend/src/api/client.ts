// 모든 API 호출이 지나가는 유일한 지점. 화면은 fetch를 직접 쓰지 않는다.
// VITE_API_MODE=mock → src/mocks, live → 백엔드(VITE_API_BASE). 통합 = 이 값 하나를 바꾸는 일.
import type { ApiError } from "@contracts/types";
import { mockApi } from "@/mocks";
import { ApiClientError } from "./errors";
import { getClientRole } from "./role";
import type { NexteraApi } from "./types";
import { sessionId } from "./v2";

export { ApiClientError } from "./errors";
export type { NexteraApi, AnalyticsResponse } from "./types";

// 값을 주지 않으면 개발 서버(npm run dev)는 mock, 빌드본(npm run build)은 live 로 동작한다.
const MODE_ENV = import.meta.env.VITE_API_MODE;
export const API_MODE: "mock" | "live" = MODE_ENV ? (MODE_ENV === "live" ? "live" : "mock") : import.meta.env.PROD ? "live" : "mock";
// 개발 서버에서는 localhost:8000, 빌드본은 같은 서버(상대 경로 /api)를 기본으로 부른다(백엔드가 dist 를 직접 서빙).
export const API_BASE = (import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? "http://localhost:8000" : "")).replace(/\/$/, "");
const BASE = API_BASE;

async function http<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "X-Role": getClientRole(), "X-Session": sessionId() }, // /api/v2 와 같은 세션
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError(0, { code: "NETWORK", message: `서버에 연결할 수 없습니다 (${BASE})` });
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = (json as ApiError | null)?.error ?? { code: "INTERNAL", message: `HTTP ${res.status}` };
    throw new ApiClientError(res.status, err);
  }
  return json as T;
}

const q = (params?: Record<string, string>) =>
  params && Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : "";
const enc = encodeURIComponent;

const liveApi: NexteraApi = {
  health: () => http("GET", "/api/health"),
  resetDemo: (scenario) => http("POST", "/api/demo/reset", scenario && Object.keys(scenario).length ? { scenario } : undefined),
  getState: (snapshotId = "S0") => http("GET", `/api/state${q({ snapshot: snapshotId })}`),
  getIncident: (id) => http("GET", `/api/incidents/${enc(id)}`),
  getPolicies: (version = "1.2") => http("GET", `/api/policies${q({ version })}`),
  decide: (req) => http("POST", "/api/decide", req),
  createExperiment: (req) => http("POST", "/api/experiments", req),
  compareExperiment: (branchId) => http("GET", `/api/experiments/${enc(branchId)}/compare`),
  futures: (req) => http("POST", "/api/futures", req),
  validate: (req) => http("POST", "/api/validate", req),
  getApproval: (id) => http("GET", `/api/approvals/${enc(id)}`),
  commentApproval: (id, text) => http("POST", `/api/approvals/${enc(id)}/comments`, { text }),
  decideApproval: (id, req) => http("POST", `/api/approvals/${enc(id)}/decision`, req),
  execute: (req) => http("POST", "/api/execute", req),
  getReceipt: (decisionId) => http("GET", `/api/receipts/${enc(decisionId)}`),
  listReceipts: () => http("GET", "/api/receipts"),
  getAnalytics: (params) => http("GET", `/api/analytics${q(params)}`),
};

export const api: NexteraApi = API_MODE === "live" ? liveApi : mockApi;

/** 승인·실행 요청의 중복 방지 키 */
export function newIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
