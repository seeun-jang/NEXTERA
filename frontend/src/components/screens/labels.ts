import type { Candidate, Policy } from "@contracts/types";

export const POLICY_TYPE_LABEL: Record<Policy["type"], string> = {
  hard: "필수 제약",
  approval: "승인 요건",
  objective: "최적화 목표",
};

/** 후보의 승인 요건 문구 */
export function approvalLabel(c: Candidate): string {
  if (!c.requires_approval_role) return "승인 불필요";
  if (c.requires_approval_role === "cooling_A") return "냉각 운영 승인";
  return c.type === "job_defer" ? "GPU 운영 확인" : "GPU 운영 승인";
}
