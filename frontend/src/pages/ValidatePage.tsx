import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Candidate, Validation } from "@contracts/types";
import { api } from "@/api/client";
import { Button, Card, CheckRow, ErrorState, Icon, PageHeader, PageSkeleton, Section, StatusChip } from "@/components/common";
import { useAction, useApi } from "@/hooks/useApi";
import { useDemo } from "@/state/DemoContext";
import { recallValidation, rememberValidation } from "@/state/decisionCache";

// SCREEN 09 · 안전 검사 (Safety Gate) — AI가 고른 행동이나 운영자가 요청한 행동이 회사 정책상 허용되는지 독립 코드로 검사한다.
// 오른쪽 테스트는 정책 단계에서 이미 제외된 행동을 일부러 넣는 것이다. AI 후보가 아니다.


const VERDICT = {
  allowed: { title: "허용", body: "필수 제약을 모두 통과했고 승인이 필요 없는 행동입니다." },
  conditional: { title: "조건부 허용", body: "필수 제약을 통과했습니다. 권한자 승인 후 실행 직전에 다시 검사합니다." },
  blocked: { title: "차단 · 실행되지 않음", body: "필수 제약을 어겨 실행 큐에 들어가지 않습니다." },
} as const;

export default function ValidatePage() {
  const navigate = useNavigate();
  const { id = "DR-0412-01" } = useParams<{ id: string }>();
  const { setIds } = useDemo();

  // 1) 판단·후보·스냅샷 불러오기 — 검사 대상 = S0(실제 조건) 판단의 선택 행동
  const ctx = useApi(() => Promise.all([api.getReceipt(id), api.getPolicies(), api.getState("S0")]), [id]);
  const [main, setMain] = useState<Validation | null>(null);
  const [mainErr, setMainErr] = useState<unknown>(null);
  const started = useRef(false);

  const receipt = ctx.data?.[0];
  const actionId = receipt?.branches.find((b) => b.branch_id === "S0")?.selected_id;

  // 2) 화면에 들어오면 한 번만 검사(POST /api/validate). 이미 했으면 그 결과를 쓴다.
  useEffect(() => {
    if (!receipt || !actionId || started.current) return;
    started.current = true;
    const key = `${id}:${actionId}`;
    const prior = recallValidation(key) ?? receipt.validations.find((v) => v.action_id === actionId && v.origin === "model");
    if (prior) {
      setMain(prior);
      if (prior.approval_id) setIds({ approvalId: prior.approval_id });
      return;
    }
    api
      .validate({ decision_id: id, action_id: actionId, origin: "model" })
      .then((v) => {
        rememberValidation(key, v);
        setMain(v);
        if (v.approval_id) setIds({ approvalId: v.approval_id });
      })
      .catch(setMainErr);
  }, [receipt, actionId, id, setIds]);

  // 3) 강제 입력 테스트
  const [forcedId, setForcedId] = useState<string>("A-MIG-J07-N3");
  const [forced, setForced] = useState<Validation | null>(null);
  const test = useAction(async () => {
    const v = await api.validate({ decision_id: id, action_id: forcedId, origin: "operator_forced" });
    setForced(v);
  });

  const header = (
    <PageHeader
      crumbs={["의사결정", "안전 검사"]}
      title="안전 검사 · Safety Gate"
      right={
        <>
          <StatusChip variant="sim" />
          <StatusChip variant="independent" />
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

  const [rc, pol, snap] = ctx.data;
  const policyOf = (pid: string) => pol.policies.find((p) => p.id === pid);
  const candidates: Candidate[] = rc.candidates.length ? rc.candidates : pol.candidates;
  const action = candidates.find((c) => c.id === actionId);
  const forcedOptions = pol.candidates.filter((c) => c.filtered_out);
  const forcedCand = pol.candidates.find((c) => c.id === forcedId);
  const failed = forced?.checks.find((c) => c.result === "fail");
  const job = snap.jobs.find((j) => j.id === "J07");
  const target = forcedCand?.params.to ? snap.nodes.find((n) => n.id === forcedCand.params.to) : undefined;

  if (!actionId)
    return (
      <>
        {header}
        <div className="nx-content">
          <Card>
            <ErrorState error={new Error("아직 AI 판단이 없습니다. 의사결정 센터에서 판단을 먼저 실행하세요.")} onRetry={() => navigate(`/decision/${id}`)} />
          </Card>
        </div>
      </>
    );

  const recheck = action?.type === "job_migrate"
    ? [
        { k: "상태", v: `${String(action.params.to)} · N4 온도와 사용률` },
        { k: "용량", v: `${String(action.params.to)} 여유 GPU ${snap.nodes.find((n) => n.id === action.params.to)?.gpus_free ?? "—"}장 유지` },
        { k: "권한", v: "승인자 역할 = GPU 운영" },
        { k: "정책", v: `버전 v${rc.policy_version} 그대로` },
      ]
    : [
        { k: "상태", v: "대상 노드 온도와 사용률" },
        { k: "용량", v: "대상 자원 변화 없음" },
        { k: "권한", v: action?.requires_approval_role === "cooling_A" ? "승인자 역할 = 냉각 운영" : "승인 불필요" },
        { k: "정책", v: `버전 v${rc.policy_version} 그대로` },
      ];

  return (
    <>
      {header}
      <div className="nx-content">

        <div className="nx-split nx-split--gate">
          <Section title="검사 항목" desc="독립 검증 코드 · 모델 출력과 무관하게 실행" className="nx-split-main">
            <Card>
              <div className="nx-gate-target">
                <div>
                  <span className="caption">검사 대상 · AI 선택</span>
                  <strong>{action?.label ?? actionId}</strong>
                </div>
                <div className="nx-header-right">
                  <StatusChip variant={rc.provider === "zoro1" ? "zoro1" : "mock"} />
                  <StatusChip variant="neutral">운영 정책 v{rc.policy_version}</StatusChip>
                </div>
              </div>
              {main ? (
                <>
                  <table className="nx-table">
                    <thead>
                      <tr>
                        <th>검사</th>
                        <th style={{ width: 90 }}>정책</th>
                        <th>기준</th>
                        <th>현재 값</th>
                        <th style={{ width: 110 }}>결과</th>
                      </tr>
                    </thead>
                    <tbody>
                      {main.checks.map((c) => (
                        <CheckRow key={c.policy_id + c.name} check={c} policy={policyOf(c.policy_id)} />
                      ))}
                    </tbody>
                  </table>
                  <div className={`nx-banner nx-banner--${main.verdict}`}>
                    <Icon name={main.verdict === "blocked" ? "x" : main.verdict === "allowed" ? "check" : "alert"} size={18} strokeWidth={2.5} />
                    <strong>{VERDICT[main.verdict].title}</strong>
                    <span>{VERDICT[main.verdict].body}</span>
                  </div>
                </>
              ) : mainErr ? (
                <ErrorState error={mainErr} onRetry={() => window.location.reload()} />
              ) : (
                <div className="nx-skeleton" style={{ height: 240 }} />
              )}
            </Card>

            <Card title="실행 직전 재검사 항목" sub="승인 시점의 최신 상태로 다시 확인합니다">
              <div className="nx-recheck">
                {recheck.map((r) => (
                  <div key={r.k} className="nx-box">
                    <span className="caption">{r.k}</span>
                    <div>{r.v}</div>
                  </div>
                ))}
              </div>
            </Card>
          </Section>

          <Section title="안전 검사 테스트" desc="정책 단계에서 이미 제외된 행동을 일부러 넣어 봅니다" className="nx-split-side">
            <div className="nx-testpanel">
              <div className="nx-testpanel-head">
                <strong>입력할 행동</strong>
                <StatusChip variant="forced" />
              </div>
              <div className="nx-seg nx-seg--block">
                {forcedOptions.map((c) => (
                  <button type="button" key={c.id} className={forcedId === c.id ? "on" : ""} onClick={() => { setForcedId(c.id); setForced(null); }}>
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="caption">AI 후보가 아닙니다. 독립 검사가 실제로 막는지 확인하는 테스트입니다.</p>
              <Button variant="secondary" block onClick={() => test.run()} disabled={test.pending}>
                {test.pending ? "검사 중…" : "강제 입력 검사 실행"}
              </Button>

              {forced && (
                <>
                  {forcedCand?.type === "job_migrate" && job && target && (
                    <dl className="nx-kv" style={{ marginTop: 6 }}>
                      <dt>요청 GPU</dt><dd><strong>{job.gpus}장</strong></dd>
                      <dt>{target.id} 여유 GPU</dt><dd><strong>{target.gpus_free}장</strong></dd>
                    </dl>
                  )}
                  {forced.verdict === "blocked" ? (
                    <div className="nx-block-danger">
                      <div className="t">차단 · 실행되지 않음</div>
                      <div className="d">
                        {failed ? `${failed.name}: ${failed.observed} (${failed.policy_id})` : "필수 제약 위반"}
                      </div>
                    </div>
                  ) : (
                    <div className="nx-banner">검사를 통과했습니다: {VERDICT[forced.verdict].title}</div>
                  )}
                  <div>
                    <span className="caption">검사 로그</span>
                    <pre className="nx-code nx-code--light">{forced.log.join("\n")}</pre>
                  </div>
                  <p className="caption">차단 기록은 결정 영수증 {rc.decision_id}에 "테스트 차단"으로 남습니다.</p>
                </>
              )}
              {test.error != null && <ErrorState error={test.error} onRetry={() => test.run()} />}
            </div>
          </Section>
        </div>

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate(`/decision/${id}/futures`)}>
            허용된 대안 검토
          </Button>
          <Button
            arrow
            disabled={!main || main.verdict === "blocked" || !main.approval_id}
            disabledReason={main?.verdict === "blocked" ? "차단된 행동은 승인을 요청할 수 없습니다." : main && !main.approval_id ? "승인이 필요 없는 행동입니다." : undefined}
            onClick={() => main?.approval_id && navigate(`/approvals/${main.approval_id}`)}
          >
            담당자 승인 요청
          </Button>
        </div>
      </div>
    </>
  );
}
