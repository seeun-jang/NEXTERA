import { useNavigate } from "react-router-dom";
import type { Policy } from "@contracts/types";
import policySeed from "@seed/policy_v1.2.json";
import { Button, Card, Icon, PageHeader, PolicyTag, Section, StatusChip } from "@/components/common";
import { POLICY_TYPE_LABEL } from "@/components/screens/labels";
import { MAX_CANDIDATES } from "@/sim/model";
import { useRun } from "@/state/run";

// SCREEN 04 · 운영 정책 — 회사 규칙과 멈추기 규칙이 AI가 고를 수 있는 계획의 범위를 정한다.
const policies = (policySeed as unknown as { policies: Policy[] }).policies;

const STOP_RULES = [
  "더 급한 일만 다른 일을 멈출 수 있습니다 (우선순위가 더 높거나, 같은 우선순위에서 마감이 더 빠른 경우) · POL-09",
  "P0 일은 멈추거나 옮길 수 없습니다 (POL-01)",
  "멈춘 일은 그 노드 대기열 맨 앞으로 가고, 다시 시작할 때 재시작 지연이 생깁니다",
  "멈춘 일이 그 때문에 마감을 놓치는 계획은 후보에서 제외합니다 · POL-09",
];
const PERMS = [
  { action: "떠맡기기 · 새치기 · 임시 대피 · 연기", role: "B · GPU 운영" },
  { action: "냉각 변경", role: "A · 냉각 운영" },
  { action: "두 종류가 섞인 계획", role: "A와 B 모두" },
];

export default function PoliciesPage() {
  const navigate = useNavigate();
  const run = useRun();
  const { analysis } = run.rounds[0];
  const st = analysis.stats;
  const funnel = [
    { n: st.strategies, l: "전략", s: "열 분산 · 새치기 · 대피 · 냉각 …" },
    { n: st.built, l: "연쇄 계획", s: "문제가 없어질 때까지 행동 반복" },
    { n: st.merged, l: "정리 · 합치기", s: "불필요한 단계 제거, 같은 결과 합침" },
    { n: st.safe, l: "Safety Gate", s: "새 문제를 만드는 계획 제외" },
    { n: st.pareto, l: "열위 제거", s: "모든 면에서 뒤지는 계획 제외" },
  ];

  return (
    <>
      <PageHeader crumbs={["운영 정책"]} title="운영 정책 · Policies v1.2" right={<StatusChip variant="neutral">정책 v1.2 적용 중</StatusChip>} />
      <div className="nx-content">
        <div className="nx-split">
          <Section title="회사 규칙" desc="필수 제약은 어떤 승인으로도 풀리지 않습니다" className="nx-split-main">
            <Card>
              <table className="nx-table">
                <thead>
                  <tr><th>정책</th><th>유형</th><th>내용</th></tr>
                </thead>
                <tbody>
                  {policies.map((p) => (
                    <tr key={p.id}>
                      <td><PolicyTag id={p.id} policy={p} /></td>
                      <td><span className={`nx-ptype nx-ptype--${p.type}`}>{POLICY_TYPE_LABEL[p.type]}</span></td>
                      <td>{p.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>

          <Section title="AI에게 가는 후보" desc={`검증된 전략안만 Zoro-1에 전달 (최대 ${MAX_CANDIDATES}개)`} className="nx-split-side">
            <Card className="nx-fill-top">
              <div className="nx-funnel nx-funnel--v">
                {funnel.map((f) => (
                  <div key={f.l} className="nx-funnel-step">
                    <span className="n num">{f.n}</span>
                    <span className="l">{f.l}<small>{f.s}</small></span>
                  </div>
                ))}
                <div className="nx-funnel-step nx-funnel-step--out">
                  <span className="n num">{st.sent}</span>
                  <span className="l">Zoro-1 전달<small>{st.sent ? "이 안에서만 고릅니다" : "안전한 후보가 없어 사람에게 넘깁니다"}</small></span>
                </div>
              </div>
              {analysis.rejected.length > 0 && (
                <div className="nx-excluded">
                  <div className="caption">제외된 전략 · 계획</div>
                  {analysis.rejected.slice(0, 6).map((r, i) => (
                    <div key={i} className="nx-excluded-row">
                      <span className="nx-result nx-result--fail"><span className="nx-result-icon"><Icon name="x" size={12} strokeWidth={3} /></span></span>
                      <span><b>{r.strategy}</b> · {r.reason}{r.policy ? ` (${r.policy})` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Section>
        </div>

        <div className="nx-split">
          <Section title="멈추기 규칙" desc="새치기 · 연기로 다른 일을 멈출 때" className="nx-split-main">
            <Card>
              <ol className="nx-rulelist">
                {STOP_RULES.map((r) => <li key={r}>{r}</li>)}
              </ol>
            </Card>
          </Section>
          <Section title="역할별 승인" desc="한 계획에 두 역할의 승인이 모두 필요할 수 있습니다" className="nx-split-side">
            <Card>
              <table className="nx-table">
                <tbody>
                  {PERMS.map((p) => <tr key={p.action}><td>{p.action}</td><td className="strong">{p.role}</td></tr>)}
                </tbody>
              </table>
            </Card>
          </Section>
        </div>

        <div className="nx-actions">
          <Button arrow onClick={() => navigate(`/decision/1`)}>정책 적용 후 AI 판단</Button>
        </div>
      </div>
    </>
  );
}
