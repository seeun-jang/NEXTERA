import { useNavigate, useParams } from "react-router-dom";
import type { Candidate, Receipt, ReceiptEvent, RoleId } from "@contracts/types";
import { api } from "@/api/client";
import { ROLE_LABEL } from "@/api/role";
import { Button, Card, ErrorState, Icon, PageHeader, PageSkeleton, PolicyTag, ProviderChip, ResultMark, Section, StatusChip } from "@/components/common";
import { useApi } from "@/hooks/useApi";

// SCREEN 12 · 결정 영수증 — 한 번의 결정에 대한 조건·후보·검사·승인·실행을 감사 가능한 기록으로 보여 준다.
// 원래 AI 제안은 덮어쓰지 않고, 사람의 수정·차단·권한 거부는 별도 이벤트로 남는다.
const STATUS = { open: "진행 중", executed: "실행 완료 · 시뮬레이션", held: "보류", failed: "실패" } as const;
const APPROVAL_STATUS = { pending: "검토 중", approved: "승인", changes_requested: "수정 요청", rejected: "거부", escalated: "이관", expired: "만료" } as const;

function actorLabel(a: ReceiptEvent["actor"]) {
  if (a === "system") return "시스템";
  if (a === "model") return "모델";
  if (a === "simulator") return "시뮬레이터";
  return ROLE_LABEL[a as RoleId] ?? a;
}

/** 후보 한 줄의 구분과 검사·상태 */
function candidateRow(rc: Receipt, c: Candidate) {
  const selected = rc.branches.find((b) => b.branch_id === "S0")?.selected_id === c.id;
  const forcedV = rc.validations.find((v) => v.action_id === c.id && v.origin === "operator_forced");
  const modelV = rc.validations.find((v) => v.action_id === c.id && v.origin === "model");
  const approved = rc.approvals.find((a) => a.action_id === c.id && a.status === "approved");
  const executed = rc.execution?.action_id === c.id && rc.execution.status === "succeeded";
  let kind: string;
  if (selected) kind = rc.provider === "zoro1" ? "AI 선택" : "AI 선택 (MOCK)";
  else if (forcedV) kind = "강제 입력";
  else if (c.filtered_out) kind = "정책 제외";
  else kind = "대안";
  let state: { result: "pass" | "fail" | "needs_approval" | "warn"; text: string } | null = null;
  if (forcedV?.verdict === "blocked") state = { result: "fail", text: `차단 · ${forcedV.checks.find((x) => x.result === "fail")?.policy_id ?? ""}` };
  else if (c.filtered_out) state = { result: "warn", text: `후보 아님 · ${c.filter_reason}` };
  else if (executed) state = { result: "pass", text: "승인 · 실행됨" };
  else if (approved) state = { result: "pass", text: "승인됨" };
  else if (modelV) state = { result: modelV.verdict === "blocked" ? "fail" : "needs_approval", text: modelV.verdict === "conditional" ? "조건부 허용" : modelV.verdict };
  return { kind, state, selected };
}

export default function ReceiptPage() {
  const navigate = useNavigate();
  const { id = "DR-0412-01" } = useParams<{ id: string }>();
  const { data: rc, error, loading, reload } = useApi(() => api.getReceipt(id), [id]);

  const header = (
    <PageHeader
      crumbs={["기록·분석", "결정 영수증"]}
      title={`결정 영수증 · ${id}`}
      right={
        <>
          <StatusChip variant="sim" />
          {rc && <ProviderChip provider={rc.provider} />}
        </>
      }
    />
  );
  if (loading && !rc) return <>{header}<PageSkeleton /></>;
  if (error || !rc)
    return (
      <>
        {header}
        <div className="nx-content">
          <Card>
            <ErrorState error={error} onRetry={reload} />
          </Card>
        </div>
      </>
    );

  const labelOf = (aid: string) => rc.candidates.find((c) => c.id === aid)?.label ?? aid;
  const branch = rc.branches.find((b) => b.branch_id !== "S0");
  const shownCands = rc.candidates;

  return (
    <>
      {header}
      <div className="nx-content">
        <div className="nx-receipt-head">
          {[
            { k: "결정 ID", v: rc.decision_id, mono: true },
            { k: "사건", v: rc.incident_id, mono: true },
            { k: "정책 버전", v: `v${rc.policy_version}` },
            { k: "입력 스냅샷", v: rc.snapshot_id, mono: true },
            { k: "상태", v: STATUS[rc.status] },
          ].map((x) => (
            <div key={x.k}>
              <span className="caption">{x.k}</span>
              <strong className={x.mono ? "mono" : undefined}>{x.v}</strong>
            </div>
          ))}
          <div>
            <span className="caption">판단 제공자</span>
            <ProviderChip provider={rc.provider} />
          </div>
        </div>

        <div className="nx-split">
          <div className="nx-col nx-split-main">
            <Section title="① 조건과 실험 분기" desc="원래 조건과 가정 실험을 함께 보관합니다 · 실험은 실행하지 않습니다">
              <Card>
                <table className="nx-table">
                  <thead>
                    <tr>
                      <th>분기</th>
                      <th>조건</th>
                      <th>선택</th>
                      <th style={{ width: 130 }}>출처</th>
                      <th style={{ width: 90 }}>적용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rc.branches.map((b) => {
                      const keys = Object.entries(b.changes);
                      return (
                        <tr key={b.branch_id}>
                          <td className="mono strong">{b.branch_id}</td>
                          <td>
                            {keys.length ? (
                              <>
                                {keys.map(([k, v]) => `${k === "deadline_min" ? "마감" : k} ${v}${k === "deadline_min" ? "분" : ""}`).join(", ")} <StatusChip variant="assumption" />
                              </>
                            ) : (
                              "실제 값 (마감 5분)"
                            )}
                          </td>
                          <td className="strong">{labelOf(b.selected_id)}</td>
                          <td><ProviderChip provider={b.provider} /></td>
                          <td>{b.executed ? <ResultMark result="pass" label="실행" /> : <span className="caption">미실행</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </Section>

            <Section title="② 후보와 독립 검사" desc="고르지 않은 대안·정책 제외·강제 입력 차단까지 남깁니다">
              <Card>
                <table className="nx-table">
                  <thead>
                    <tr>
                      <th>행동</th>
                      <th style={{ width: 140 }}>구분</th>
                      <th style={{ width: 200 }}>검사 · 상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownCands.map((c) => {
                      const r = candidateRow(rc, c);
                      return (
                        <tr key={c.id} className={r.selected ? "nx-row-pick" : undefined}>
                          <td className={r.selected ? "strong" : undefined}>{c.label}</td>
                          <td>{r.kind}</td>
                          <td>{r.state ? <ResultMark result={r.state.result} label={r.state.text} /> : <span className="caption">미검사</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </Section>

            <Section title="③ 권한자 승인" desc="누가 언제 어떤 권한으로 결정했는지">
              <Card>
                {rc.approvals.length ? (
                  rc.approvals.map((a) => (
                    <div key={a.approval_id} className="nx-approval-line">
                      <div>
                        <span className="mono caption">{a.approval_id}</span>
                        <strong>{labelOf(a.action_id)}</strong>
                      </div>
                      <div className="nx-approval-roles">
                        {a.notified_roles.map((r) => (
                          <span key={r} className={r === a.required_role ? "req" : ""}>
                            {ROLE_LABEL[r]}: {r === a.required_role ? (a.decided_by ? `${APPROVAL_STATUS[a.status]} ${a.decided_at ?? ""}` : "대기") : a.comments.some((c) => c.role === r) ? "의견 등록" : "참조"}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted" style={{ fontSize: 13 }}>아직 승인 요청이 없습니다.</p>
                )}
              </Card>
            </Section>
          </div>

          <Section title="④ 결정 흐름" desc={`이벤트 ${rc.events.length}건 · 추가만 하는 기록`} className="nx-split-side">
            <Card className="nx-fill-top">
              <ol className="nx-timeline">
                {rc.events.map((e) => (
                  <li key={e.seq} className={`t-${e.type}`}>
                    <span className="nx-timeline-dot">
                      {e.type === "blocked" ? <Icon name="x" size={10} strokeWidth={3} /> : e.type === "executed" || e.type === "approved" ? <Icon name="check" size={10} strokeWidth={3} /> : null}
                    </span>
                    <div className="nx-timeline-body">
                      <div className="nx-timeline-meta">
                        <span className="mono">{e.at}</span>
                        <span>{actorLabel(e.actor)}</span>
                        {e.provider && e.provider !== "zoro1" && <span className="nx-mini nx-mini--mock">MOCK</span>}
                        {e.provider === "zoro1" && <span className="nx-mini nx-mini--zoro">Zoro-1</span>}
                        {e.is_assumption && <span className="nx-mini nx-mini--assume">가정</span>}
                      </div>
                      <div className="nx-timeline-text">{e.summary}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </Section>
        </div>

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate("/")}>
            처음부터 다시 시연
          </Button>
          {branch && (
            <Button variant="secondary" onClick={() => navigate(`/lab/${branch.branch_id}/compare`)}>
              실험 결과 다시 비교
            </Button>
          )}
          <Button arrow onClick={() => navigate("/analytics")}>
            기록 상세 보기
          </Button>
        </div>
        <div className="nx-receipt-note">
          <PolicyTag id={`v${rc.policy_version}`} /> 원래 AI 제안은 덮어쓰지 않습니다. 저장만으로 변조 방지를 보장하지는 않습니다.
        </div>
      </div>
    </>
  );
}
