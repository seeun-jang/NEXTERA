import type { Policy } from "@contracts/types";

export const POLICY_TYPE_LABEL: Record<Policy["type"], string> = {
  hard: "필수 제약",
  approval: "승인 요건",
  objective: "최적화 목표",
};
