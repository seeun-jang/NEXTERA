import type { ApiError } from "@contracts/types";

/** 서버(또는 mock)가 돌려준 ApiError를 화면에서 다루기 쉽게 감싼 예외 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly policyId?: string;
  readonly detail?: unknown;

  constructor(status: number, body: ApiError["error"]) {
    super(body.message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = body.code;
    this.policyId = body.policy_id;
    this.detail = body.detail;
  }
}

export function isApiClientError(e: unknown): e is ApiClientError {
  return e instanceof ApiClientError;
}
