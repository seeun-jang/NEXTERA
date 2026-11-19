import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DecideResponse } from "@contracts/types";
import { api } from "@/api/client";
import { Button, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, PolicyTag, ProviderChip, Section, StatusChip } from "@/components/common";
import { CandidateList } from "@/components/screens/CandidateList";
import { FlowSteps } from "@/components/screens/FlowSteps";
import { useAction, useApi } from "@/hooks/useApi";
import { useDemo } from "@/state/DemoContext";
import { recallDecision, rememberDecision } from "@/state/decisionCache";

// SCREEN 05 · Zoro-1 의사결정 센터 — 정책을 통과한 후보 중 무엇을 골랐는지, 그 출력이 실제인지 예시인지 구분해 보여 준다.
// 판단은 버튼으로만 실행한다(화면을 열었다고 몰래 POST하지 않음).
const FALLBACK_LABEL: Record<string, string> = {
  MOCK_MODE: "MOCK 모드 · 서버 미연결",
  ZORO1_NOT_CONFIGURED: "Zoro-1 접속 정보 없음",
  TIMEOUT: "Zoro-1 응답 시간 초과",
  INVALID_OUTPUT: "Zoro-1 응답 형식 오류",
};

export default function DecisionPage() {
  const navigate = useNavigate();
  const { incidentId, setIds } = useDemo();
  const [result, setResult] = useState<DecideResponse | null>(() => recallDecision("S0"));
  const ctx = useApi(() => Promise.all([api.getState("S0"), api.getPolicies()]), []);
  const run = useAction(async () => {
    const res = await api.decide({ incident_id: incidentId, snapshot_id: "S0", policy_version: ctx.data?.[1].version ?? "1.2" });
    rememberDecision(res);
    setIds({ decisionId: res.decision.decision_id });
    setResult(res);
  });

  const d = result?.decision;
  const header = (
    <PageHeader
      crumbs={["의사결정", incidentId]}
      title="Zoro-1 의사결정 센터"
      right={
        <>
          <StatusChip variant="sim" />
          {d && <ProviderChip provider={d.provider} fallbackReason={d.fallback_reason} />}
        </>
      }
    />
  );
  if (ctx.loading && !ctx.data) return <>{header}<PageSkeleton /></>;
  if (ctx.error || !ctx.data)
    return (
      <>
        {header}
        <div className="nx-content">
          <Card>
            <ErrorState error={ctx.error} onRetry={ctx.reload} />
          </Card>
        </div>
      </>
    );

  const [snap, pol] = ctx.data;
  const n4 = snap.nodes.find((n) => n.flags.includes("rising")) ?? snap.nodes.reduce((a, n) => (n.temp_c > a.temp_c ? n : a));
  const job = snap.jobs.find((j) => n4.job_ids.includes(j.id));
  const spare = snap.nodes.find((n) => n.gpus_free > 0);
  const zone = snap.zones.find((z) => z.id === n4.zone_id);
  const note = snap.notes[0];
  const cands = result?.candidates ?? pol.candidates;
  const passed = cands.filter((c) => !c.filtered_out);
  const selected = d ? cands.find((c) => c.id === d.selected_id) : null;

  // 판단 요청 구조(§9 DecisionInput) 미리보기 — 실제 요청과 같은 모양
  const request = {
    state_summary: `${snap.snapshot_id} ${snap.sim_time} · ${n4.id} ${n4.temp_c}°C 상승 · ${job?.id} ${job?.priority} 마감 ${job?.deadline_min}분`,
    notes: note ? [note.text] : [],
    policy_summary: `정책 v${pol.version}`,
    options: passed.map((c) => c.id),
    criteria: "필수 제약 안에서 마감 준수 우선, 그다음 냉각 에너지",
  };

  return (
    <>
      {header}
      <div className="nx-content">
        <FlowSteps current="AI 판단" />

        <div className={`nx-modelbar${d?.provider === "zoro1" ? " live" : ""}`}>
          <div>
            <strong>모델 호출</strong>
            <span>
              {d
                ? d.provider === "zoro1"
                  ? `Zoro-1 응답 · ${d.latency_ms}ms`
                  : `${d.provider === "rule" ? "규칙 폴백 · " : ""}${FALLBACK_LABEL[d.fallback_reason ?? ""] ?? d.fallback_reason ?? "Zoro-1 미연결"}`
                : "아직 판단하지 않았습니다"}
            </span>
          </div>
          <div className="nx-modelbar-right">
            <span className="caption">실제 모델 출력 = 검정 배지 · MOCK = 점선 배지 · 시뮬레이터 추정 = 파란 배지</span>
          </div>
        </div>

        <div className="nx-split nx-split--even">
          <Section title="입력" desc="모델에 들어가는 상태 · 정책 · 메모" className="nx-split-main">
            <Card>
              <dl className="nx-kv nx-kv--wide">
                <dt>입력 스냅샷</dt>
                <dd className="mono">{snap.snapshot_id} · {snap.sim_time}</dd>
                <dt>{n4.id}</dt>
                <dd><strong>{n4.temp_c}°C · 상승 중</strong></dd>
                {job && (<><dt>{job.id} ({job.priority})</dt><dd>남은 {job.remaining_min}분 · 마감 {job.deadline_min}분 · GPU {job.gpus}장</dd></>)}
                {spare && (<><dt>{spare.id} 여유</dt><dd>GPU {spare.gpus_free}장</dd></>)}
                {zone && (<><dt>{zone.id} 냉각</dt><dd>레벨 {zone.cooling_level} / {zone.cooling_max}</dd></>)}
                <dt>정책 적용</dt>
                <dd>v{pol.version} · 후보 {cands.length} → {passed.length}</dd>
              </dl>
              <div className="nx-tags">
                {pol.policies.map((p) => (
                  <PolicyTag key={p.id} id={p.id} policy={p} />
                ))}
              </div>
              {note && (
                <div className="nx-note" style={{ marginTop: 14 }}>
                  <span className="caption">운영자 메모 · 원문 그대로 입력</span>
                  <div>{note.text}</div>
                </div>
              )}
              <details className="nx-details">
                <summary>판단 요청 구조 보기</summary>
                <pre className="nx-code">{JSON.stringify(request, null, 2)}</pre>
              </details>
            </Card>
          </Section>

          <Section title={`후보 행동 ${passed.length}개`} desc="코드가 만든 후보 · 모델은 이 안에서만 고릅니다" className="nx-split-side">
            <Card>
              {d ? (
                <>
                  <CandidateList candidates={cands} decision={d} />
                  {d.provider !== "zoro1" && <p className="caption" style={{ marginTop: 10 }}>후보별 확률은 실제 Zoro-1 응답일 때만 표시합니다.</p>}
                </>
              ) : (
                <EmptyState
                  title="아직 판단 결과가 없습니다"
                  description="정책을 통과한 후보로 판단을 실행하세요."
                  action={
                    <Button onClick={() => run.run()} disabled={run.pending}>
                      {run.pending ? "판단 중…" : "AI 판단 실행"}
                    </Button>
                  }
                />
              )}
            </Card>
          </Section>
        </div>

        {d && selected && (
          <Section title="판단 결과" desc="안전 검사 전 · 아직 실행되지 않았습니다">
            <div className="nx-verdict">
              <div className="nx-verdict-main">
                <span className="caption">선택한 행동</span>
                <strong>{selected.label}</strong>
                {d.rationale && <p>{d.rationale}</p>}
              </div>
              <div className="nx-verdict-side">
                <ProviderChip provider={d.provider} fallbackReason={d.fallback_reason} />
                <span className="mono caption">{d.decision_id} · {d.created_at}</span>
              </div>
            </div>
          </Section>
        )}

        {run.error != null && (
          <Card>
            <ErrorState error={run.error} onRetry={() => run.run()} />
          </Card>
        )}
        <div className="nx-actions">
          <Button variant="secondary" onClick={() => run.run()} disabled={run.pending}>
            {run.pending ? "판단 중…" : d ? "같은 입력으로 다시 판단" : "AI 판단 실행"}
          </Button>
          <Button arrow onClick={() => navigate("/lab/S0")} disabled={!d}>
            조건 변경 실험
          </Button>
        </div>
      </div>
    </>
  );
}
