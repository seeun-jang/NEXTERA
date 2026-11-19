// 01 상황 설정 — 시연할 상황을 고르거나 직접 조정한다.
// 값은 sessionStorage("nx-scenario")에 두고, mock은 같은 키로 S0 스냅샷을 만든다(mocks/index.ts).
// 계약서의 ExperimentChanges 6개 + 데모 전용 N4 현재 온도. 기본값은 data/seed/snapshot_S0.json과 같다.
import type { Priority } from "@contracts/types";
import type { ScenarioChanges } from "@/api/types";

export interface ScenarioValues {
  n4_temp_c: number;
  deadline_min: number;
  j07_priority: Priority;
  n2_gpus_free: number;
  cooling_max: number;
  objective: "balanced" | "energy";
  approval_delay_min: number;
}

export const DEFAULT_VALUES: ScenarioValues = {
  n4_temp_c: 81,
  deadline_min: 5,
  j07_priority: "P1",
  n2_gpus_free: 8,
  cooling_max: 5,
  objective: "balanced",
  approval_delay_min: 0.5,
};

export interface ScenarioPreset {
  id: string;
  name: string;
  desc: string;
  values: Partial<ScenarioValues>;
}

/** 프리셋은 "어떤 날인가"로 이름 붙인다. 결과(AI 선택)는 미리 정하지 않고 판단을 돌려 보여 준다. */
export const PRESETS: ScenarioPreset[] = [
  { id: "base", name: "기본 상황", desc: "팬 이상인 N4가 뜨거워지는 중, 그 위에서 마감 5분 남은 작업이 돈다", values: {} },
  { id: "tight", name: "마감이 아주 촉박한 날", desc: "J07 마감이 2분밖에 남지 않았다", values: { deadline_min: 2 } },
  { id: "full", name: "옮길 자리가 없는 날", desc: "N2에도 여유 GPU가 없다", values: { n2_gpus_free: 0 } },
  { id: "peak", name: "전력 피크 시간", desc: "운영 목표가 에너지 절감 우선으로 바뀌었다", values: { objective: "energy" } },
  { id: "p0", name: "최우선 작업이 걸린 날", desc: "J07이 P0(절대 중단 금지) 작업이다", values: { j07_priority: "P0" } },
  { id: "hot", name: "손쓸 곳이 거의 없는 날", desc: "N4가 84°C, 냉각은 상한, N2도 꽉 찼다", values: { n4_temp_c: 84, cooling_max: 3, n2_gpus_free: 0 } },
];

export interface SavedScenario {
  id: string; // 프리셋 id 또는 "custom"
  name: string;
  changes: ScenarioChanges; // 기본값과 다른 것만
}

export const SCENARIO_KEY = "nx-scenario";
const EVENT = "nx-scenario-change";

export function valuesOf(preset: ScenarioPreset): ScenarioValues {
  return { ...DEFAULT_VALUES, ...preset.values };
}

/** 기본값과 다른 값만 골라 서버(mock)에 넘길 변경으로 만든다 */
export function toChanges(v: ScenarioValues): ScenarioChanges {
  const out: Record<string, unknown> = {};
  (Object.keys(DEFAULT_VALUES) as (keyof ScenarioValues)[]).forEach((k) => {
    if (v[k] !== DEFAULT_VALUES[k]) out[k] = v[k];
  });
  return out as ScenarioChanges;
}

export function fromChanges(c: ScenarioChanges | undefined): ScenarioValues {
  return { ...DEFAULT_VALUES, ...(c as Partial<ScenarioValues>) };
}

/** 값이 프리셋과 똑같으면 그 프리셋, 아니면 직접 설정 */
export function matchPreset(v: ScenarioValues): ScenarioPreset | null {
  return PRESETS.find((p) => (Object.keys(DEFAULT_VALUES) as (keyof ScenarioValues)[]).every((k) => valuesOf(p)[k] === v[k])) ?? null;
}

export function loadScenario(): SavedScenario {
  try {
    const raw = sessionStorage.getItem(SCENARIO_KEY);
    if (raw) return JSON.parse(raw) as SavedScenario;
  } catch {
    /* 저장소를 못 쓰면 기본 상황 */
  }
  return { id: "base", name: PRESETS[0].name, changes: {} };
}

export function saveScenario(v: ScenarioValues) {
  const p = matchPreset(v);
  const saved: SavedScenario = { id: p?.id ?? "custom", name: p?.name ?? "직접 설정한 상황", changes: toChanges(v) };
  try {
    sessionStorage.setItem(SCENARIO_KEY, JSON.stringify(saved));
  } catch {
    /* 무시 */
  }
  window.dispatchEvent(new Event(EVENT));
  return saved;
}

export function onScenarioChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

const LABEL: Record<keyof ScenarioValues, (v: never) => string> = {
  n4_temp_c: (v: number) => `N4 ${v}°C`,
  deadline_min: (v: number) => `마감 ${v}분`,
  j07_priority: (v: Priority) => `J07 ${v}`,
  n2_gpus_free: (v: number) => `N2 여유 ${v}장`,
  cooling_max: (v: number) => (v <= 3 ? "냉각 상한 도달" : `냉각 상한 ${v}`),
  objective: (v: string) => (v === "energy" ? "에너지 우선" : "균형"),
  approval_delay_min: (v: number) => `승인 지연 ${v}분`,
};

/** 기본값과 다른 값만 짧은 문구 목록으로 */
export function describe(c: ScenarioChanges): string[] {
  return Object.entries(c).map(([k, v]) => (LABEL[k as keyof ScenarioValues] as (x: unknown) => string)?.(v) ?? `${k} ${v}`);
}
