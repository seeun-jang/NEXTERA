// 상황 모델 — 명세 "상황 설정"을 그대로 옮긴 타입과 상수.
// 프론트가 백엔드에 넘길 데이터(노드 · 구역 · 일)와 같은 모양이다. 계산은 engine.ts.

export type Pri = "P0" | "P1" | "P2";
export type Role = "cooling_A" | "gpu_B";

export interface NodeCfg {
  id: string; // N1~N6
  temp: number; // 현재 온도 °C
  fan: boolean; // 팬 이상 (온도가 오르는 원인)
}
export interface ZoneCfg {
  id: string; // Z1~Z3
  level: number; // 현재 냉각 레벨
  max: number; // 냉각 상한
}
export interface JobCfg {
  id: string;
  gpus: number; // 1~8, 처음 상황 설정에서만 지정
  priority: Pri;
  deadline: number; // 마감까지 남은 시간(분)
  work: number; // 남은 작업 시간(분)
  node: string; // 배치 노드. 같은 노드 안 순서 = 배열 순서(나중에 추가한 일이 뒤)
}
export interface Situation {
  nodes: NodeCfg[];
  zones: ZoneCfg[];
  jobs: JobCfg[];
}

// ---------- 고정 규칙 ----------
export const NODE_GPUS = 8; // 노드 GPU 용량 고정
export const MAX_JOBS_PER_NODE = 4; // 노드당 일 총 개수(실행+대기) 상한 — 프론트 결정
export const MAX_NODES = 6;
export const MAX_JOBS = 10;
export const LIMIT_C = 88; // 안전 한계 (POL-02)
export const THROTTLE_C = 85; // 이 온도부터 작업 속도 저하
export const RECOVER_MIN = 2; // 시작부터 한계 이상인 노드가 이 시간 안에 한계 아래로 내려오면 과열로 보지 않는다 (백엔드와 같음)
export const RETURN_C = 78; // 임시 대피한 일이 원래 노드로 돌아오는 온도 (백엔드와 같음)
export const RESTART_MIN = 1; // 멈추거나 옮긴 일의 재시작 지연
export const DEFER_MIN = 30; // 연기 시간 (POL-06: 30분 이내)
export const HORIZON_MIN = 30; // 예측 구간
export const DT = 0.5; // 시뮬레이션 간격(분)
export const MAX_CANDIDATES = 24; // Zoro-1에 넘기는 최대 후보 수 (설정값)
export const MAX_ROUNDS = 4; // 최대 회차 (백엔드 기본값과 같음)

/** 냉각 구역 하나가 노드 2개를 맡는다: N1·N2=Z1, N3·N4=Z2, N5·N6=Z3 */
export const zoneOfNode = (nodeId: string) => `Z${Math.ceil(Number(nodeId.slice(1)) / 2)}`;
export const zoneCount = (nodeCount: number) => Math.ceil(nodeCount / 2);

export const PRI_RANK: Record<Pri, number> = { P0: 0, P1: 1, P2: 2 };
export const ROLE_NAME: Record<Role, string> = { cooling_A: "A · 냉각 운영", gpu_B: "B · GPU 운영" };

// ---------- 프리셋 ----------
const nodes = (temps: number[], fans: number[] = []): NodeCfg[] =>
  temps.map((t, i) => ({ id: `N${i + 1}`, temp: t, fan: fans.includes(i + 1) }));
const zones = (levels: number[], max = 5): ZoneCfg[] => levels.map((l, i) => ({ id: `Z${i + 1}`, level: l, max }));

export interface Preset {
  id: string;
  name: string;
  desc: string;
  situation: Situation;
}

export const PRESETS: Preset[] = [
  {
    id: "base",
    name: "기본 상황",
    desc: "팬 이상인 N4 위에서 마감 5분 남은 J07이 돈다",
    situation: {
      nodes: nodes([63, 46, 66, 81, 71, 69], [4]),
      zones: zones([2, 3, 3]),
      jobs: [
        { id: "J01", gpus: 8, priority: "P2", deadline: 60, work: 20, node: "N1" },
        { id: "J04", gpus: 8, priority: "P1", deadline: 30, work: 12, node: "N3" },
        { id: "J07", gpus: 8, priority: "P1", deadline: 5, work: 2.5, node: "N4" },
        { id: "J08", gpus: 8, priority: "P2", deadline: 60, work: 15, node: "N5" },
        { id: "J09", gpus: 8, priority: "P0", deadline: 60, work: 40, node: "N6" },
      ],
    },
  },
  {
    id: "multi",
    name: "사건이 동시에 터진 날",
    desc: "과열 노드 두 개와, 앞의 일 때문에 마감을 놓칠 일이 함께 있다",
    situation: {
      nodes: nodes([62, 79, 66, 81, 70, 64], [2, 4]),
      zones: zones([2, 3, 2]),
      jobs: [
        { id: "J01", gpus: 4, priority: "P2", deadline: 60, work: 25, node: "N1" },
        { id: "J04", gpus: 4, priority: "P1", deadline: 30, work: 12, node: "N3" },
        { id: "J02", gpus: 4, priority: "P1", deadline: 20, work: 10, node: "N2" },
        { id: "J03", gpus: 4, priority: "P2", deadline: 60, work: 20, node: "N2" },
        { id: "J07", gpus: 8, priority: "P1", deadline: 5, work: 2.5, node: "N4" },
        { id: "J08", gpus: 8, priority: "P2", deadline: 60, work: 15, node: "N5" },
        { id: "J06", gpus: 4, priority: "P1", deadline: 8, work: 3, node: "N5" },
        { id: "J09", gpus: 8, priority: "P0", deadline: 60, work: 40, node: "N6" },
      ],
    },
  },
  {
    id: "full",
    name: "옮길 자리가 없는 날",
    desc: "모든 노드가 꽉 차서 일을 옮길 빈자리가 없다",
    situation: {
      nodes: nodes([63, 66, 66, 81, 71, 69], [4]),
      zones: zones([2, 3, 3]),
      jobs: [
        { id: "J01", gpus: 8, priority: "P2", deadline: 60, work: 20, node: "N1" },
        { id: "J02", gpus: 8, priority: "P1", deadline: 40, work: 18, node: "N2" },
        { id: "J04", gpus: 8, priority: "P1", deadline: 30, work: 12, node: "N3" },
        { id: "J07", gpus: 8, priority: "P1", deadline: 5, work: 2.5, node: "N4" },
        { id: "J08", gpus: 8, priority: "P2", deadline: 60, work: 15, node: "N5" },
        { id: "J09", gpus: 8, priority: "P0", deadline: 60, work: 40, node: "N6" },
      ],
    },
  },
  {
    id: "stuck",
    name: "손쓸 수 없는 문제가 섞인 날",
    desc: "N4 과열에 더해, 어떻게 해도 마감 안에 못 끝나는 일이 있다",
    situation: {
      nodes: nodes([63, 46, 66, 81], [4]),
      zones: zones([2, 3]),
      jobs: [
        { id: "J01", gpus: 8, priority: "P2", deadline: 60, work: 20, node: "N1" },
        { id: "J05", gpus: 4, priority: "P1", deadline: 4, work: 6, node: "N3" },
        { id: "J04", gpus: 4, priority: "P1", deadline: 30, work: 12, node: "N3" },
        { id: "J07", gpus: 8, priority: "P1", deadline: 5, work: 2.5, node: "N4" },
      ],
    },
  },
];

export const cloneSituation = (s: Situation): Situation => JSON.parse(JSON.stringify(s));
