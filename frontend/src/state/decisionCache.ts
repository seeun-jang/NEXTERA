import type { DecideResponse, Validation } from "@contracts/types";

// 계약에 판단 결과를 다시 읽는 GET이 없어서(§5), 마지막 POST /api/decide 응답을 화면 간에 넘겨주는 보관소.
// 새로고침하면 비고, 05 화면은 "AI 판단 실행" 버튼을 보여 준다.
const byBranch = new Map<string, DecideResponse>();

export function rememberDecision(res: DecideResponse) {
  byBranch.set(res.decision.branch_id, res);
}

export function recallDecision(branchId = "S0"): DecideResponse | null {
  return byBranch.get(branchId) ?? null;
}

// 같은 결정·행동을 여러 번 검사하지 않도록(09 화면) 보관
const validations = new Map<string, Validation>();

export function rememberValidation(key: string, v: Validation) {
  validations.set(key, v);
}

export function recallValidation(key: string): Validation | null {
  return validations.get(key) ?? null;
}

/** 데모 초기화 때 호출 */
export function clearDecisions() {
  byBranch.clear();
  validations.clear();
}
