import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ApprovalDecisionRequest, RoleId } from "@contracts/types";
import { api, newIdempotencyKey } from "@/api/client";
import { ApiClientError } from "@/api/errors";
import { ROLE_LABEL } from "@/api/role";
import { Button, Card, EmptyState, ErrorState, Icon, PageHeader, PageSkeleton, PolicyTag, ProviderChip, Section, StatusChip, Stepper } from "@/components/common";
import { useAction, useApi } from "@/hooks/useApi";
import { useDemo } from "@/state/DemoContext";

// SCREEN 08 · 협업·승인 — AI 제안을 권한 있는 사람이 검토·승인한다. 권한 없는 승인은 버튼 비활성 + 서버 거부(403) 두 겹.
const STATUS_LABEL = {
  pending: "검토 중",
  approved: "승인됨",
  changes_requested: "수정 요청",
  rejected: "거부됨",
  escalated: "이관됨",
  expired: "만료",
} as const;
const APPROVAL_POLICY: Record<string, string> = { job_migrate: "POL-04", cooling_change: "POL-05", job_defer: "POL-06" };
const ACTION_WORD: Record<string, string> = { job_migrate: "작업 이동", cooling_change: "냉각 변경", job_defer: "작업 연기" };

export default function ApprovalPage() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const { approvalId: ctxApproval, decisionId, role, setRole, setIds } = useDemo();
  const id = params.id ?? ctxApproval;
  const [text, setText] = useState("");
  const [denied, setDenied] = useState<ApiClientError | null>(null);

  const { data, error, loading, reload, setData } = useApi(
    async () => (id ? Promise.all([api.getApproval(id), api.getReceipt(decisionId ?? "DR-0412-01")]) : null),
    [id],
  );

  const comment = useAction(async () => {
    if (!id || !text.trim()) return;
    const a = await api.commentApproval(id, text.trim());
    setText("");
    if (data) setData([a, data[1]]);
  });

  const decide = useAction(async (action: ApprovalDecisionRequest["action"]) => {
    if (!id) return;
    setDenied(null);
    try {
      const a = await api.decideApproval(id, { action, idempotency_key: newIdempotencyKey() });
      if (action === "approve") {
        // 승인 → 실행 직전 재검사 → 시뮬레이터에 실행 요청
        const exe = await api.execute({ approval_id: a.approval_id, idempotency_key: newIdempotencyKey() });
        setIds({ executionId: exe.execution_id });
        navigate(`/executions/${exe.execution_id}`);
        return;
      }
      if (action === "request_changes") navigate(`/decision/${a.decision_id}`);
      else navigate(`/receipts/${a.decision_id}`);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 403) {
        setDenied(e);
        reload();
        return;
      }
      throw e;
    }
  });

  const header = (
    <PageHeader
      crumbs={["협업·승인", id ?? "승인 요청"]}
      title="협업 · 승인"
      right={
        <>
          <StatusChip variant="sim" />
          <StatusChip variant="ink">사람 승인 필수</StatusChip>
        </>
      }
    />
  );

  if (!id)
    return (
      <>
        {header}
        <div className="nx-content">
          <Card>
            <EmptyState
              title="진행 중인 승인 요청이 없습니다"
              description="안전 검사에서 '조건부 허용'이 나오면 승인 요청이 만들어집니다."
              action={<Button variant="secondary" onClick={() => navigate(`/decision/${decisionId ?? "DR-0412-01"}/validate`)}>안전 검사로</Button>}
            />
          </Card>
        </div>
      </>
    );
  if (loading && !data) return <>{header}<PageSkeleton /></>;
  if (error || !data)
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

  const [ap, rc] = data;
  const cand = rc.candidates.find((c) => c.id === ap.action_id);
  const validation = rc.validations.find((v) => v.approval_id === ap.approval_id);
  const slackCheck = validation?.checks.find((c) => c.policy_id === "POL-08");
  const pid = cand ? APPROVAL_POLICY[cand.type] : undefined;
  const canDecide = role === ap.required_role;
  const pending = ap.status === "pending";
  const history = rc.events.filter((e) => e.ref_id === ap.approval_id || e.ref_id === validation?.validation_id);
  const reason = !canDecide
    ? `${ROLE_LABEL[role]}은(는) ${cand ? ACTION_WORD[cand.type] : "이 행동"} 승인 권한이 없습니다${pid ? ` (${pid})` : ""}.`
    : undefined;

  return (
    <>
      {header}
      <div className="nx-content">
        <div className="nx-flowsteps">
          <Stepper
            steps={[
              { label: "AI 제안", state: "done" },
              { label: "정책 검사", state: "done" },
              { label: "사람 검토", state: pending ? "current" : "done" },
              { label: "승인", state: ap.status === "approved" ? "done" : "todo" },
              { label: "실행", state: rc.execution ? "done" : "todo" },
            ]}
          />
        </div>

        <div className="nx-split">
          <div className="nx-col nx-split-main">
            <Section title="AI 제안" desc="안전 검사를 통과한 제안 · 원래 제안은 수정되지 않고 영수증에 그대로 남습니다">
              <div className="nx-proposal">
                <div className="nx-proposal-main">
                  <span className="caption">요청 {ap.approval_id}</span>
                  <strong>{cand?.label ?? ap.action_id}</strong>
                  <div className="nx-proposal-meta">
                    <ProviderChip provider={rc.provider} />
                    <StatusChip variant="neutral">안전 검사 · {validation?.verdict === "conditional" ? "조건부 허용" : validation?.verdict ?? "—"}</StatusChip>
                    {slackCheck && <StatusChip variant="neutral">{slackCheck.observed}</StatusChip>}
                    {pid && <PolicyTag id={pid} />}
                  </div>
                </div>
                <div className="nx-proposal-status">
                  <span className="caption">상태</span>
                  <strong>{STATUS_LABEL[ap.status]}</strong>
                </div>
              </div>
            </Section>

            <Section title="필요한 승인자" desc={`권한은 정책 v${rc.policy_version} 역할표 기준 · 서버가 한 번 더 확인합니다`}>
              <Card>
                <table className="nx-table">
                  <thead>
                    <tr>
                      <th>담당</th>
                      <th>이 행동 승인 권한</th>
                      <th style={{ width: 140 }}>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ap.notified_roles.map((r) => {
                      const req = r === ap.required_role;
                      return (
                        <tr key={r} className={r === role ? "nx-row-me" : undefined}>
                          <td className="strong">
                            {ROLE_LABEL[r]} {r === role && <span className="nx-me">나</span>}
                          </td>
                          <td>{req ? <strong>있음 · 필수</strong> : <span className="muted">없음 · 의견만</span>}</td>
                          <td>{req ? STATUS_LABEL[ap.status] : ap.comments.some((c) => c.role === r) ? "의견 등록" : "참조"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </Section>

            <Section title="의견" desc="어느 역할이든 의견을 남길 수 있습니다">
              <Card>
                {ap.comments.length ? (
                  <ul className="nx-comments">
                    {ap.comments.map((c, i) => (
                      <li key={i}>
                        <span className="nx-avatar">{c.role === "cooling_A" ? "A" : c.role === "gpu_B" ? "B" : "관"}</span>
                        <div>
                          <div className="caption">{ROLE_LABEL[c.role]} · {c.at}</div>
                          <p>{c.text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ fontSize: 13 }}>아직 의견이 없습니다.</p>
                )}
                <div className="nx-comment-input">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && comment.run()}
                    placeholder={`${ROLE_LABEL[role]}(으)로 의견 입력…`}
                    aria-label="의견 입력"
                  />
                  <Button size="sm" variant="secondary" onClick={() => comment.run()} disabled={!text.trim() || comment.pending}>
                    의견 등록
                  </Button>
                </div>
              </Card>
            </Section>
          </div>

          <div className="nx-col nx-split-side">
            <Section title="내 결정" desc="사이드바나 아래에서 역할을 바꿔 볼 수 있습니다">
              <div className="nx-decide">
                <div className="nx-decide-role">
                  <span className="caption">현재 역할</span>
                  <div className="nx-seg">
                    {(["operator", "cooling_A", "gpu_B"] as RoleId[]).map((r) => (
                      <button type="button" key={r} className={role === r ? "on" : ""} onClick={() => { setRole(r); setDenied(null); }}>
                        {ROLE_LABEL[r]}
                      </button>
                    ))}
                  </div>
                </div>

                {pending ? (
                  <>
                    <Button block arrow onClick={() => decide.run("approve")} disabled={!canDecide || decide.pending}>
                      {decide.pending ? "재검사 후 실행 중…" : "승인하고 실행"}
                    </Button>
                    <div className="nx-decide-row">
                      <Button variant="secondary" size="sm" onClick={() => decide.run("request_changes")} disabled={!canDecide || decide.pending}>수정 요청</Button>
                      <Button variant="secondary" size="sm" onClick={() => decide.run("reject")} disabled={!canDecide || decide.pending}>거부</Button>
                      <Button variant="secondary" size="sm" onClick={() => decide.run("escalate")} disabled={!canDecide || decide.pending}>이관</Button>
                    </div>
                    {reason && (
                      <div className="nx-decide-block">
                        <Icon name="x" size={14} strokeWidth={3} />
                        <div>
                          <strong>승인 버튼 비활성</strong>
                          <span>{reason}</span>
                          <button type="button" className="nx-linkbtn" onClick={() => decide.run("approve")}>
                            그래도 서버에 승인 요청 보내 보기
                          </button>
                        </div>
                      </div>
                    )}
                    {denied && (
                      <div className="nx-block-danger">
                        <div className="t">서버가 거부했습니다 · {denied.status} {denied.code}</div>
                        <div className="d">{denied.message}</div>
                      </div>
                    )}
                    <p className="caption">수정 요청은 의사결정 센터로 되돌리고, 이관은 운영 책임자에게 넘겨 영수증에 기록합니다.</p>
                  </>
                ) : (
                  <div className="nx-banner">
                    <Icon name="check" size={16} strokeWidth={3} />
                    <strong>{STATUS_LABEL[ap.status]}</strong>
                    <span>{ap.decided_by ? `${ROLE_LABEL[ap.decided_by]} · ${ap.decided_at}` : ""}</span>
                  </div>
                )}
                {decide.error != null && <ErrorState error={decide.error} />}
              </div>
            </Section>

            <Section title="승인 이력" desc="결정 영수증에 그대로 기록됩니다">
              <Card className="nx-fill-top">
                <ol className="nx-history">
                  {history.map((e) => (
                    <li key={e.seq} className={e.type === "blocked" ? "bad" : undefined}>
                      <span className="mono caption">{e.at}</span>
                      <span>{e.summary}</span>
                      <span className="caption">{e.actor === "system" ? "시스템" : ROLE_LABEL[e.actor as RoleId] ?? e.actor}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}
