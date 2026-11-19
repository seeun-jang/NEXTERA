import type { ReactNode } from "react";
import type { Provider } from "@contracts/types";

// §7 표기 칩. 문구를 바꾸지 말 것 — 심사에서 "무엇이 실제고 무엇이 예시인지"를 보여주는 장치다.
export type ChipVariant =
  | "sim" | "estimate" | "executed" | "mock" | "zoro1" | "rule"
  | "assumption" | "independent" | "forced" | "ink" | "neutral";

const DEFAULT_LABEL: Record<ChipVariant, string> = {
  sim: "시뮬레이션 예시 데이터",
  estimate: "시뮬레이터 추정",
  executed: "시뮬레이터 실행 · 실제 설비 제어 아님",
  mock: "MOCK · 예시 응답",
  zoro1: "Zoro-1 응답",
  rule: "규칙 폴백 · Zoro-1 아님",
  assumption: "가정",
  independent: "독립 검증 · 모델과 분리",
  forced: "운영자 강제 입력",
  ink: "",
  neutral: "",
};

const CLASS: Record<ChipVariant, string> = {
  sim: "sim", estimate: "estimate", executed: "executed", mock: "mock", zoro1: "zoro1",
  rule: "mock", // 규칙 폴백도 MOCK과 같은 점선 모양
  assumption: "assumption", independent: "independent", forced: "forced", ink: "ink", neutral: "neutral",
};

export function StatusChip({ variant, children, title }: { variant: ChipVariant; children?: ReactNode; title?: string }) {
  return (
    <span className={`nx-chip nx-chip--${CLASS[variant]}`} title={title}>
      {children ?? DEFAULT_LABEL[variant]}
    </span>
  );
}

/** 판단 출처 칩 — 반드시 응답의 provider 필드에서 만든다(화면에서 임의로 고르지 않음). */
export function ProviderChip({ provider, fallbackReason }: { provider: Provider; fallbackReason?: string | null }) {
  const variant: ChipVariant = provider === "zoro1" ? "zoro1" : provider === "rule" ? "rule" : "mock";
  return <StatusChip variant={variant} title={fallbackReason ? `폴백 사유: ${fallbackReason}` : undefined} />;
}
