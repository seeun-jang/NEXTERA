import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ActionType, Candidate, RoleId } from "@contracts/types";
import { api } from "@/api/client";
import { ROLE_LABEL } from "@/api/role";
import { Button, Card, ErrorState, Icon, PageHeader, PageSkeleton, ProviderChip, Section, StatusChip } from "@/components/common";
import { isHandoff } from "@/components/screens/labels";
import { useApi } from "@/hooks/useApi";
import { recallDecision } from "@/state/decisionCache";
import { describe, loadScenario } from "@/state/scenario";

// SCREEN 08′ · 사람에게 넘김 — AI가 설비 조작 대신 "운영자 호출" 또는 "추가 정보 요청"을 고른 경우.
// 승인·실행 단계로 가지 않고, 누구에게 무엇을 요청했는지와 그 이유를 보여 준 뒤 결정 영수증으로 이어진다.
// ?as=request_info|escalate : 실제로 선택되지 않은 행동을 "선택되면 이렇게 됩니다"로 미리 본다 (화면에 미리보기 표시)

type HandoffType = Extract<ActionType, "request_info" | "escalate">;

const CONTENT: Record<HandoffType, { title: string; lead: string; to: RoleId[]; ask: string; listTitle: string; list: string[]; fallback: string }> = {
  escalate: {
    title: "실행할 설비 조작이 없습니다",
    lead: "AI가 이 결정을 관제 운영자에게 넘겼습니다",
    to: ["operator", "gpu_B", "cooling_A"],
    ask: "지금 조건에서는 회사 규칙과 마감을 함께 지키는 행동이 없습니다. 사람이 직접 판단해 주세요.",
    listTitle: "운영자가 확인할 일",
    list: ["N4 온도와 팬 상태를 현장에서 확인", "J07 마감을 늦출 수 있는지 작업 요청자와 협의", "조건이 바뀌면 같은 사건으로 다시 판단 요청"],
    fallback: "마감과 열 한계를 함께 지키는 허용 후보가 없어 운영자에게 넘깁니다.",
  },
  request_info: {
    title: "판단에 필요한 정보가 부족합니다",
    lead: "AI가 실행하기 전에 정보를 먼저 요청했습니다",
    to: ["operator", "cooling_A"],
    ask: "아래 정보가 확인되면 같은 조건으로 다시 판단합니다. 그전까지 설비는 그대로 둡니다.",
    listTitle: "요청한 정보",
    list: ["N4 팬의 실제 상태와 교체 예정 시각", "J07 체크포인트 저장 시점 (옮기면 재시작 시간이 얼마나 드는지)", "N2 등 옮길 수 있는 노드에 여유 GPU가 있는지"],
    fallback: "입력 정보가 불확실해 바로 실행하지 않고 확인을 먼저 요청합니다.",
  },
};


function resultOf(c: Candidate, selectedId: string | undefined): { text: string; tone: "danger" | "muted" | "ink" } {
  if (c.id === selectedId) return { text: "AI 선택", tone: "ink" };
  if (c.filtered_out) return { text: `정책 차단 · ${c.filter_reason}`, tone: "danger" };
  return { text: "허용됐지만 선택되지 않음", tone: "muted" };
}

export default function HandoffPage() {
  const navigate = useNavigate();
  const { id = "DR-0412-01" } = useParams<{ id: string }>();
  const [sp] = useSearchParams();
  const asParam = sp.get("as");
  const as: HandoffType | null = asParam === "request_info" || asParam === "escalate" ? asParam : null;

  const { data, error, loading, reload } = useApi(async () => ({ rc: await api.getReceipt(id) }), [id]);

  const header = (
    <PageHeader
      crumbs={["의사결정", "사람에게 넘김"]}
      title="사람에게 넘김 · Human Handoff"
      right={
        <>
          <StatusChip variant="sim" />
          {data && <ProviderChip provider={data.rc.provider} />}
        </>
      }
    />
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

  const { rc } = data;
  const cands = rc.candidates;
  const selectedId = rc.branches.find((b) => b.branch_id === "S0")?.selected_id;
  const selected = cands.find((c) => c.id === selectedId);
  const real = isHandoff(selected) && (!as || selected!.type === as);
  const kind: HandoffType = real ? (selected!.type as HandoffType) : as ?? "escalate";
  const target = cands.find((c) => c.type === kind);
  const content = CONTENT[kind];
  const rationale = real ? recallDecision("S0")?.decision.rationale ?? content.fallback : content.fallback;
  const changes = describe(loadScenario().changes);
  const equipment = cands.filter((c) => !isHandoff(c));

  return (
    <>
      {header}
      <div className="nx-content">
        {!real && (
          <div className="nx-preview-note">
            <Icon name="info" size={16} />
            <span>
              <b>미리보기</b> · 이번 판단에서 AI가 고른 행동은 "{selected?.label ?? selectedId}"입니다. 아래는 AI가 "{target?.label ?? kind}"을(를) 골랐을 때 이어지는 화면입니다.
            </span>
          </div>
        )}

        <div className="nx-handoff">
          <span className="nx-handoff-icon" aria-hidden="true">
            <Icon name={kind === "escalate" ? "users" : "inbox"} size={26} strokeWidth={1.8} />
          </span>
          <div className="nx-handoff-main">
            <span className="caption">{content.lead}</span>
            <strong>{content.title}</strong>
            <p>{rationale}</p>
          </div>
          <div className="nx-handoff-side">
            <span className="nx-handoff-pick">{target?.label ?? kind}</span>
            <span className="caption">설비 조작 없음 · 승인과 실행 단계로 가지 않습니다</span>
          </div>
        </div>

        <div className="nx-split">
          <div className="nx-col nx-split-main">
            <Section title="왜 사람에게 넘겼나요" desc={changes.length ? `설정한 상황: ${changes.join(" · ")}` : "기본 상황에서의 판단"}>
              <Card>
                <table className="nx-table">
                  <thead>
                    <tr>
                      <th>설비 조작 후보</th>
                      <th>승인 요건</th>
                      <th>결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.map((c) => {
                      const r = resultOf(c, selectedId);
                      return (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.label}</strong>
                            <span className="mono caption" style={{ marginLeft: 8 }}>{c.id}</span>
                          </td>
                          <td className="muted">{c.requires_approval_role ? ROLE_LABEL[c.requires_approval_role] : "—"}</td>
                          <td>
                            <span className={`nx-handoff-result nx-handoff-result--${r.tone}`}>{r.text}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="caption" style={{ marginTop: 12 }}>
                  AI는 정책을 통과한 후보 안에서만 고릅니다. 안전하게 실행할 수 있는 설비 조작이 없으면 무리해서 고르지 않고 사람에게 넘깁니다.
                </p>
              </Card>
            </Section>

            <Section title="이후 흐름" desc="설비는 건드리지 않고 기록만 남깁니다">
              <ol className="nx-handoff-steps">
                <li>
                  <b>요청 전달</b>
                  <span>담당자에게 알림을 보냅니다. 데모에서는 실제로 발송하지 않습니다.</span>
                </li>
                <li>
                  <b>사람이 판단</b>
                  <span>{kind === "escalate" ? "운영자가 직접 조치하거나 조건을 바꿔 다시 판단을 요청합니다." : "정보가 확인되면 같은 조건으로 다시 판단합니다."}</span>
                </li>
                <li>
                  <b>기록</b>
                  <span>누가 무엇을 왜 넘겼는지가 결정 영수증에 그대로 남습니다.</span>
                </li>
              </ol>
            </Section>
          </div>

          <Section title="보낸 요청" desc="응답 기한은 승인 요청과 같은 5분으로 가정" className="nx-split-side">
            <Card className="nx-ticket">
              <div className="nx-ticket-head">
                <span className="mono caption">{kind === "escalate" ? "ESC" : "INFO"}-{id.replace("DR-", "")}</span>
                <StatusChip variant="mock">응답 대기 · 알림은 MOCK</StatusChip>
              </div>
              <dl className="nx-ticket-rows">
                <div>
                  <dt>받는 사람</dt>
                  <dd>{content.to.map((r) => ROLE_LABEL[r]).join(" · ")}</dd>
                </div>
                <div>
                  <dt>요청</dt>
                  <dd>{content.ask}</dd>
                </div>
              </dl>
              <div className="nx-ticket-list">
                <span className="caption">{content.listTitle}</span>
                <ul>
                  {content.list.map((t) => (
                    <li key={t}>
                      <span className="nx-ticket-box" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </Section>
        </div>

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate("/scenario")}>
            상황 다시 설정
          </Button>
          <Button arrow onClick={() => navigate(`/receipts/${id}`)}>
            결정 영수증 확인
          </Button>
        </div>
      </div>
    </>
  );
}
