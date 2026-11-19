import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ExperimentChanges, Priority, Snapshot } from "@contracts/types";
import { api } from "@/api/client";
import { Button, Card, ErrorState, Icon, PageHeader, PageSkeleton, PolicyTag, Section, StatusChip } from "@/components/common";
import { useAction, useApi } from "@/hooks/useApi";
import { useDemo } from "@/state/DemoContext";

// SCREEN 06 · 조건 실험 (Dynamic Constraint Lab) — 스냅샷 복사본에서 조건만 바꿔 후보 생성 → 정책 검사 → 판단을 새로 실행한다.
// 실제 운영 값은 바뀌지 않는다. 실험 값은 영수증에 "가정"으로 남는다.
type Key = keyof ExperimentChanges;
type Objective = NonNullable<ExperimentChanges["objective"]>;

interface Cond {
  key: Key;
  label: string;
  unit?: string;
  kind: "number" | "priority" | "objective";
  min?: number;
  max?: number;
  step?: number;
  actual: (s: Snapshot) => number | string;
  format?: (v: number | string) => string;
}

const OBJ_LABEL: Record<Objective, string> = { energy: "에너지", balanced: "균형", performance: "성능" };

const CONDS: Cond[] = [
  { key: "deadline_min", label: "작업 마감 (J07)", unit: "분", kind: "number", min: 1, max: 15, step: 1, actual: (s) => s.jobs.find((j) => j.id === "J07")?.deadline_min ?? 5 },
  { key: "cooling_max", label: "냉각 용량 (Z2 최대 레벨)", kind: "number", min: 3, max: 5, step: 1, actual: (s) => s.zones.find((z) => z.id === "Z2")?.cooling_max ?? 5, format: (v) => `레벨 ${v}` },
  { key: "n2_gpus_free", label: "GPU 가용성 (N2 여유)", unit: "장", kind: "number", min: 0, max: 8, step: 1, actual: (s) => s.nodes.find((n) => n.id === "N2")?.gpus_free ?? 0, format: (v) => `GPU ${v}장` },
  { key: "j07_priority", label: "작업 우선순위 (J07)", kind: "priority", actual: (s) => s.jobs.find((j) => j.id === "J07")?.priority ?? "P1" },
  { key: "objective", label: "목표 (에너지 ↔ 성능)", kind: "objective", actual: () => "balanced", format: (v) => OBJ_LABEL[v as Objective] },
  { key: "approval_delay_min", label: "승인 지연 (추정)", unit: "분", kind: "number", min: 0, max: 3, step: 0.5, actual: () => 0.5 },
];

const fmt = (c: Cond, v: number | string) => (c.format ? c.format(v) : `${v}${c.unit ?? ""}`);

export default function LabPage() {
  const navigate = useNavigate();
  const { snapshot = "S0" } = useParams<{ snapshot: string }>();
  const { decisionId, setIds } = useDemo();
  const ctx = useApi(() => Promise.all([api.getState(snapshot), api.getPolicies()]), [snapshot]);
  const [changes, setChanges] = useState<ExperimentChanges>({});
  const run = useAction(async () => {
    const exp = await api.createExperiment({
      decision_id: decisionId ?? "DR-0412-01",
      base_snapshot_id: snapshot,
      changes,
      policy_version: ctx.data?.[1].version ?? "1.2",
    });
    setIds({ branchId: exp.branch_id, decisionId: exp.decision.decision_id });
    navigate(`/lab/${exp.branch_id}/compare`);
  });

  const header = (
    <PageHeader
      crumbs={["조건 실험", "INC-0412"]}
      title="조건 실험 · Dynamic Constraint Lab"
      right={
        <>
          <StatusChip variant="sim" />
          <StatusChip variant="neutral">기준 스냅샷 {snapshot}</StatusChip>
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
  const hard = pol.policies.filter((p) => p.type === "hard" || p.type === "approval").slice(0, 5);
  const changedKeys = (Object.keys(changes) as Key[]).filter((k) => changes[k] !== undefined);

  const set = (c: Cond, v: number | string) => {
    const actual = c.actual(snap);
    setChanges((prev) => {
      const next = { ...prev } as Record<string, unknown>;
      if (v === actual) delete next[c.key];
      else next[c.key] = v;
      return next as ExperimentChanges;
    });
  };
  const valueOf = (c: Cond) => (changes[c.key] ?? c.actual(snap)) as number | string;
  const preset = (deadline: number) => setChanges({ deadline_min: deadline });

  const request = { snapshot, changes, policy_version: pol.version, candidates: "regenerate" };

  return (
    <>
      {header}
      <div className="nx-content">
        <div className="nx-labintro">
          <Icon name="flask" size={20} />
          <span>
            <strong>운영 조건을 바꿨을 때 AI 판단이 어떻게 달라지는지 확인합니다.</strong> 미리 만든 결과를 재생하지 않고, 바뀐 조건으로 후보 생성 · 정책 검사 · 모델 판단을 다시 실행합니다.
          </span>
        </div>

        <div className="nx-split">
          <Section
            title="바꿀 조건"
            desc="조건은 한 번에 하나씩 바꿔 비교합니다. 실험 값은 운영에 적용되지 않습니다."
            right={
              <div className="nx-presets">
                <span className="caption">빠른 설정</span>
                <button type="button" className={changes.deadline_min === 3 && changedKeys.length === 1 ? "on" : ""} onClick={() => preset(3)}>마감 3분으로</button>
                <button type="button" className={changes.deadline_min === 8 && changedKeys.length === 1 ? "on" : ""} onClick={() => preset(8)}>마감 8분으로</button>
                <button type="button" className={changes.deadline_min === 2 && changedKeys.length === 1 ? "on" : ""} onClick={() => preset(2)} title="어떤 설비 조작도 마감 안에 끝나지 않는 조건">마감 2분으로</button>
                <button type="button" onClick={() => setChanges({})} disabled={!changedKeys.length}>원래 값으로</button>
              </div>
            }
            className="nx-split-main"
          >
            <Card>
              <table className="nx-table nx-condtable">
                <thead>
                  <tr>
                    <th>조건</th>
                    <th style={{ width: 150 }}>실제 값</th>
                    <th style={{ width: 260 }}>실험 값</th>
                    <th style={{ width: 90 }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {CONDS.map((c) => {
                    const v = valueOf(c);
                    const changed = changes[c.key] !== undefined;
                    return (
                      <tr key={c.key} className={changed ? "changed" : undefined}>
                        <td className="strong">{c.label}</td>
                        <td className="muted">{fmt(c, c.actual(snap))} · 실제</td>
                        <td>
                          {c.kind === "number" && (
                            <div className="nx-stepper-input">
                              <button type="button" aria-label={`${c.label} 줄이기`} onClick={() => set(c, Math.max(c.min!, +(Number(v) - c.step!).toFixed(1)))} disabled={Number(v) <= c.min!}>−</button>
                              <span className="num">{fmt(c, v)}</span>
                              <button type="button" aria-label={`${c.label} 늘리기`} onClick={() => set(c, Math.min(c.max!, +(Number(v) + c.step!).toFixed(1)))} disabled={Number(v) >= c.max!}>+</button>
                            </div>
                          )}
                          {c.kind === "priority" && (
                            <div className="nx-seg">
                              {(["P0", "P1", "P2"] as Priority[]).map((p) => (
                                <button type="button" key={p} className={v === p ? "on" : ""} onClick={() => set(c, p)}>{p}</button>
                              ))}
                            </div>
                          )}
                          {c.kind === "objective" && (
                            <div className="nx-seg">
                              {(["energy", "balanced", "performance"] as Objective[]).map((o) => (
                                <button type="button" key={o} className={v === o ? "on" : ""} onClick={() => set(c, o)}>{OBJ_LABEL[o]}</button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>{changed ? <StatusChip variant="assumption">변경됨</StatusChip> : <span className="caption">그대로</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </Section>

          <Section title="변경 요약" desc="실험 값은 결정 영수증에 '가정'으로 기록됩니다" className="nx-split-side">
            <Card className="nx-fill-top">
              {changedKeys.length ? (
                <ul className="nx-changes">
                  {changedKeys.map((k) => {
                    const c = CONDS.find((x) => x.key === k)!;
                    return (
                      <li key={k}>
                        <span>{c.label}</span>
                        <strong>
                          {fmt(c, c.actual(snap))} → {fmt(c, changes[k] as number | string)}
                        </strong>
                        <StatusChip variant="assumption" />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="muted" style={{ fontSize: 13 }}>아직 바꾼 조건이 없습니다. 왼쪽에서 조건 하나를 바꾸거나 "마감 3분으로"를 눌러 보세요.</p>
              )}
              {changedKeys.length > 1 && <p className="caption" style={{ marginTop: 8 }}>조건을 여러 개 바꾸면 무엇 때문에 판단이 달라졌는지 구분하기 어렵습니다.</p>}
              <p className="caption" style={{ marginTop: 8 }}>나머지 {CONDS.length - changedKeys.length}개 조건은 실제 값과 같습니다.</p>

              <div className="nx-locked">
                <div className="nx-locked-head">
                  <Icon name="shield" size={16} /> 실험에서 바꿀 수 없는 정책
                </div>
                {hard.map((p) => (
                  <div key={p.id} className="nx-locked-row">
                    <PolicyTag id={p.id} policy={p} />
                    <span>{p.text}</span>
                  </div>
                ))}
              </div>
              <details className="nx-details">
                <summary>재판단 요청 보기</summary>
                <pre className="nx-code">{JSON.stringify(request, null, 2)}</pre>
              </details>
            </Card>
          </Section>
        </div>

        {run.error != null && (
          <Card>
            <ErrorState error={run.error} onRetry={() => run.run()} />
          </Card>
        )}
        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate(`/decision/${decisionId ?? "DR-0412-01"}`)}>
            의사결정 센터로
          </Button>
          <Button arrow onClick={() => run.run()} disabled={!changedKeys.length || run.pending} disabledReason={!changedKeys.length ? "조건을 하나 이상 바꿔야 재판단할 수 있습니다." : undefined}>
            {run.pending ? "재판단 중…" : "변경 조건으로 재판단"}
          </Button>
        </div>
      </div>
    </>
  );
}
