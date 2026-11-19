import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Icon, PageHeader, Section, StatusChip } from "@/components/common";
import { IncidentList } from "@/components/screens/sim";
import { MAX_ROUNDS } from "@/sim/model";
import { STOP_TEXT, useRoundParam, useRun } from "@/state/run";

// SCREEN 10 · 회차 요약 — 실행 뒤 상태를 다음 회차의 기준으로 삼아 남은 문제를 다시 계산한다.
// 멈추는 조건: 남은 문제 없음 / 안전한 후보 없음 / 직전 회차와 남은 문제가 같음 / 최대 회차 → 앞의 셋 중 문제가 남으면 사람에게 넘김
export default function RoundPage() {
  const navigate = useNavigate();
  const { round } = useParams<{ round: string }>();
  const run = useRun();
  const r = useRoundParam(round);
  const plan = r.chosen;
  const solved = r.analysis.incidents.filter((x) => plan?.solved.includes(x.id));
  const remaining = plan?.remaining ?? r.analysis.incidents;
  const stop = r.stop;

  return (
    <>
      <PageHeader crumbs={["협업·승인", "회차 요약"]} title={`${r.no}회차 요약`} right={<StatusChip variant="sim" />} />
      <div className="nx-content">
        <div className="nx-rounds">
          {run.rounds.map((x) => (
            <span key={x.no} className={`nx-roundpill${x.no === r.no ? " on" : ""}${x.executed ? " done" : ""}`}>
              {x.no}회차 {x.executed ? "· 실행" : ""}
            </span>
          ))}
          <span className="caption">최대 {MAX_ROUNDS}회차</span>
        </div>

        <div className="nx-split">
          <Section title="해결된 문제" desc={plan ? `${plan.strategy} 실행 결과` : ""} className="nx-split-main">
            <Card>{solved.length ? <IncidentList items={solved} link={false} solved={solved.map((x) => x.id)} /> : <p className="caption">해결된 문제가 없습니다.</p>}</Card>
          </Section>
          <Section title="남은 문제" desc="실행 뒤 상태로 다시 계산" className="nx-split-side">
            <Card>{remaining.length ? <IncidentList items={remaining} link={false} /> : <p className="caption">남은 문제가 없습니다.</p>}</Card>
          </Section>
        </div>

        <div className={`nx-banner nx-banner--${stop === "done" ? "allowed" : stop ? "conditional" : "allowed"}`}>
          <Icon name={stop && stop !== "done" ? "users" : "check"} size={18} strokeWidth={2.2} />
          <strong>{stop ? (stop === "done" ? "판단 종료" : "사람에게 넘김") : `${r.no + 1}회차로`}</strong>
          <span>{stop ? STOP_TEXT[stop] : "남은 문제가 있어 같은 흐름으로 후보를 다시 만들고 Zoro-1이 다시 고릅니다."}</span>
        </div>

        <div className="nx-actions">
          {!stop && (
            <Button arrow onClick={async () => { await run.nextRound(r.no); navigate(`/decision/${r.no + 1}`); }}>{r.no + 1}회차 판단</Button>
          )}
          {stop && stop !== "done" && (
            <Button variant="secondary" onClick={() => navigate(`/decision/${r.no}/handoff`)}>사람에게 넘김 보기</Button>
          )}
          {stop && (
            <Button arrow onClick={() => navigate("/receipts")}>결정 영수증 확인</Button>
          )}
        </div>
      </div>
    </>
  );
}
