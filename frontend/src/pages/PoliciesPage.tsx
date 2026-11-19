import { useNavigate } from "react-router-dom";
import type { ActionType, Policy } from "@contracts/types";
import { api } from "@/api/client";
import { Button, Card, ErrorState, Icon, PageHeader, PageSkeleton, PolicyTag, Section, StatusChip } from "@/components/common";
import { FlowSteps } from "@/components/screens/FlowSteps";
import { POLICY_TYPE_LABEL } from "@/components/screens/labels";
import { useAction, useApi } from "@/hooks/useApi";
import { useDemo } from "@/state/DemoContext";
import { rememberDecision } from "@/state/decisionCache";

// SCREEN 04 · 운영 정책 — 회사 규칙이 AI가 고를 수 있는 행동의 범위를 정한다는 것을 보여 준다.
// 매뉴얼 발췌는 정책 문서의 문구(수치 아님)라 화면에 둔다. 정책 수정 기능은 P2(구현 안 함).
const MANUAL = {
  section: "4.2 고온 대응 · 시연용",
  text: "노드 온도가 85°C에 이를 것으로 예측되면 작업 우선순위와 정비 일정을 확인한 뒤, 냉각 강화·작업 재배치·저우선 작업 연기 중에서 선택한다. P1 이상 작업의 이동은 담당 승인 후 실행한다.",
};

const PERMS: { key: ActionType | "policy"; label: string }[] = [
  { key: "cooling_change", label: "냉각 변경 승인" },
  { key: "job_migrate", label: "작업 이동 승인" },
  { key: "job_defer", label: "작업 연기 확인" },
  { key: "policy", label: "정책 수정" },
];

function TypeChip({ type }: { type: Policy["type"] }) {
  return <span className={`nx-ptype nx-ptype--${type}`}>{POLICY_TYPE_LABEL[type]}</span>;
}

export default function PoliciesPage() {
  const navigate = useNavigate();
  const { incidentId, setIds } = useDemo();
  const { data, error, loading, reload } = useApi(() => api.getPolicies(), []);
  const decide = useAction(async () => {
    const res = await api.decide({ incident_id: incidentId, snapshot_id: "S0", policy_version: data?.version ?? "1.2" });
    rememberDecision(res);
    setIds({ decisionId: res.decision.decision_id });
    navigate(`/decision/${res.decision.decision_id}`);
  });

  const header = (
    <PageHeader
      crumbs={["운영 정책", "활성 정책"]}
      title="운영 정책"
      right={data && <StatusChip variant="neutral">운영 정책 v{data.version} · 시연용</StatusChip>}
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

  const count = (t: Policy["type"]) => data.policies.filter((p) => p.type === t).length;
  const passed = data.candidates.filter((c) => !c.filtered_out);
  const excluded = data.candidates.filter((c) => c.filtered_out);
  const needApproval = passed.filter((c) => c.requires_approval_role).length;
  const roles = data.roles;

  return (
    <>
      {header}
      <div className="nx-content">
        <FlowSteps current="정책 확인" />

        <div className="nx-split">
          <Section
            title={`활성 정책 ${data.policies.length}개`}
            desc={`필수 제약 ${count("hard")} · 승인 요건 ${count("approval")} · 최적화 목표 ${count("objective")} — 필수 제약은 어떤 승인으로도 풀리지 않습니다.`}
            className="nx-split-main"
          >
            <Card>
              <table className="nx-table">
                <thead>
                  <tr>
                    <th style={{ width: 84 }}>ID</th>
                    <th>정책</th>
                    <th style={{ width: 110 }}>유형</th>
                    <th style={{ width: 100 }}>대상</th>
                  </tr>
                </thead>
                <tbody>
                  {data.policies.map((p) => (
                    <tr key={p.id} className={p.type === "hard" ? "row-strong" : undefined}>
                      <td><PolicyTag id={p.id} policy={p} /></td>
                      <td className={p.type === "hard" ? "strong" : undefined}>{p.text}</td>
                      <td><TypeChip type={p.type} /></td>
                      <td className="muted">{p.scope}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>

          <Section title="AI가 고를 수 있는 행동 범위" desc="정책은 추천이 아니라 선택지의 경계입니다" className="nx-split-side">
            <Card className="nx-fill-top">
              <div className="nx-funnel">
                <div className="nx-funnel-step">
                  <span className="n num">{data.candidates.length}</span>
                  <span className="l">전체 후보<small>코드가 스냅샷에서 생성</small></span>
                </div>
                <div className="nx-funnel-arrow" aria-hidden="true">
                  <Icon name="arrow-right" size={18} />
                </div>
                <div className="nx-funnel-step nx-funnel-step--out">
                  <span className="n num">{passed.length}</span>
                  <span className="l">AI 판단 대상<small>필수 제약 통과 · 이 중 {needApproval}개는 승인 필요</small></span>
                </div>
              </div>
              <div className="nx-excluded">
                <div className="caption">모델에 전달되지 않는 후보</div>
                {excluded.map((c) => (
                  <div key={c.id} className="nx-excluded-row">
                    <span className="nx-result nx-result--fail">
                      <span className="nx-result-icon">
                        <Icon name="x" size={12} strokeWidth={3} />
                      </span>
                    </span>
                    <span className="lbl">{c.label}</span>
                    {c.filter_reason && <PolicyTag id={c.filter_reason} policy={data.policies.find((p) => p.id === c.filter_reason)} />}
                  </div>
                ))}
              </div>
            </Card>
          </Section>
        </div>

        <div className="nx-split">
          <Section title="역할별 권한" desc="승인은 권한 있는 역할만 할 수 있고, 서버가 한 번 더 확인합니다" className="nx-split-main">
            <Card>
              <table className="nx-table nx-table--center">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>역할</th>
                    {PERMS.map((p) => (
                      <th key={p.key}>{p.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.id}>
                      <td className="strong" style={{ textAlign: "left" }}>{r.label}</td>
                      {PERMS.map((p) => {
                        const ok = p.key === "policy" ? r.can_edit_policy : r.can_approve.includes(p.key);
                        return (
                          <td key={p.key}>
                            {ok ? (
                              <span className="nx-result nx-result--pass">
                                <span className="nx-result-icon">
                                  <Icon name="check" size={12} strokeWidth={3} />
                                </span>
                                허용
                              </span>
                            ) : (
                              <span className="nx-dash">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>

          <Section title="운영 매뉴얼 발췌" desc={MANUAL.section} className="nx-split-side">
            <Card className="nx-fill-top">
              <blockquote className="nx-quote">{MANUAL.text}</blockquote>
              <p className="caption" style={{ marginTop: 10 }}>모델이 매뉴얼을 읽었다는 사실로 준수를 보장하지 않습니다. 규칙과 서버 검증 코드가 실행 허용 여부를 판정합니다.</p>
            </Card>
          </Section>
        </div>

        {decide.error != null && (
          <Card>
            <ErrorState error={decide.error} onRetry={() => decide.run()} />
          </Card>
        )}
        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate(`/incidents/${incidentId}`)}>
            사건 상세로
          </Button>
          <Button arrow onClick={() => decide.run()} disabled={decide.pending}>
            {decide.pending ? "Zoro-1 판단 중…" : "정책 적용 후 AI 판단"}
          </Button>
        </div>
      </div>
    </>
  );
}
