import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Icon, PageHeader, Section, StatusChip } from "@/components/common";
import { IncidentList } from "@/components/screens/sim";
import { ROLE_NAME } from "@/sim/model";
import { STOP_TEXT, useRoundParam } from "@/state/run";

// SCREEN 08′ · 사람에게 넘김 — 안전한 후보가 없거나 회차를 반복해도 문제가 남을 때. 설비는 건드리지 않고 요청과 이유를 남긴다.
export default function HandoffPage() {
  const navigate = useNavigate();
  const { round } = useParams<{ round: string }>();
  const r = useRoundParam(round);
  const left = r.executed && r.chosen ? r.chosen.remaining : r.analysis.incidents;
  const why = r.stop ? STOP_TEXT[r.stop] : "Safety Gate를 통과한 후보가 없습니다";
  const heat = left.some((x) => x.kind === "heat");
  const late = left.some((x) => x.kind === "deadline");
  const asks = [
    ...(heat ? ["과열 노드의 팬 · 냉각 상태를 현장에서 확인", "필요하면 냉각 상한 조정 검토"] : []),
    ...(late ? ["마감을 늦출 수 있는지 작업 요청자와 협의", "다른 클러스터로 넘길 수 있는지 확인"] : []),
    "조건이 바뀌면 같은 흐름으로 다시 판단 요청",
  ];

  return (
    <>
      <PageHeader crumbs={["의사결정", "사람에게 넘김"]} title="사람에게 넘김 · Human Handoff" right={<StatusChip variant="sim" />} />
      <div className="nx-content">
        <div className="nx-handoff">
          <span className="nx-handoff-icon" aria-hidden="true"><Icon name="users" size={26} strokeWidth={1.8} /></span>
          <div className="nx-handoff-main">
            <span className="caption">AI가 이 판단을 관제 운영자에게 넘겼습니다</span>
            <strong>안전하게 풀 수 있는 계획이 없습니다</strong>
            <p>{why}. 무리해서 실행하지 않고, 승인 · 실행 단계로도 가지 않습니다.</p>
          </div>
          <div className="nx-handoff-side">
            <span className="nx-handoff-pick">운영자 호출</span>
            <span className="caption">{r.no}회차 · 설비 조작 없음</span>
          </div>
        </div>

        <div className="nx-split">
          <div className="nx-col nx-split-main">
            <Section title="남은 문제" desc="사람이 판단해야 할 사건">
              <Card><IncidentList items={left} link={false} /></Card>
            </Section>
            {r.analysis.rejected.length > 0 && (
              <Section title="제외된 전략" desc="왜 자동으로 풀지 못했나">
                <Card>
                  <ul className="nx-rulelist">
                    {r.analysis.rejected.slice(0, 8).map((x, i) => <li key={i}><b>{x.strategy}</b> · {x.reason}{x.policy ? ` (${x.policy})` : ""}</li>)}
                  </ul>
                </Card>
              </Section>
            )}
          </div>
          <Section title="보낸 요청" desc="응답 기한은 승인 요청과 같은 5분으로 가정" className="nx-split-side">
            <Card className="nx-ticket">
              <div className="nx-ticket-head">
                <span className="mono caption">ESC-R{r.no}</span>
                <StatusChip variant="mock">응답 대기 · 알림은 MOCK</StatusChip>
              </div>
              <dl className="nx-ticket-rows">
                <div><dt>받는 사람</dt><dd>관제 운영자 · {ROLE_NAME.gpu_B} · {ROLE_NAME.cooling_A}</dd></div>
                <div><dt>요청</dt><dd>자동으로 고를 수 있는 안전한 계획이 없습니다. 사람이 직접 판단해 주세요.</dd></div>
              </dl>
              <div className="nx-ticket-list">
                <span className="caption">확인할 일</span>
                <ul>{asks.map((t) => <li key={t}><span className="nx-ticket-box" aria-hidden="true" />{t}</li>)}</ul>
              </div>
            </Card>
          </Section>
        </div>

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate("/scenario")}>상황 다시 설정</Button>
          <Button arrow onClick={() => navigate("/receipts")}>결정 영수증 확인</Button>
        </div>
      </div>
    </>
  );
}
