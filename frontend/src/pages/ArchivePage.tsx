import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_MODE, ApiClientError } from "@/api/client";
import {
  ACTOR_TEXT, KIND_TEXT, NEXT_TEXT, PROVIDER_TEXT, ROLE_TEXT, STATUS_TEXT, archiveApi, fmtTime,
  type ArchiveDetail, type ArchiveItem, type ArchiveQuery, type ArchiveResult, type ArchiveScenario,
} from "@/api/archive";
import { Button, Card, ErrorState, Icon, PageHeader, PriorityBadge, Section, StatusChip } from "@/components/common";
import type { Situation } from "@/sim/model";
import { useDemo } from "@/state/DemoContext";
import { useRun } from "@/state/run";
import "@/styles/archive.css";

// 저장소 — 지난 시연 기록. 결정 영수증의 "누적 기록"은 최근 10건만 보이고, 나머지는 지워지지 않고 여기 남는다.
// /archive = 목록(필터 · 검색 · 더 보기), /archive/:id = 한 건의 상세(읽기 전용) + 같은 상황으로 다시 시연.
const PAGE = 50;

function ResultChip({ r }: { r: ArchiveResult }) {
  return <span className={`nx-arc-result nx-arc-result--${r === "성공" ? "ok" : r === "실패" ? "fail" : "open"}`}>{r}</span>;
}

/** 저장된 상황(서버 모양) → 화면의 상황 모양. 같은 상황으로 다시 시연할 때 쓴다 */
function toSituation(s: ArchiveScenario): Situation {
  return {
    nodes: s.nodes.map((n, i) => ({ id: n.id ?? `N${i + 1}`, temp: n.temp_c, fan: !!n.fan })),
    zones: s.zones.map((z) => ({ id: z.id, level: z.cooling_level, max: z.cooling_max })),
    jobs: s.jobs.map((j) => ({ id: j.id, gpus: j.gpus, priority: j.priority, deadline: j.deadline_min ?? 999, work: j.remaining_min, node: j.node })),
  };
}

function MockNotice() {
  return (
    <Card>
      <div className="nx-arc-empty">
        <Icon name="info" size={20} />
        <div>
          <strong>저장소는 서버 모드에서 쌓입니다</strong>
          <p className="caption">지금은 MOCK 모드라 서버 기록이 없습니다. <span className="mono">VITE_API_MODE=live</span>로 백엔드에 연결하면 시연 한 번이 기록 1건으로 남고, 결정 영수증에서 빠진 지난 기록도 여기서 볼 수 있습니다.</p>
        </div>
      </div>
    </Card>
  );
}

function ArchiveList() {
  const navigate = useNavigate();
  const [query, setQuery] = useState<ArchiveQuery>({ scope: "mine" });
  const [text, setText] = useState("");
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [total, setTotal] = useState(0);
  const [windowSize, setWindowSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = async (q: ArchiveQuery, append = false) => {
    setLoading(true);
    try {
      const res = await archiveApi.list({ ...q, limit: PAGE, offset: append ? items.length : 0 });
      setItems((prev) => (append ? [...prev, ...res.items] : res.items));
      setTotal(res.total);
      setWindowSize(res.receipt_window);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (API_MODE === "live") void load(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);
  const set = (patch: Partial<ArchiveQuery>) => setQuery((q) => ({ ...q, ...patch }));

  return (
    <>
      <PageHeader crumbs={["기록·분석", "저장소"]} title="저장소 · Archive" guide={false} right={<StatusChip variant="neutral">{API_MODE === "live" ? "서버 기록" : "MOCK"}</StatusChip>} />
      <div className="nx-content">
        <div className="nx-arc-intro">
          <Icon name="inbox" size={18} />
          <span>시연 한 번(상황 설정 → 회차 반복 → 종료)이 기록 1건입니다. 결정 영수증에는 최근 {windowSize}건만 보이고, 그보다 오래된 기록은 지워지지 않고 이곳에 남습니다.</span>
        </div>

        {API_MODE !== "live" ? (
          <MockNotice />
        ) : (
          <>
            <div className="nx-filters">
              <div className="nx-seg" role="group" aria-label="기록 범위">
                <button type="button" className={query.scope === "mine" ? "on" : ""} onClick={() => set({ scope: "mine" })}>내 기록</button>
                <button type="button" className={query.scope === "all" ? "on" : ""} onClick={() => set({ scope: "all" })}>모든 접속자</button>
              </div>
              <div className="nx-seg" role="group" aria-label="사건 유형">
                {([undefined, "overheat", "deadline"] as const).map((k) => (
                  <button key={k ?? "all"} type="button" className={query.kind === k ? "on" : ""} onClick={() => set({ kind: k })}>{k ? `${KIND_TEXT[k]} 위험` : "모든 사건"}</button>
                ))}
              </div>
              <div className="nx-seg" role="group" aria-label="결과">
                {([undefined, "성공", "실패", "진행 중"] as const).map((r) => (
                  <button key={r ?? "all"} type="button" className={query.result === r ? "on" : ""} onClick={() => set({ result: r })}>{r ?? "모든 결과"}</button>
                ))}
              </div>
              <form className="nx-arc-search" onSubmit={(e) => { e.preventDefault(); set({ q: text.trim() || undefined }); }}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="상황 이름 · 사건 id · 선택한 계획" aria-label="저장소 검색" />
                <Button size="sm" variant="secondary" type="submit">찾기</Button>
              </form>
            </div>
            {query.scope === "all" && <p className="caption">모든 접속자 기록이 함께 보입니다. 다른 사람의 시연도 섞여 있습니다.</p>}

            <Section title={`기록 ${total}건`} desc="최신순 · 행을 누르면 상세">
              <Card>
                {error instanceof ApiClientError && error.status === 404 ? (
                  <div className="nx-arc-empty">
                    <Icon name="info" size={20} />
                    <div>
                      <strong>이 서버에는 아직 저장소 기능이 없습니다</strong>
                      <p className="caption">백엔드를 저장소가 들어간 버전(v12j 이상)으로 올리면 지난 시연이 여기에 쌓입니다. 결정 영수증의 누적 기록(최근 10건)은 지금도 볼 수 있습니다.</p>
                    </div>
                  </div>
                ) : error ? (
                  <ErrorState error={error} onRetry={() => load(query)} />
                ) : !items.length && !loading ? (
                  <p className="caption">조건에 맞는 기록이 없습니다.</p>
                ) : (
                  <table className="nx-table nx-arc-table">
                    <thead>
                      <tr>
                        <th>#</th><th>시작</th><th>상황</th><th>사건</th><th>회차</th><th>결과</th><th>판단 출처</th><th>첫 선택</th><th>영수증</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.archive_id} className="nx-arc-row" tabIndex={0} onClick={() => navigate(`/archive/${encodeURIComponent(it.archive_id)}`)} onKeyDown={(e) => e.key === "Enter" && navigate(`/archive/${encodeURIComponent(it.archive_id)}`)}>
                          <td className="mono">{query.scope === "all" ? `${it.session.slice(-4)}·${it.run_id}` : it.run_id}</td>
                          <td className="mono">{fmtTime(it.started_at)}</td>
                          <td><strong>{it.name ?? "이름 없는 상황"}</strong><br /><span className="caption">{it.summary}</span></td>
                          <td>{it.problem_ids.map((p) => <span key={p} className="nx-arc-pid mono">{p}</span>)}</td>
                          <td>{it.executed_rounds}/{it.round_count}</td>
                          <td><ResultChip r={it.result} /><br /><span className="caption">{STATUS_TEXT[it.status]}</span></td>
                          <td>{it.providers.map((p) => PROVIDER_TEXT[p] ?? p).join(" · ")}</td>
                          <td className="nx-arc-first">{it.first_selection ?? "—"}</td>
                          <td>{it.in_receipt_window ? <span className="caption">최근 기록</span> : <span className="nx-arc-only">저장소에만</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {items.length < total && (
                  <div className="nx-arc-more">
                    <Button variant="secondary" onClick={() => load(query, true)} disabled={loading}>{loading ? "불러오는 중…" : `더 보기 (${total - items.length}건 남음)`}</Button>
                  </div>
                )}
              </Card>
            </Section>
          </>
        )}

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate("/receipts")}>결정 영수증</Button>
          <Button variant="secondary" onClick={() => navigate("/analytics")}>기록·분석</Button>
        </div>
      </div>
    </>
  );
}

function ArchiveDetailView({ id }: { id: string }) {
  const navigate = useNavigate();
  const run = useRun();
  const { resetIds } = useDemo();
  const [d, setD] = useState<ArchiveDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    archiveApi.detail(id).then(setD, setError);
  }, [id]);

  const header = <PageHeader crumbs={["기록·분석", "저장소", "상세"]} title={d ? `#${d.run_id} ${d.name ?? "이름 없는 상황"}` : "저장소 · 상세"} guide={false} right={d ? <ResultChip r={d.result} /> : undefined} />;
  if (error) return <>{header}<div className="nx-content"><Card><ErrorState error={error} onRetry={() => archiveApi.detail(id).then(setD, setError)} /></Card></div></>;
  if (!d) return <>{header}<div className="nx-content"><Card><p className="caption">불러오는 중…</p></Card></div></>;

  const replay = async () => {
    setStarting(true);
    await run.start(toSituation(d.scenario), d.scenario.name ?? d.name ?? "저장소에서 다시 시연");
    setStarting(false);
    resetIds();
    navigate("/operations");
  };

  return (
    <>
      {header}
      <div className="nx-content">
        <div className="nx-arc-head">
          <div><span className="caption">시작</span><b className="mono">{fmtTime(d.started_at)}</b></div>
          <div><span className="caption">마지막</span><b className="mono">{fmtTime(d.last_at)}</b></div>
          <div><span className="caption">회차</span><b>{d.executed_rounds}/{d.round_count} 실행</b></div>
          <div><span className="caption">상태</span><b>{STATUS_TEXT[d.status]}</b></div>
          <div><span className="caption">판단 출처</span><b>{d.providers.map((p) => PROVIDER_TEXT[p] ?? p).join(" · ")}</b></div>
          <div><span className="caption">영수증</span><b>{d.in_receipt_window ? "최근 기록에도 보임" : "저장소에만 있음"}</b></div>
        </div>

        <Section title="설정한 상황" desc="읽기 전용 기록 · 같은 상황으로 다시 시연할 수 있습니다" right={<Button size="sm" arrow onClick={replay} disabled={starting}>{starting ? "판단하는 중…" : "이 상황으로 다시 시연"}</Button>}>
          <Card>
            <dl className="nx-kv nx-kv--wide">
              <div><dt>노드</dt><dd>{d.scenario.nodes.map((n) => `${n.id} ${n.temp_c}°C${n.fan ? "(팬 이상)" : ""}`).join(" · ")}</dd></div>
              <div><dt>냉각 구역</dt><dd>{d.scenario.zones.map((z) => `${z.id} ${z.cooling_level}/${z.cooling_max}`).join(" · ")}</dd></div>
              <div><dt>일</dt><dd>{d.scenario.jobs.map((j) => `${j.id}(${j.priority}·${j.gpus}장·${j.node}·${j.deadline_min === null ? "마감 없음" : `마감 ${j.deadline_min}분`})`).join(" · ")}</dd></div>
            </dl>
          </Card>
        </Section>

        <Section title="회차별 기록" desc="그래프는 저장하지 않아 표와 문구로만 보여 줍니다">
          <div className="nx-col">
            {d.rounds.map((r) => (
              <Card key={r.round} className="nx-arc-round">
                <div className="nx-arc-round-head">
                  <strong>{r.round}회차</strong>
                  <span className={`nx-arc-prov nx-arc-prov--${r.provider}`}>{PROVIDER_TEXT[r.provider] ?? r.provider}{r.is_fallback ? " · 모델 실패 후 규칙" : ""}</span>
                  <span className="caption">후보 {r.candidates}개 · 전달 {r.sent}개{r.provider === "zoro1" && r.agreement ? ` · 일치 ${r.agreement}` : ""}{r.latency_ms ? ` · ${Math.round(r.latency_ms)}ms` : ""}</span>
                  {r.needs_review && <span className="nx-arc-only">검토 필요</span>}
                </div>
                <div className="nx-arc-round-body">
                  <div>
                    <span className="caption">사건</span>
                    <ul className="nx-arc-problems">
                      {r.problems.map((p) => (
                        <li key={p.id}>
                          <span className={`nx-inc-kind nx-inc-kind--${p.kind === "overheat" ? "heat" : "deadline"}`}>{KIND_TEXT[p.kind]}</span>
                          <b className="mono">{p.id}</b>
                          <PriorityBadge priority={p.priority as "P0" | "P1" | "P2"} />
                          <span>{p.text}</span>
                        </li>
                      ))}
                      {!r.problems.length && <li className="caption">사건 없음</li>}
                    </ul>
                  </div>
                  <div>
                    <span className="caption">{r.status === "handoff" ? "판단" : "선택한 계획"}</span>
                    {r.status === "handoff" ? (
                      <p><b>안전한 계획 없음 → 사람에게 넘김</b></p>
                    ) : r.status === "no_problem" ? (
                      <p>조치 불필요</p>
                    ) : (
                      <>
                        <p><b>{r.strategy ?? r.selected_id}</b> <span className="caption mono">{r.selected_id}</span>{r.provider === "zoro1" && r.probs && r.selected_id && r.probs[r.selected_id] !== undefined ? <span className="caption"> · 확률 {Math.round(r.probs[r.selected_id] * 100)}%</span> : null}</p>
                        <ol className="nx-arc-steps">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                      </>
                    )}
                    {r.rationale && <p className="caption">{r.rationale}</p>}
                  </div>
                  <div>
                    <span className="caption">승인 · 실행</span>
                    <dl className="nx-arc-kv">
                      <div><dt>필요 승인</dt><dd>{(r.required_roles ?? []).map((x) => ROLE_TEXT[x] ?? x).join(", ") || "—"}</dd></div>
                      <div><dt>승인한 역할</dt><dd>{(r.approved_by ?? []).map((x) => ROLE_TEXT[x] ?? x).join(", ") || "—"}</dd></div>
                      <div><dt>실행</dt><dd>{r.executed ? `실행 · 해결 ${r.resolved.join(", ") || "없음"}` : "실행 안 함"}</dd></div>
                      <div><dt>남은 사건</dt><dd>{r.remaining.join(", ") || "없음"}</dd></div>
                      {r.escalate && r.escalate.length > 0 && <div><dt>따로 넘김</dt><dd>{r.escalate.join(", ")}</dd></div>}
                      <div><dt>다음</dt><dd>{r.next ? NEXT_TEXT[r.next] : "—"}</dd></div>
                    </dl>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="타임라인" desc="실제 시각 · 서버 기록 그대로">
          <Card>
            <ol className="nx-timeline">
              {d.events.map((e, i) => (
                <li key={i} className={`nx-tl nx-tl--${e.type === "blocked" ? "blocked" : e.type === "approved" ? "approved" : e.type === "executed" ? "executed" : e.type === "escalated" ? "handoff" : "x"}`}>
                  <span className="mono caption">{fmtTime(e.ts).split(" ")[1]}</span>
                  <span className="nx-tl-actor">{ACTOR_TEXT[e.actor] ?? e.actor}</span>
                  <span>{e.round ? <span className="caption">{e.round}회차 · </span> : null}{e.summary}</span>
                </li>
              ))}
            </ol>
          </Card>
        </Section>

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate("/archive")}>저장소 목록</Button>
        </div>
      </div>
    </>
  );
}

export default function ArchivePage() {
  const { id } = useParams<{ id: string }>();
  return id ? <ArchiveDetailView id={decodeURIComponent(id)} /> : <ArchiveList />;
}
