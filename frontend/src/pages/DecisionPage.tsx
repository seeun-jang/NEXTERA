import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Icon, PageHeader, ProviderChip, Section, StatusChip } from "@/components/common";
import { IncidentList, RoleChips, StepList } from "@/components/screens/sim";
import { MAX_CANDIDATES } from "@/sim/model";
import { useRoundParam } from "@/state/run";

// SCREEN 05 · 의사결정 센터 — 검증된 계획(후보) 중 Zoro-1이 무엇을 골랐는지 본다. 후보 하나 = 행동 여러 개로 이루어진 계획.
export default function DecisionPage() {
  const navigate = useNavigate();
  const { round } = useParams<{ round: string }>();
  const r = useRoundParam(round);
  const { analysis, chosen } = r;
  const provider = analysis.provider ?? "mock"; // 응답의 provider 에서 만든다 (mock 엔진이면 값이 없다)
  const live = provider === "zoro1";
  const probs = analysis.probs ?? null;
  const offered = analysis.offered ?? null;
  const how =
    provider === "zoro1"
      ? `Zoro-1 응답${analysis.agreement ? ` · 후보 순서를 바꿔 물어 ${analysis.agreement}번 1위` : ""}${analysis.latencyMs ? ` · ${Math.round(analysis.latencyMs)}ms` : ""}${analysis.needsReview ? " · 후보 간 차이가 작아 검토 권장" : ""}`
      : provider === "rule"
        ? `규칙 순위로 선택${analysis.fallbackReason && analysis.fallbackReason !== "RULE_MODE" ? ` (Zoro-1 호출 실패: ${analysis.fallbackReason})` : ""}`
        : "이 영상은 MOCK 응답 — 실제 모델 연결 시 후보별 확률 표시";

  const sentList = offered ? analysis.candidates.filter((c) => offered.includes(c.id)) : analysis.candidates;
  const restList = offered ? analysis.candidates.filter((c) => !offered.includes(c.id)) : [];
  const candRow = (c: (typeof analysis.candidates)[number]) => (
    <li key={c.id} className={`nx-cand nx-cand--plan${c.id === chosen?.id ? " selected" : ""}`}>
      <span className="nx-cand-dot" aria-hidden="true">{c.id === chosen?.id && <Icon name="check" size={12} strokeWidth={3} />}</span>
      <div className="nx-cand-body">
        <div className="nx-cand-title">
          <strong>{c.strategy}</strong>
          <span className="mono caption">
            {c.id} · {c.steps.length}단계{c.pruned ? ` · 불필요한 단계 ${c.pruned}개 제거` : ""}
            {probs && probs[c.id] !== undefined ? ` · 확률 ${Math.round(probs[c.id] * 100)}%` : ""}
          </span>
        </div>
        <span className="nx-cand-steps">{c.stepText.join(" → ")}</span>
        <span className="nx-cand-meta">
          <b className={c.remaining.length ? "warn" : ""}>{c.remaining.length ? `남는 문제 ${c.remaining.length}` : "남는 문제 없음"}</b>
          <span>최고 {c.peak}°C</span>
          <span>냉각 {c.energy}kWh</span>
          <RoleChips roles={c.roles} />
        </span>
      </div>
      {c.id === chosen?.id && (
        <StatusChip variant={provider === "zoro1" ? "zoro1" : "mock"}>{provider === "zoro1" ? "Zoro-1 선택" : provider === "rule" ? "규칙 선택" : "모의 선택"}</StatusChip>
      )}
    </li>
  );

  return (
    <>
      <PageHeader crumbs={["의사결정", `${r.no}회차`]} title="의사결정 센터 · Zoro-1" right={<><StatusChip variant="sim" /><ProviderChip provider={provider} fallbackReason={analysis.fallbackReason} /></>} />
      <div className="nx-content">
        <div className={`nx-modelbar${live ? " live" : ""}`}>
          <Icon name="sparkle" size={18} />
          <strong>Zoro-1 판단</strong>
          <span className="caption">
            {r.no}회차 · 검증된 후보 {analysis.candidates.length}개 중 {offered ? sentList.length : analysis.stats.sent}개를 Zoro-1에 전달{offered ? "" : ` (최대 ${MAX_CANDIDATES})`} · {how}
          </span>
        </div>

        {r.no > 1 && (
          <Section title={`${r.no}회차에 남은 문제`} desc="직전 회차 실행 뒤 다시 계산">
            <Card><IncidentList items={analysis.incidents} /></Card>
          </Section>
        )}

        {chosen ? (
          <div className="nx-verdict">
            <div className="nx-verdict-main">
              <span className="caption">AI 선택 · {chosen.id}</span>
              <strong>{chosen.strategy}</strong>
              <p>{analysis.rationale}</p>
            </div>
            <div className="nx-verdict-side">
              <StepList plan={chosen} />
              <div className="nx-verdict-meta">
                <span>필요 승인</span>
                <RoleChips roles={chosen.roles} />
              </div>
            </div>
          </div>
        ) : (
          <div className="nx-handoff">
            <span className="nx-handoff-icon" aria-hidden="true"><Icon name="users" size={26} strokeWidth={1.8} /></span>
            <div className="nx-handoff-main">
              <span className="caption">AI가 이 판단을 사람에게 넘깁니다</span>
              <strong>안전한 후보가 없습니다</strong>
              <p>{analysis.rationale}</p>
            </div>
          </div>
        )}

        <Section
          title={offered ? `Zoro-1에 전달한 후보 · ${sentList.length}개` : "검증된 후보"}
          desc={offered ? "검증을 통과한 계획 중 규칙 순위 상위만 전달합니다 · Zoro-1은 이 안에서만 고릅니다" : "전략마다 행동을 이어 붙여 만든 계획 · Safety Gate와 시뮬레이션을 통과한 것만"}
        >
          <ul className="nx-cands">
            {sentList.map(candRow)}
            {!analysis.candidates.length && <li className="caption">Safety Gate를 통과한 후보가 없습니다.</li>}
          </ul>
        </Section>

        {restList.length > 0 && (
          <Section
            title={`전달하지 않은 후보 · ${restList.length}개`}
            desc="Safety Gate와 시뮬레이션은 통과했지만 규칙 순위가 낮아 Zoro-1 선택지에 넣지 않았습니다 (후보가 많으면 모델의 선택이 제시 순서에 흔들립니다)"
          >
            <ul className="nx-cands">{restList.map(candRow)}</ul>
          </Section>
        )}

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate("/scenario")}>상황 다시 설정</Button>
          {chosen ? (
            <Button arrow onClick={() => navigate(`/decision/${r.no}/futures`)}>대안별 결과 보기</Button>
          ) : (
            <Button arrow onClick={() => navigate(`/decision/${r.no}/handoff`)}>사람에게 넘김 보기</Button>
          )}
        </div>
      </div>
    </>
  );
}
