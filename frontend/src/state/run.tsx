// 시연 한 번(run)의 상태 — 상황 설정 → 회차별 판단 · 검사 · 승인 · 실행 → 기록.
// 저장은 사람이 내린 결정(승인 · 의견 · 실행)만 하고, 판단 결과는 엔진이 결정적이라 불러올 때 다시 계산한다.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { API_MODE } from "@/api/client";
import { fromCandidate, fromNoAction, fromProblem, fromState, STOP_FROM_NEXT, toServerStep, v2, type V2DecideResp, type V2StateResp } from "@/api/v2";
import { analyze, applyStep, stopReason, STRATEGY_COUNT, toState, type Analysis, type Incident, type Plan, type State, type Step } from "@/sim/engine";
import { MAX_ROUNDS, PRESETS, ROLE_NAME, cloneSituation, type Role, type Situation } from "@/sim/model";

export interface Ev {
  at: string;
  actor: "system" | "model" | "operator" | "cooling_A" | "gpu_B" | "simulator";
  kind: "situation" | "incident" | "decision" | "validated" | "blocked" | "comment" | "approved" | "executed" | "round" | "handoff";
  text: string;
  round?: number;
}
interface RoundRec {
  approvals: Partial<Record<Role, string>>; // 역할 → 승인 시각
  comments: { role: string; text: string; at: string }[];
  forced: { text: string; reason: string; policy?: string; at: string } | null;
  validated: boolean;
  executed: boolean;
}
interface Saved {
  name: string;
  situation: Situation;
  rounds: RoundRec[];
  events: Ev[];
  clock: number;
}
export interface RoundView extends RoundRec {
  no: number;
  base: State;
  analysis: Analysis;
  chosen: Plan | null;
  /** 실행 뒤 다음 회차를 멈춘 이유 (done · no_safe · same · max) — 아직 실행 전이면 null */
  stop: string | null;
}

const KEY = "nx-run";
const START = 14 * 3600;
const clockText = (sec: number) => [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60].map((v) => String(v).padStart(2, "0")).join(":");
const emptyRound = (): RoundRec => ({ approvals: {}, comments: [], forced: null, validated: false, executed: false });

export const STOP_TEXT: Record<string, string> = {
  done: "남은 문제가 없습니다",
  no_safe: "남은 문제에 대해 안전한 후보가 없어 사람에게 넘깁니다",
  same: "직전 회차와 남은 문제가 같아 사람에게 넘깁니다",
  max: `최대 회차(${MAX_ROUNDS})에 도달해 사람에게 넘깁니다`,
};

function fresh(situation: Situation, name: string): Saved {
  const s: Saved = { name, situation: cloneSituation(situation), rounds: [emptyRound()], events: [], clock: START };
  return s;
}
function load(): Saved {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Saved;
  } catch {
    /* 기본 상황으로 */
  }
  return fresh(PRESETS[0].situation, PRESETS[0].name);
}

/** 저장된 결정으로 회차들을 다시 계산한다 */
function rebuild(saved: Saved): RoundView[] {
  const out: RoundView[] = [];
  let base = toState(saved.situation);
  let prevIds: string[] | null = null;
  for (let i = 0; i < saved.rounds.length; i++) {
    const analysis = analyze(base);
    const chosen = analysis.candidates.find((c) => c.id === analysis.pickId) ?? null;
    const rec = saved.rounds[i];
    let stop: string | null = null;
    if (rec.executed && chosen) {
      const next = analyze(chosen.state);
      stop = stopReason(analysis.incidents.map((x) => x.id), next, i + 2, MAX_ROUNDS);
    } else if (!chosen) {
      stop = analysis.incidents.length ? "no_safe" : "done";
    }
    out.push({ ...rec, no: i + 1, base, analysis, chosen, stop });
    prevIds = analysis.incidents.map((x) => x.id);
    if (!rec.executed || !chosen) break;
    base = chosen.state;
  }
  void prevIds;
  return out;
}

interface Ctx {
  name: string;
  situation: Situation;
  rounds: RoundView[];
  events: Ev[];
  current: RoundView;
  round: (no: number) => RoundView | undefined;
  mode: "mock" | "live";
  error: string | null;
  start: (s: Situation, name: string) => Promise<void>;
  validate: (no: number) => Promise<void>;
  forceTest: (no: number) => Promise<ForceResult | null>;
  comment: (no: number, role: string, text: string) => void;
  approve: (no: number, need: Role, acting: string) => Promise<{ ok: true } | { ok: false; reason: string; policy: string }>;
  execute: (no: number) => Promise<void>;
  nextRound: (no: number) => Promise<void>;
  handoff: (no: number) => void;
}
type ForceResult = { text: string; reason: string; policy?: string };

/** 강제 입력 테스트용으로 규칙을 어기는 행동 하나: P0 일 옮기기 → 꽉 찬 노드에 세우기 → 냉각 상한 넘기기 */
function violatingSteps(s: State): Step[] {
  const tries: Step[] = [];
  const p0 = s.jobs.find((j) => j.priority === "P0");
  if (p0) tries.push({ kind: "move", job: p0.id, to: s.nodes.find((n) => n.id !== p0.node)!.id });
  const any = s.jobs.find((j) => j.priority !== "P0");
  const full = s.nodes.find((n) => s.jobs.filter((j) => j.node === n.id).length >= 4);
  if (any && full && full.id !== any.node) tries.push({ kind: "move", job: any.id, to: full.id });
  const z = s.zones[0];
  tries.push({ kind: "cool", zone: z.id, delta: z.max - z.level + 1 });
  return tries;
}
const stepDesc = (st: Step, s: State) => {
  if (st.kind === "cool") {
    const z = s.zones.find((x) => x.id === st.zone)!;
    return `${st.zone} 냉각 레벨 ${z.level} → ${z.level + st.delta}`;
  }
  return st.kind === "move" ? `${st.job}을 ${st.to}로 떠맡기기` : `${st.kind} ${"job" in st ? st.job : ""}`;
};
const RunCtx = createContext<Ctx | null>(null);

function MockRunProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>(load);
  const rounds = useMemo(() => rebuild(saved), [saved]);

  const commit = useCallback((fn: (s: Saved) => Saved) => {
    setSaved((prev) => {
      const next = fn(JSON.parse(JSON.stringify(prev)) as Saved);
      try {
        sessionStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* 저장소를 못 쓰면 메모리로만 */
      }
      return next;
    });
  }, []);
  const tick = (s: Saved, sec = 2) => clockText((s.clock += sec));

  const value = useMemo<Ctx>(() => {
    const round = (no: number) => rounds.find((r) => r.no === no);
    return {
      mode: "mock",
      error: null,
      name: saved.name,
      situation: saved.situation,
      rounds,
      events: saved.events,
      current: rounds[rounds.length - 1],
      round,
      start: async (situation, name) =>
        commit(() => {
          const s = fresh(situation, name);
          const a = analyze(toState(situation));
          s.events.push({ at: tick(s, 0), actor: "operator", kind: "situation", text: `상황 설정 · ${name} (노드 ${situation.nodes.length}개 · 일 ${situation.jobs.length}개)` });
          if (a.incidents.length) s.events.push({ at: tick(s), actor: "system", kind: "incident", text: `사건 ${a.incidents.length}건 감지 · ${a.incidents.map((x) => x.title).join(", ")}`, round: 1 });
          s.events.push({ at: tick(s), actor: "system", kind: "decision", text: `1회차 후보 생성 · 전략 ${a.stats.strategies}종 → 계획 ${a.stats.built}개 → 합치기 ${a.stats.merged} → Safety Gate ${a.stats.safe} → 열위 제거 ${a.stats.pareto} → Zoro-1 전달 ${a.stats.sent}`, round: 1 });
          const pick = a.candidates.find((c) => c.id === a.pickId);
          s.events.push(
            pick
              ? { at: tick(s), actor: "model", kind: "decision", text: `1회차 선택 · ${pick.strategy} (${pick.stepText.join(" → ")}) · MOCK`, round: 1 }
              : { at: tick(s), actor: "system", kind: "handoff", text: "1회차 · 안전한 후보 없음 → 사람에게 넘김", round: 1 },
          );
          return s;
        }),
      validate: async (no) =>
        commit((s) => {
          const r = s.rounds[no - 1];
          if (!r || r.validated) return s;
          r.validated = true;
          const pick = rounds[no - 1]?.chosen;
          s.events.push({ at: tick(s), actor: "system", kind: "validated", text: `${no}회차 안전 검사 통과 · ${pick?.strategy ?? ""}`, round: no });
          return s;
        }),
      forceTest: async (no) => {
        const rv = round(no);
        if (!rv) return null;
        const s = rv.base;
        for (const st of violatingSteps(s)) {
          const r = applyStep(s, st);
          if ("error" in r) {
            const desc = stepDesc(st, s);
            const res = { text: desc, reason: r.error, policy: r.policy };
            commit((sv) => {
              sv.rounds[no - 1].forced = { ...res, at: tick(sv) };
              sv.events.push({ at: tick(sv, 0), actor: "operator", kind: "blocked", text: `테스트 차단 · ${desc} · ${r.policy ?? "규칙"} — ${r.error}`, round: no });
              return sv;
            });
            return res;
          }
        }
        return null;
      },
      comment: (no, role, text) =>
        commit((s) => {
          s.rounds[no - 1].comments.push({ role, text, at: tick(s) });
          s.events.push({ at: tick(s, 0), actor: role === "cooling_A" || role === "gpu_B" ? role : "operator", kind: "comment", text: `의견 · ${text}`, round: no });
          return s;
        }),
      approve: async (no, need, acting) => {
        if (acting !== need) {
          const policy = need === "cooling_A" ? "POL-05" : "POL-04";
          const reason = `${ROLE_NAME[need]} 승인이 필요한 단계입니다. 현재 역할로는 승인할 수 없습니다.`;
          commit((s) => {
            s.events.push({ at: tick(s), actor: "system", kind: "blocked", text: `권한 없는 승인 시도 거부 · ${acting} → ${need} 필요 (${policy})`, round: no });
            return s;
          });
          return { ok: false, reason, policy };
        }
        commit((s) => {
          s.rounds[no - 1].approvals[need] = tick(s);
          s.events.push({ at: tick(s, 0), actor: need, kind: "approved", text: `${ROLE_NAME[need]} 승인`, round: no });
          return s;
        });
        return { ok: true };
      },
      execute: async (no) =>
        commit((s) => {
          const r = s.rounds[no - 1];
          const rv = rounds[no - 1];
          if (!r || r.executed || !rv?.chosen) return s;
          r.executed = true;
          s.events.push({ at: tick(s, 3), actor: "simulator", kind: "executed", text: `${no}회차 실행 · ${rv.chosen.stepText.join(" → ")} · 시뮬레이션`, round: no });
          const next = analyze(rv.chosen.state);
          const stop = stopReason(rv.analysis.incidents.map((x) => x.id), next, no + 1, MAX_ROUNDS);
          s.events.push({ at: tick(s), actor: "system", kind: "round", text: `${no}회차 결과 · 해결 ${rv.chosen.solved.length}건 · 남음 ${next.incidents.length}건${stop ? ` · ${STOP_TEXT[stop]}` : ""}`, round: no });
          if (stop && stop !== "done") s.events.push({ at: tick(s), actor: "system", kind: "handoff", text: `사람에게 넘김 · ${STOP_TEXT[stop]}`, round: no });
          return s;
        }),
      nextRound: async (no) =>
        commit((s) => {
          if (s.rounds.length > no) return s;
          const rv = rounds[no - 1];
          if (!rv?.chosen || !s.rounds[no - 1].executed) return s;
          s.rounds.push(emptyRound());
          const a = analyze(rv.chosen.state);
          s.events.push({ at: tick(s), actor: "system", kind: "decision", text: `${no + 1}회차 후보 생성 · 남은 문제 ${a.incidents.length}건 · Zoro-1 전달 ${a.stats.sent}`, round: no + 1 });
          const pick = a.candidates.find((c) => c.id === a.pickId);
          if (pick) s.events.push({ at: tick(s), actor: "model", kind: "decision", text: `${no + 1}회차 선택 · ${pick.strategy} · MOCK`, round: no + 1 });
          return s;
        }),
      handoff: (no) =>
        commit((s) => {
          s.events.push({ at: tick(s), actor: "system", kind: "handoff", text: `${no}회차 · 사람에게 넘김 요청 기록 (알림 MOCK)`, round: no });
          return s;
        }),
    };
  }, [saved, rounds, commit]);

  return <RunCtx.Provider value={value}>{children}</RunCtx.Provider>;
}

export function useRun(): Ctx {
  const c = useContext(RunCtx);
  if (!c) throw new Error("RunProvider 밖에서 useRun을 쓸 수 없습니다");
  return c;
}

/** 주소의 회차 번호 (숫자가 아니면 현재 회차) */
export function useRoundParam(param: string | undefined): RoundView {
  const run = useRun();
  const n = Number(param);
  return (Number.isFinite(n) && run.round(n)) || run.current;
}

// ================= live: /api/v2 =================
interface LiveRound extends RoundRec {
  base: State;
  analysis: Analysis;
  after: State | null;
  remainingAfter: Incident[] | null;
  stop: string | null;
}
function analysisFrom(st: V2StateResp, dec: V2DecideResp, fans: Record<string, boolean>): { base: State; analysis: Analysis; stop: string | null } {
  const base = fromState(st.state, fans);
  const incidents = (dec.problems?.length ? dec.problems : st.problems).map(fromProblem);
  const candidates = dec.candidates.map((c) => fromCandidate(c, base, incidents));
  const n = candidates.length;
  return {
    base,
    analysis: {
      incidents,
      sim: fromNoAction(st.no_action),
      stats: { strategies: STRATEGY_COUNT, built: n, merged: n, pareto: n, safe: n, sent: n },
      candidates,
      rejected: [],
      pickId: dec.decision.selected_id,
      rationale: dec.decision.rationale ?? (dec.decision.status === "handoff" ? "안전한 계획이 없어 사람에게 넘깁니다." : ""),
    },
    stop: dec.decision.status === "handoff" ? "no_safe" : dec.decision.status === "no_problem" ? "done" : null,
  };
}

const LIVE_KEY = "nx-run-live";
interface LiveSaved { name: string; situation: Situation; rounds: LiveRound[]; events: Ev[]; clock: number }
function loadLive(): LiveSaved | null {
  try {
    const raw = sessionStorage.getItem(LIVE_KEY);
    return raw ? (JSON.parse(raw) as LiveSaved) : null;
  } catch {
    return null;
  }
}

function LiveRunProvider({ children }: { children: ReactNode }) {
  const init = useMemo(loadLive, []);
  const [name, setName] = useState(init?.name ?? PRESETS[0].name);
  const [situation, setSituation] = useState<Situation>(init?.situation ?? cloneSituation(PRESETS[0].situation));
  const [rounds, setRounds] = useState<LiveRound[]>(init?.rounds ?? []);
  const [events, setEvents] = useState<Ev[]>(init?.events ?? []);
  const [error, setError] = useState<string | null>(null);
  const clock = useRef(init?.clock ?? START);
  // 새로고침해도 이어서 볼 수 있도록 서버 응답을 변환한 결과를 세션에 둔다 (서버 상태가 기준)
  useEffect(() => {
    try {
      sessionStorage.setItem(LIVE_KEY, JSON.stringify({ name, situation, rounds, events, clock: clock.current }));
    } catch {
      /* 저장소를 못 쓰면 메모리로만 */
    }
  }, [name, situation, rounds, events]);
  const log = useCallback((e: Omit<Ev, "at">) => {
    clock.current += 2;
    setEvents((prev) => [...prev, { ...e, at: clockText(clock.current) }]);
  }, []);
  const fans = useMemo(() => Object.fromEntries(situation.nodes.map((n) => [n.id, n.fan])), [situation]);
  const guard = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      setError(null);
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  };

  const views: RoundView[] = rounds.map((r, i) => {
    const pick = r.analysis.candidates.find((c) => c.id === r.analysis.pickId) ?? null;
    const chosen = pick && r.executed ? { ...pick, state: r.after ?? pick.state, remaining: r.remainingAfter ?? pick.remaining } : pick;
    return { ...r, no: i + 1, chosen };
  });
  const placeholder: RoundView = {
    ...emptyRound(), no: 1, base: toState(situation), chosen: null, stop: null,
    analysis: { incidents: [], sim: { series: {}, peak: {}, firstOver: {}, finish: {}, energy: 0 }, stats: { strategies: STRATEGY_COUNT, built: 0, merged: 0, pareto: 0, safe: 0, sent: 0 }, candidates: [], rejected: [], pickId: null, rationale: "서버에서 아직 판단하지 않았습니다. 상황 설정에서 시작하세요." },
  };
  const patch = (no: number, fn: (r: LiveRound) => LiveRound) => setRounds((prev) => prev.map((r, i) => (i === no - 1 ? fn(r) : r)));
  const planId = (no: number) => rounds[no - 1]?.analysis.pickId ?? null;

  const value: Ctx = {
    mode: "live",
    error,
    name,
    situation,
    rounds: views.length ? views : [placeholder],
    events,
    current: views[views.length - 1] ?? placeholder,
    round: (no) => views.find((r) => r.no === no),
    start: async (s, nm) => {
      await guard(async () => {
        const st = await v2.scenario(s);
        const dec = await v2.decide();
        const f = Object.fromEntries(s.nodes.map((n) => [n.id, n.fan]));
        const a = analysisFrom(st, dec, f);
        setName(nm);
        setSituation(cloneSituation(s));
        setRounds([{ ...emptyRound(), ...a, after: null, remainingAfter: null }]);
        clock.current = START;
        setEvents([]);
        log({ actor: "operator", kind: "situation", text: `상황 설정 · ${nm} (노드 ${s.nodes.length}개 · 일 ${s.jobs.length}개) · 서버` });
        log({ actor: "system", kind: "decision", text: `1회차 · 사건 ${a.analysis.incidents.length}건 · 후보 ${a.analysis.candidates.length}개 · ${dec.decision.provider}`, round: 1 });
      });
    },
    validate: async (no) => {
      const id = planId(no);
      if (!id) return;
      await guard(async () => {
        await v2.validate({ plan_id: id });
        patch(no, (r) => ({ ...r, validated: true }));
        log({ actor: "system", kind: "validated", text: `${no}회차 안전 검사 · ${id}`, round: no });
      });
    },
    forceTest: async (no) => {
      const r = rounds[no - 1];
      if (!r) return null;
      for (const st of violatingSteps(r.base)) {
        const res = await guard(() => v2.validate({ steps: [toServerStep(st, r.base)] }));
        if (res && res.verdict === "blocked") {
          const bad = res.checks.find((c) => c.result === "fail" || c.result === "blocked") ?? res.checks[0];
          const out = { text: stepDesc(st, r.base), reason: bad?.message ?? bad?.text ?? "규칙 위반", policy: bad?.policy_id ?? bad?.rule };
          patch(no, (x) => ({ ...x, forced: { ...out, at: clockText(clock.current) } }));
          log({ actor: "operator", kind: "blocked", text: `테스트 차단 · ${out.text} · ${out.policy ?? ""} — ${out.reason}`, round: no });
          return out;
        }
      }
      return null;
    },
    comment: (no, role, text) => {
      patch(no, (r) => ({ ...r, comments: [...r.comments, { role, text, at: clockText(clock.current) }] }));
      log({ actor: role === "cooling_A" || role === "gpu_B" ? role : "operator", kind: "comment", text: `의견 · ${text}`, round: no });
    },
    approve: async (no, need, acting) => {
      const id = planId(no);
      if (!id) return { ok: false, reason: "승인할 계획이 없습니다", policy: "" };
      try {
        await v2.approve(id, acting);
        patch(no, (r) => ({ ...r, approvals: { ...r.approvals, [acting]: clockText(clock.current) } }));
        log({ actor: acting as Ev["actor"], kind: "approved", text: `${ROLE_NAME[acting as Role] ?? acting} 승인`, round: no });
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log({ actor: "system", kind: "blocked", text: `권한 없는 승인 시도 거부 · ${acting} → ${need} 필요`, round: no });
        return { ok: false, reason: msg, policy: need === "cooling_A" ? "POL-05" : "POL-04" };
      }
    },
    execute: async (no) => {
      const id = planId(no);
      if (!id) return;
      await guard(async () => {
        const res = await v2.execute(id);
        const r = rounds[no - 1];
        const after = fromState(res.after, fans);
        const remaining = res.remaining.map((x) => (typeof x === "string" ? r.analysis.incidents.find((p) => p.id === x) ?? fromProblem({ id: x, kind: x.startsWith("HOT") ? "overheat" : "deadline", priority: "P2", severity: "", time_min: 0, text: x }) : fromProblem(x)));
        const stop = STOP_FROM_NEXT[res.next.status];
        patch(no, (x) => ({ ...x, executed: true, after, remainingAfter: remaining, stop }));
        log({ actor: "simulator", kind: "executed", text: `${no}회차 실행 · ${id} · ${res.status} · 해결 ${res.resolved.length} · 남음 ${remaining.length}`, round: no });
        if (stop && stop !== "done") log({ actor: "system", kind: "handoff", text: `사람에게 넘김 · ${STOP_TEXT[stop]}`, round: no });
      });
    },
    nextRound: async (no) => {
      if (rounds.length > no) return;
      await guard(async () => {
        const st = await v2.state();
        const dec = await v2.decide();
        const a = analysisFrom(st, dec, fans);
        setRounds((prev) => [...prev, { ...emptyRound(), ...a, after: null, remainingAfter: null }]);
        log({ actor: "system", kind: "decision", text: `${no + 1}회차 · 남은 문제 ${a.analysis.incidents.length}건 · 후보 ${a.analysis.candidates.length}개`, round: no + 1 });
      });
    },
    handoff: (no) => log({ actor: "system", kind: "handoff", text: `${no}회차 · 사람에게 넘김 요청 기록`, round: no }),
  };
  return <RunCtx.Provider value={value}>{children}</RunCtx.Provider>;
}

/** VITE_API_MODE=live면 백엔드 /api/v2, 아니면 프론트 엔진(mock) */
export function RunProvider({ children }: { children: ReactNode }) {
  return API_MODE === "live" ? <LiveRunProvider>{children}</LiveRunProvider> : <MockRunProvider>{children}</MockRunProvider>;
}
