import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { v2, type V2HistoryResp } from "@/api/v2";
import { Button, Card, PageHeader, Section, StatusChip } from "@/components/common";
import { RoleChips } from "@/components/screens/sim";
import { ArchiveLink } from "@/components/screens/ArchiveLink";
import { ROLE_NAME, type Role } from "@/sim/model";
import { STOP_TEXT, useRun } from "@/state/run";

// SCREEN 11 · 결정 영수증 — 상황 설정부터 회차별 사건 · 후보 · 선택 · 검사 · 승인 · 실행까지 하나의 기록으로 남긴다.
const RUN_STATUS: Record<string, string> = { open: "진행 중", resolved: "모두 해결", handoff: "사람에게 넘김", stalled: "진전 없어 사람에게 넘김", max_rounds: "최대 회차 · 사람에게 넘김" };
const clockOf = (ts: number | null) => (ts ? new Date(ts * 1000).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—");

const ACTOR: Record<string, string> = { system: "시스템", model: "Zoro-1", operator: "관제 운영자", cooling_A: "A · 냉각", gpu_B: "B · GPU", simulator: "시뮬레이터" };

export default function ReceiptPage() {
  const navigate = useNavigate();
  const run = useRun();
  const s = run.situation;
  // 누적 기록: 최근 history.max(10)건만 보인다. 그보다 오래된 시연은 지워지지 않고 저장소(/archive)에 남는다(hidden = 저장소에만 있는 건수). mock 모드에는 없다.
  const [history, setHistory] = useState<V2HistoryResp | null>(null);
  const eventCount = run.events.length;
  useEffect(() => {
    if (run.mode !== "live") return;
    let alive = true;
    v2.history().then((h) => alive && setHistory(h)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [run.mode, eventCount]);

  return (
    <>
      <PageHeader crumbs={["기록·분석", "결정 영수증"]} title="결정 영수증 · Decision Receipt" right={<><StatusChip variant="sim" /><StatusChip variant="neutral">{run.name}</StatusChip></>} />
      <div className="nx-content">
        <div className="nx-col">
          <div className="nx-col">
            <Section title="설정한 상황" desc="이 기록의 출발점 · 모든 판단은 이 값에서 계산">
              <Card>
                <dl className="nx-kv nx-kv--wide">
                  <div><dt>노드</dt><dd>{s.nodes.map((n) => `${n.id} ${n.temp}°C${n.fan ? "(팬 이상)" : ""}`).join(" · ")}</dd></div>
                  <div><dt>냉각 구역</dt><dd>{s.zones.map((z) => `${z.id} ${z.level}/${z.max}`).join(" · ")}</dd></div>
                  <div><dt>일</dt><dd>{s.jobs.map((j) => `${j.id}(${j.priority}·${j.gpus}장·${j.node})`).join(" · ")}</dd></div>
                </dl>
              </Card>
            </Section>

            <Section title="회차별 결정" desc="고르지 않은 후보 수와 차단된 시도까지 남깁니다 · 원래 AI 제안은 덮어쓰지 않습니다">
              <Card>
                <table className="nx-table nx-receipt-rounds">
                  <thead><tr><th>회차</th><th>사건</th><th>후보</th><th>AI 선택</th><th>승인</th><th>결과</th></tr></thead>
                  <tbody>
                    {run.rounds.map((r) => (
                      <tr key={r.no}>
                        <td className="strong">{r.no}회차</td>
                        <td>{r.analysis.incidents.map((x) => x.title).join(", ") || "없음"}</td>
                        <td>{r.analysis.stats.built}개 생성 → {r.analysis.stats.sent}개 전달{r.forced ? " · 테스트 차단 1" : ""}</td>
                        <td>{r.chosen ? <><b>{r.chosen.strategy}</b><br /><span className="caption">{r.chosen.stepText.join(" → ")}</span></> : "사람에게 넘김"}</td>
                        <td>{r.chosen ? (Object.keys(r.approvals).length ? (Object.keys(r.approvals) as Role[]).map((x) => ROLE_NAME[x]).join(", ") : <RoleChips roles={r.chosen.roles} />) : "—"}</td>
                        <td>{r.executed && r.chosen ? `해결 ${r.chosen.solved.length} · 남음 ${r.chosen.remaining.length}${r.stop ? ` · ${STOP_TEXT[r.stop]}` : ""}` : r.stop ? STOP_TEXT[r.stop] : "진행 중"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </Section>
          </div>

          {history && history.runs.length > 0 && (
            <Section title={`누적 기록 · ${history.runs.length}건`} desc={`이 브라우저에서 돌린 시연 · 최근 ${history.max}건만 보입니다. 지난 기록은 저장소에 남습니다`} right={<ArchiveLink hidden={history.hidden ?? 0} size="sm" />}>
              <Card>
                <table className="nx-table nx-receipt-rounds">
                  <thead><tr><th>번호</th><th>시작</th><th>상황</th><th>회차별 선택</th><th>결과</th></tr></thead>
                  <tbody>
                    {history.runs.map((h, i) => (
                      <tr key={h.run_id} className={i === 0 ? "nx-row-pick" : undefined}>
                        <td className="strong mono">#{h.run_id}{i === 0 ? " · 현재" : ""}</td>
                        <td className="mono">{clockOf(h.started_at)}</td>
                        <td>{h.name ? <><b>{h.name}</b><br /></> : null}<span className="caption">{h.summary}</span></td>
                        <td>
                          {h.rounds.length
                            ? h.rounds.map((d) => (
                                <div key={d.round}>
                                  <b>{d.round}회차</b> · {d.selected_label ?? (d.status === "handoff" ? "사람에게 넘김" : "조치 불필요")}
                                  <span className="caption"> · 사건 {d.problem_ids.length}건 · {d.provider === "zoro1" ? "Zoro-1" : d.provider === "rule" ? "규칙" : "MOCK"}{d.executed ? ` · 해결 ${d.resolved.length} · 남음 ${d.remaining.length}` : ""}</span>
                                </div>
                              ))
                            : <span className="caption">판단 전</span>}
                        </td>
                        <td>{RUN_STATUS[h.status] ?? h.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </Section>
          )}

          <Section title="타임라인" desc="누가 · 언제 · 무엇을">
            <Card>
              <ol className="nx-timeline">
                {run.events.map((e, i) => (
                  <li key={i} className={`nx-tl nx-tl--${e.kind}`}>
                    <span className="mono caption">{e.at}</span>
                    <span className="nx-tl-actor">{ACTOR[e.actor] ?? e.actor}</span>
                    <span>{e.text}</span>
                  </li>
                ))}
                {!run.events.length && <li className="caption">아직 기록이 없습니다. 상황 설정에서 시작하세요.</li>}
              </ol>
            </Card>
          </Section>
        </div>

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate("/")}>처음부터 다시 시연</Button>
          <Button variant="secondary" onClick={() => navigate("/scenario")}>다른 상황으로 다시 보기</Button>
          {!(history && history.runs.length > 0) && <ArchiveLink />}
          <Button arrow onClick={() => navigate("/analytics")}>기록 상세 보기</Button>
        </div>
      </div>
    </>
  );
}
