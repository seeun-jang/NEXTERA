import type {
  Approval, ApprovalDecisionRequest, CompareResponse, DecideRequest, DecideResponse, Execution,
  ExecuteRequest, Experiment, ExperimentRequest, FuturesRequest, FuturesResponse, HealthResponse,
  Incident, PoliciesResponse, Receipt, Snapshot, Validation, ValidateRequest,
} from "@contracts/types";

/**
 * 기록·분석(13) 응답. §5에서 "집계 객체"로만 정해져 있어 프론트 임시 정의다.
 * P1 착수 전에 대환과 확정하고 shared/contracts로 옮긴다.
 */
export interface AnalyticsResponse {
  is_example: boolean; // true면 "예시 데이터 · 측정값 아님" 칩
  total_decisions: number;
  blocked_attempts: number;
  escalation_rate_pct: number;
  deadline_met: { met: number; total: number };
  consistency: { same: number; total: number };
  results: { succeeded: number; held: number; failed: number };
  recent: { decision_id: string; incident_id: string; action_label: string; status: Receipt["status"]; deadline_met: boolean | null }[];
  /** 사건 유형별 결정 건수와 그중 마감 미준수 */
  by_type: { type: string; decisions: number; missed: number }[];
  /** 실패 패턴 → 대표 기록 → 개선 조치 */
  patterns: { pattern: string; count: number; decision_id: string; action: string }[];
}

/** §5 API 계약의 프론트 쪽 시그니처. mock과 live가 똑같이 구현한다. */
export interface NexteraApi {
  health(): Promise<HealthResponse>;
  resetDemo(): Promise<{ snapshot_id: string }>;
  getState(snapshotId?: string): Promise<Snapshot>;
  getIncident(id: string): Promise<Incident>;
  getPolicies(version?: string): Promise<PoliciesResponse>;
  decide(req: DecideRequest): Promise<DecideResponse>;
  createExperiment(req: ExperimentRequest): Promise<Experiment>;
  compareExperiment(branchId: string): Promise<CompareResponse>;
  futures(req: FuturesRequest): Promise<FuturesResponse>;
  validate(req: ValidateRequest): Promise<Validation>;
  getApproval(id: string): Promise<Approval>;
  commentApproval(id: string, text: string): Promise<Approval>;
  decideApproval(id: string, req: ApprovalDecisionRequest): Promise<Approval>;
  execute(req: ExecuteRequest): Promise<Execution>;
  getReceipt(decisionId: string): Promise<Receipt>;
  listReceipts(): Promise<Receipt[]>;
  getAnalytics(params?: Record<string, string>): Promise<AnalyticsResponse>;
}
