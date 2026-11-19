import type { Candidate, Policy } from "@contracts/types";

export const POLICY_TYPE_LABEL: Record<Policy["type"], string> = {
  hard: "필수 제약",
  approval: "승인 요건",
  objective: "최적화 목표",
};

/** 설비를 건드리지 않고 사람에게 판단을 넘기는 행동인가 (추가 정보 요청 · 운영자 호출) */
export function isHandoff(c?: Candidate | null): boolean {
  return !!c && (c.type === "request_info" || c.type === "escalate");
}

/** 후보의 승인 요건 문구 */
export function approvalLabel(c: Candidate): string {
  if (isHandoff(c)) return "설비 조작 없음 · 사람에게 넘김";
  if (!c.requires_approval_role) return "승인 불필요";
  if (c.requires_approval_role === "cooling_A") return "냉각 운영 승인";
  return c.type === "job_defer" ? "GPU 운영 확인" : "GPU 운영 승인";
}
