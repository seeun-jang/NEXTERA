import type { RoleId } from "@contracts/types";

// 현재 시연 역할. DemoContext가 바꾸고, client가 X-Role 헤더로 보낸다.
let currentRole: RoleId = "operator";

export function setClientRole(role: RoleId) {
  currentRole = role;
}

export function getClientRole(): RoleId {
  return currentRole;
}

export const ROLE_LABEL: Record<RoleId, string> = {
  operator: "관제 운영자",
  cooling_A: "A · 냉각 운영",
  gpu_B: "B · GPU 운영",
  policy_admin: "정책 관리자",
};
