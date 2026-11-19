import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { RoleId } from "@contracts/types";
import { ROLE_LABEL } from "@/api/role";
import { Button, Card, Icon, PageHeader, ProviderChip, Section, StatusChip, Stepper } from "@/components/common";
import { StepList } from "@/components/screens/sim";
import { ROLE_NAME, type Role } from "@/sim/model";
import { useDemo } from "@/state/DemoContext";
import { useRoundParam, useRun } from "@/state/run";

// SCREEN 08 · 협업·승인 — 계획에 필요한 역할(A 냉각 · B GPU)이 각각 승인해야 실행된다. 한 계획에 둘 다 필요할 수 있다.
// 권한 없는 승인은 버튼 비활성 + 서버 거부(데모에서는 실행 상태가 거부) 두 겹.
export default function ApprovalPage() {
  const navigate = useNavigate();
  const { round } = useParams<{ round: string }>();
  const run = useRun();
  const r = useRoundParam(round);
  const { role, setRole } = useDemo();
  const [text, setText] = useState("");
  const [denied, setDenied] = useState<{ reason: string; policy: string } | null>(null);
  const plan = r.chosen;

  if (!plan) {
    return (
      <>
        <PageHeader crumbs={["협업·승인"]} title="협업·승인" />
        <div className="nx-content"><Card><p className="caption">승인할 계획이 없습니다.</p></Card></div>
      </>
    );
  }
  const pending = plan.roles.filter((x) => !r.approvals[x]);
  const canApprove = pending.includes(role as Role);
  const lastOne = pending.length === 1 && canApprove;
  const reason = pending.length && !canApprove ? `${pending.map((x) => ROLE_NAME[x]).join(", ")} 승인이 필요합니다. ${ROLE_LABEL[role]}에게는 이 계획을 승인할 권한이 없습니다.` : null;

  const approve = async () => {
    const need = (canApprove ? role : pending[0]) as Role;
    const res = await run.approve(r.no, need, role);
    if (!res.ok) {
      setDenied({ reason: res.reason, policy: res.policy });
      return;
    }
    setDenied(null);
    if (lastOne) {
      await run.execute(r.no);
      navigate(`/executions/${r.no}`);
    }
  };
  const submitComment = () => {
    if (!text.trim()) return;
    run.comment(r.no, role, text.trim());
    setText("");
  };

  return (
    <>
      <PageHeader crumbs={["협업·승인", `${r.no}회차`]} title="협업·승인" right={<><StatusChip variant="sim" /><ProviderChip provider="mock" /></>} />
      <div className="nx-content">
        <div className="nx-stepper-wrap">
          <Stepper
            steps={[
              { label: "AI 제안", state: "done" },
              { label: "안전 검사", state: "done" },
              { label: "승인", state: pending.length ? "current" : "done" },
              { label: "실행", state: r.executed ? "done" : "todo" },
            ]}
          />
        </div>

        <div className="nx-split">
          <div className="nx-col nx-split-main">
            <Section title="AI 제안" desc="안전 검사를 통과한 계획 · 원래 제안은 수정되지 않고 기록에 그대로 남습니다">
              <div className="nx-proposal">
                <div className="nx-proposal-main">
                  <span className="caption">{r.no}회차 · {plan.id}</span>
                  <strong>{plan.strategy}</strong>
                  <div className="nx-proposal-meta">
                    <StatusChip variant="neutral">안전 검사 · 조건부 허용</StatusChip>
                    <StatusChip variant="neutral">{plan.steps.length}단계 · 남는 문제 {plan.remaining.length}</StatusChip>
                  </div>
                </div>
                <div className="nx-proposal-status">
                  <span className="caption">상태</span>
                  <strong>{pending.length ? `승인 대기 ${pending.length}` : "승인 완료"}</strong>
                </div>
              </div>
              <Card>
                <StepList plan={plan} />
              </Card>
            </Section>

            <Section title="필요한 승인자" desc="단계마다 필요한 역할이 다릅니다 · 실행 상태가 한 번 더 확인합니다">
              <Card>
                <table className="nx-table">
                  <thead><tr><th>담당</th><th>승인할 단계</th><th style={{ width: 150 }}>상태</th></tr></thead>
                  <tbody>
                    {(["cooling_A", "gpu_B"] as Role[]).map((x) => {
                      const needed = plan.roles.includes(x);
                      const steps = plan.steps.map((s, i) => ({ s, i })).filter(({ s }) => (s.kind === "cool") === (x === "cooling_A"));
                      return (
                        <tr key={x} className={x === role ? "nx-row-me" : undefined}>
                          <td className="strong">{ROLE_NAME[x]} {x === role && <span className="nx-me">나</span>}</td>
                          <td>{needed ? steps.map(({ i }) => `${i + 1}단계`).join(", ") : <span className="muted">없음 · 의견만</span>}</td>
                          <td>{needed ? (r.approvals[x] ? `승인 · ${r.approvals[x]}` : "대기") : "참조"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </Section>

            <Section title="의견" desc="어느 역할이든 의견을 남길 수 있습니다">
              <Card>
                {r.comments.length ? (
                  <ul className="nx-comments">
                    {r.comments.map((c, i) => (
                      <li key={i}>
                        <span className="nx-avatar">{c.role === "cooling_A" ? "A" : c.role === "gpu_B" ? "B" : "관"}</span>
                        <div>
                          <div className="caption">{ROLE_LABEL[c.role as RoleId] ?? c.role} · {c.at}</div>
                          <p>{c.text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ fontSize: 13 }}>아직 의견이 없습니다.</p>
                )}
                <div className="nx-comment-input">
                  <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitComment()} placeholder={`${ROLE_LABEL[role]}(으)로 의견 입력…`} aria-label="의견 입력" />
                  <Button size="sm" variant="secondary" onClick={submitComment} disabled={!text.trim()}>의견 등록</Button>
                </div>
              </Card>
            </Section>
          </div>

          <div className="nx-col nx-split-side">
            <Section title="내 결정" desc="역할을 바꿔 가며 승인해 보세요">
              <div className="nx-decide">
                <div className="nx-decide-role">
                  <span className="caption">현재 역할</span>
                  <div className="nx-seg">
                    {(["operator", "cooling_A", "gpu_B"] as RoleId[]).map((x) => (
                      <button type="button" key={x} className={role === x ? "on" : ""} onClick={() => { setRole(x); setDenied(null); }}>
                        {ROLE_LABEL[x]}
                      </button>
                    ))}
                  </div>
                </div>
                {pending.length ? (
                  <>
                    <Button block arrow onClick={approve} disabled={!canApprove}>
                      {lastOne ? "승인하고 실행" : "승인"}
                    </Button>
                    {reason && (
                      <div className="nx-decide-block">
                        <Icon name="x" size={14} strokeWidth={3} />
                        <div>
                          <strong>승인 버튼 비활성</strong>
                          <span>{reason}</span>
                          <button type="button" className="nx-linkbtn" onClick={approve}>그래도 서버에 승인 요청 보내 보기</button>
                        </div>
                      </div>
                    )}
                    {denied && (
                      <div className="nx-block-danger">
                        <div className="t">거부됨 · 403 ROLE_FORBIDDEN · {denied.policy}</div>
                        <div className="d">{denied.reason}</div>
                      </div>
                    )}
                    <p className="caption">모든 필요한 역할이 승인하면 실행 직전에 최신 상태로 다시 검사한 뒤 가상 환경에서 실행합니다.</p>
                  </>
                ) : (
                  <>
                    <div className="nx-banner"><Icon name="check" size={16} strokeWidth={3} /><strong>승인 완료</strong></div>
                    {!r.executed ? (
                      <Button block arrow onClick={async () => { await run.execute(r.no); navigate(`/executions/${r.no}`); }}>실행</Button>
                    ) : (
                      <Button block arrow onClick={() => navigate(`/executions/${r.no}`)}>실행 결과 보기</Button>
                    )}
                  </>
                )}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}
