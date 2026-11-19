import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Icon, PageHeader, PriorityBadge, Section, StatusChip } from "@/components/common";
import { analyze, nodeViews, toState } from "@/sim/engine";
import {
  MAX_JOBS, MAX_JOBS_PER_NODE, MAX_NODES, NODE_GPUS, PRESETS, cloneSituation, zoneCount, zoneOfNode,
  type JobCfg, type Pri, type Situation,
} from "@/sim/model";
import { useRun } from "@/state/run";
import { useDemo } from "@/state/DemoContext";

// SCREEN 01 · 상황 설정 — 노드 · 냉각 구역 · 일을 직접 정한다. 이후 화면은 모두 이 설정이 만든 결과다.
// 여유 GPU는 입력하지 않는다: 노드마다 배치된 일의 GPU 합으로 계산하고, 8장을 넘는 일은 그 노드에서 대기한다.

const sameSituation = (a: Situation, b: Situation) => JSON.stringify(a) === JSON.stringify(b);

/** 노드 수를 바꾸면 구역 수 · 일 배치를 맞춘다 (없어진 노드의 일은 남은 노드 중 자리가 있는 곳으로) */
function resizeNodes(s: Situation, n: number): Situation {
  const out = cloneSituation(s);
  while (out.nodes.length < n) out.nodes.push({ id: `N${out.nodes.length + 1}`, temp: 60, fan: false });
  out.nodes = out.nodes.slice(0, n);
  const zc = zoneCount(n);
  while (out.zones.length < zc) out.zones.push({ id: `Z${out.zones.length + 1}`, level: 2, max: 5 });
  out.zones = out.zones.slice(0, zc);
  const ids = out.nodes.map((x) => x.id);
  out.jobs = out.jobs.filter((j) => {
    if (ids.includes(j.node)) return true;
    const to = ids.find((id) => out.jobs.filter((x) => x.node === id).length < MAX_JOBS_PER_NODE);
    if (!to) return false;
    j.node = to;
    return true;
  });
  return out;
}

export default function ScenarioPage() {
  const navigate = useNavigate();
  const run = useRun();
  const { resetIds } = useDemo();
  const [sit, setSit] = useState<Situation>(() => cloneSituation(run.situation));
  const preset = PRESETS.find((p) => sameSituation(p.situation, sit));
  const set = (fn: (s: Situation) => void) =>
    setSit((prev) => {
      const next = cloneSituation(prev);
      fn(next);
      return next;
    });

  const state = useMemo(() => toState(sit), [sit]);
  const views = useMemo(() => nodeViews(state), [state]);
  const analysis = useMemo(() => analyze(state), [state]);
  const pick = analysis.candidates.find((c) => c.id === analysis.pickId);
  const jobCount = (node: string) => sit.jobs.filter((j) => j.node === node).length;

  const addJob = () =>
    set((s) => {
      const node = s.nodes.find((n) => s.jobs.filter((j) => j.node === n.id).length < MAX_JOBS_PER_NODE);
      if (!node || s.jobs.length >= MAX_JOBS) return;
      let k = 1;
      while (s.jobs.some((j) => j.id === `J${String(k).padStart(2, "0")}`)) k++;
      s.jobs.push({ id: `J${String(k).padStart(2, "0")}`, gpus: 4, priority: "P2", deadline: 30, work: 10, node: node.id });
    });
  const moveOrder = (id: string, dir: -1 | 1) =>
    set((s) => {
      const i = s.jobs.findIndex((j) => j.id === id);
      const node = s.jobs[i].node;
      // 같은 노드 안에서 바로 앞/뒤 일과 자리를 바꾼다
      let k = i + dir;
      while (k >= 0 && k < s.jobs.length && s.jobs[k].node !== node) k += dir;
      if (k < 0 || k >= s.jobs.length) return;
      [s.jobs[i], s.jobs[k]] = [s.jobs[k], s.jobs[i]];
    });
  const updJob = (id: string, patch: Partial<JobCfg>) =>
    set((s) => {
      const j = s.jobs.find((x) => x.id === id)!;
      if (patch.node && patch.node !== j.node) {
        // 다른 노드로 옮기면 그 노드 줄 맨 뒤 (나중에 추가한 일이 뒤 순서)
        s.jobs = [...s.jobs.filter((x) => x.id !== id), { ...j, ...patch }];
        return;
      }
      Object.assign(j, patch);
    });

  const [starting, setStarting] = useState(false);
  const start = async () => {
    setStarting(true);
    await run.start(sit, preset?.name ?? "직접 설정한 상황");
    setStarting(false);
    resetIds();
    navigate("/operations");
  };

  return (
    <>
      <PageHeader crumbs={["상황 설정"]} title="상황 설정 · Scenario" right={<StatusChip variant="sim" />} />
      <div className="nx-content">
        <Section title="어떤 상황을 시연할까요" desc="상황을 고르거나 아래에서 노드 · 구역 · 일을 직접 바꿉니다. 이후 화면은 모두 이 설정의 결과입니다.">
          <div className="nx-scn-presets">
            {PRESETS.map((p) => {
              const on = preset?.id === p.id;
              return (
                <button key={p.id} type="button" className={`nx-scn-preset${on ? " on" : ""}`} aria-pressed={on} onClick={() => setSit(cloneSituation(p.situation))}>
                  <strong>{p.name}</strong>
                  <span>{p.desc}</span>
                  <span className="nx-scn-tags">
                    <em>노드 {p.situation.nodes.length}</em>
                    <em>일 {p.situation.jobs.length}</em>
                    <em>팬 이상 {p.situation.nodes.filter((n) => n.fan).length}</em>
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <div className="nx-split">
          <div className="nx-col nx-split-main">
            <Section
              title="노드와 냉각 구역"
              desc="냉각 구역 하나가 노드 2개를 맡습니다 (N1·N2=Z1, N3·N4=Z2, N5·N6=Z3). 노드의 구역은 바꿀 수 없습니다."
              right={
                <div className="nx-seg" role="group" aria-label="노드 수">
                  {Array.from({ length: MAX_NODES }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" className={sit.nodes.length === n ? "on" : ""} aria-pressed={sit.nodes.length === n} onClick={() => setSit((s) => resizeNodes(s, n))}>
                      노드 {n}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="nx-sb-zones">
                {sit.zones.map((z) => (
                  <Card key={z.id} className="nx-sb-zone">
                    <div className="nx-sb-zone-head">
                      <strong>{z.id}</strong>
                      <label>
                        냉각 레벨
                        <select aria-label={`${z.id} 냉각 레벨`} value={z.level} onChange={(e) => set((s) => { const t = s.zones.find((x) => x.id === z.id)!; t.level = Number(e.target.value); if (t.max < t.level) t.max = t.level; })}>
                          {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </label>
                      <label>
                        상한
                        <select aria-label={`${z.id} 냉각 상한`} value={z.max} onChange={(e) => set((s) => { const t = s.zones.find((x) => x.id === z.id)!; t.max = Number(e.target.value); if (t.level > t.max) t.level = t.max; })}>
                          {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </label>
                    </div>
                    {sit.nodes.filter((n) => zoneOfNode(n.id) === z.id).map((n) => {
                      const v = views.find((x) => x.id === n.id)!;
                      return (
                        <div key={n.id} className="nx-sb-node">
                          <strong className="mono">{n.id}</strong>
                          <label>
                            온도
                            <input type="number" min={30} max={95} step={1} aria-label={`${n.id} 현재 온도`} value={n.temp} onChange={(e) => set((s) => { s.nodes.find((x) => x.id === n.id)!.temp = Math.max(30, Math.min(95, Number(e.target.value) || 30)); })} />
                            °C
                          </label>
                          <button type="button" className={`nx-sb-fan${n.fan ? " on" : ""}`} aria-pressed={n.fan} aria-label={`${n.id} 팬 이상`} onClick={() => set((s) => { const t = s.nodes.find((x) => x.id === n.id)!; t.fan = !t.fan; })}>
                            {n.fan ? "팬 이상" : "팬 정상"}
                          </button>
                          <span className="nx-sb-used caption mono" title={`실행 ${v.usedGpus}장 · 여유 ${v.freeGpus}장`}>
                            GPU {v.usedGpus}/{NODE_GPUS}
                          </span>
                        </div>
                      );
                    })}
                  </Card>
                ))}
              </div>
            </Section>

            <Section
              title="일"
              desc={`GPU 수는 여기서만 정하고 이후에는 바꿀 수 없습니다. 노드당 일은 ${MAX_JOBS_PER_NODE}개까지, 같은 노드에서는 위에 있는 일이 앞 순서입니다.`}
              right={
                <Button size="sm" variant="secondary" onClick={addJob} disabled={sit.jobs.length >= MAX_JOBS}>
                  일 추가 ({sit.jobs.length}/{MAX_JOBS})
                </Button>
              }
            >
              <Card>
                <table className="nx-table nx-sb-jobs">
                  <thead>
                    <tr>
                      <th>일</th>
                      <th>GPU</th>
                      <th>우선순위</th>
                      <th>마감까지</th>
                      <th>남은 작업</th>
                      <th>배치 노드</th>
                      <th>순서</th>
                      <th aria-label="삭제" />
                    </tr>
                  </thead>
                  <tbody>
                    {sit.nodes.flatMap((n) => sit.jobs.filter((j) => j.node === n.id)).map((j) => {
                      const v = views.find((x) => x.id === j.node)!;
                      const waiting = v.waiting.some((x) => x.id === j.id);
                      return (
                        <tr key={j.id}>
                          <td>
                            <strong className="mono">{j.id}</strong>
                            <span className={`nx-sb-state${waiting ? " wait" : ""}`}>{waiting ? "대기" : "실행"}</span>
                          </td>
                          <td>
                            <select aria-label={`${j.id} GPU 수`} value={j.gpus} onChange={(e) => updJob(j.id, { gpus: Number(e.target.value) })}>
                              {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => <option key={g} value={g}>{g}장</option>)}
                            </select>
                          </td>
                          <td>
                            <div className="nx-seg nx-seg--sm" role="group" aria-label={`${j.id} 우선순위`}>
                              {(["P0", "P1", "P2"] as Pri[]).map((p) => (
                                <button key={p} type="button" className={j.priority === p ? "on" : ""} aria-pressed={j.priority === p} onClick={() => updJob(j.id, { priority: p })}>
                                  {p}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td>
                            <input type="number" min={1} max={120} step={0.5} aria-label={`${j.id} 마감까지 남은 시간`} value={j.deadline} onChange={(e) => updJob(j.id, { deadline: Math.max(0.5, Number(e.target.value) || 1) })} /> 분
                          </td>
                          <td>
                            <input type="number" min={0.5} max={120} step={0.5} aria-label={`${j.id} 남은 작업 시간`} value={j.work} onChange={(e) => updJob(j.id, { work: Math.max(0.5, Number(e.target.value) || 1) })} /> 분
                          </td>
                          <td>
                            <select aria-label={`${j.id} 배치 노드`} value={j.node} onChange={(e) => updJob(j.id, { node: e.target.value })}>
                              {sit.nodes.map((n) => (
                                <option key={n.id} value={n.id} disabled={n.id !== j.node && jobCount(n.id) >= MAX_JOBS_PER_NODE}>
                                  {n.id} ({zoneOfNode(n.id)}){n.id !== j.node && jobCount(n.id) >= MAX_JOBS_PER_NODE ? " · 가득" : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="nx-sb-order">
                            <button type="button" aria-label={`${j.id} 앞으로`} onClick={() => moveOrder(j.id, -1)}>↑</button>
                            <button type="button" aria-label={`${j.id} 뒤로`} onClick={() => moveOrder(j.id, 1)}>↓</button>
                          </td>
                          <td>
                            <button type="button" className="nx-sb-del" aria-label={`${j.id} 삭제`} onClick={() => set((s) => { s.jobs = s.jobs.filter((x) => x.id !== j.id); })} disabled={sit.jobs.length <= 1}>
                              <Icon name="x" size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </Section>
          </div>

          <Section title="이 상황에서는" desc="설정이 바뀔 때마다 바로 다시 계산합니다" className="nx-split-side">
            <Card className="nx-scn-result">
              <span className="caption">{preset ? preset.name : "직접 설정한 상황"}</span>
              <div className="nx-sb-incidents">
                <span className="caption">사건 (중요도 순)</span>
                {analysis.incidents.length ? (
                  <ol>
                    {analysis.incidents.map((x) => (
                      <li key={x.id}>
                        <span className={`nx-inc-kind nx-inc-kind--${x.kind}`}>{x.kind === "heat" ? "과열" : "마감"}</span>
                        <strong>{x.title}</strong>
                        <PriorityBadge priority={x.priority} />
                        <span className="caption">{x.detail}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="caption">조치가 필요한 사건이 없습니다. 온도를 올리거나 팬 이상을 켜 보세요.</p>
                )}
              </div>
              {analysis.incidents.length > 0 && (
                <div className={`nx-scn-pick${pick ? "" : " handoff"}`}>
                  <span className="caption">AI 선택 · 후보 {analysis.stats.sent}개 중</span>
                  <strong>{pick ? pick.strategy : "사람에게 넘김"}</strong>
                  <span className="nx-scn-pick-steps">{pick ? pick.stepText.join(" → ") : "Safety Gate를 통과한 후보가 없습니다"}</span>
                </div>
              )}
              <p className="caption">
                {run.mode === "live" ? "이 미리보기는 프론트 추정입니다. 시작하면 서버가 같은 상황으로 다시 계산합니다 (팬 이상 값은 서버로 보내지 않음). " : ""}
                판단은 실행이 아닙니다. 이후 안전 검사와 권한자 승인을 거칩니다. 수치는 시뮬레이션 추정입니다.
              </p>
            </Card>
          </Section>
        </div>

        <div className="nx-actions">
          <span className="caption nx-scn-summary">
            노드 {sit.nodes.length} · 구역 {sit.zones.length} · 일 {sit.jobs.length} · 사건 {analysis.incidents.length}
          </span>
          <Button arrow onClick={start} disabled={starting}>
            {starting ? "서버가 판단하는 중…" : "이 상황으로 시작"}
          </Button>
        </div>
      </div>
    </>
  );
}
