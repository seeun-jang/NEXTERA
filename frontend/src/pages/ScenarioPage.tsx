import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Priority, Provider } from "@contracts/types";
import { api, API_MODE } from "@/api/client";
import { Button, Card, ErrorState, Icon, PageHeader, ProviderChip, Section, StatusChip } from "@/components/common";
import { isHandoff } from "@/components/screens/labels";
import { useDemo } from "@/state/DemoContext";
import { clearDecisions } from "@/state/decisionCache";
import {
  DEFAULT_VALUES,
  describe,
  fromChanges,
  loadScenario,
  matchPreset,
  PRESETS,
  saveScenario,
  toChanges,
  valuesOf,
  type ScenarioValues,
} from "@/state/scenario";

// SCREEN 01 · 상황 설정 — 정해진 한 장면이 아니라, 시연할 상황을 고르거나 직접 조정한다.
// 값을 바꿀 때마다 시연을 그 상황으로 초기화하고 AI 판단을 다시 돌려 오른쪽에 미리 보여 준다.
// "이 상황으로 시작"을 누르면 같은 상황으로 깨끗하게 초기화한 뒤 02 운영 현황부터 흐름을 따라간다.

interface Preview {
  pick: string;
  pickId: string;
  handoff: boolean;
  rationale: string;
  passed: number;
  total: number;
  blocked: string[];
  noAction: string;
  provider: Provider;
}

type Opt<T> = { v: T; label: string };
const ROWS: { key: keyof ScenarioValues; label: string; hint: string; opts: Opt<number | string>[] }[] = [
  { key: "n4_temp_c", label: "N4 현재 온도", hint: "팬 이상 노드 · 안전 한계 88°C", opts: [78, 81, 84, 86].map((v) => ({ v, label: `${v}°C` })) },
  { key: "deadline_min", label: "J07 마감까지", hint: "남은 시간이 짧을수록 고를 수 있는 행동이 줄어듦", opts: [2, 3, 5, 8].map((v) => ({ v, label: `${v}분` })) },
  { key: "j07_priority", label: "J07 우선순위", hint: "P0는 옮기거나 멈출 수 없음 (POL-01)", opts: (["P0", "P1", "P2"] as Priority[]).map((v) => ({ v, label: v })) },
  { key: "n2_gpus_free", label: "N2 여유 GPU", hint: "J07을 옮기려면 8장 필요 (POL-03)", opts: [0, 4, 8].map((v) => ({ v, label: `${v}장` })) },
  { key: "cooling_max", label: "Z2 냉각 상한", hint: "현재 레벨 3 · 상한이 3이면 더 강화할 수 없음", opts: [3, 4, 5].map((v) => ({ v, label: v === 3 ? "3 (여유 없음)" : String(v) })) },
  { key: "objective", label: "운영 목표", hint: "에너지 우선이면 냉각 강화를 뒤로 미룸", opts: [{ v: "balanced", label: "균형" }, { v: "energy", label: "에너지 우선" }] },
  { key: "approval_delay_min", label: "승인 지연", hint: "승인이 늦을수록 실행이 늦어짐", opts: [0.5, 2, 3].map((v) => ({ v, label: `${v}분` })) },
];

export default function ScenarioPage() {
  const navigate = useNavigate();
  const { incidentId, resetIds } = useDemo();
  const [values, setValues] = useState<ScenarioValues>(() => fromChanges(loadScenario().changes));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [starting, setStarting] = useState(false);
  const seq = useRef(0);

  const preset = matchPreset(values);
  const changes = toChanges(values);

  // 값이 바뀔 때마다 그 상황으로 판단을 다시 돌린다 (짧게 기다렸다가)
  useEffect(() => {
    const my = ++seq.current;
    setBusy(true);
    const timer = window.setTimeout(async () => {
      try {
        await api.resetDemo(changes);
        const res = await api.decide({ incident_id: incidentId, snapshot_id: "S0", policy_version: "1.2" });
        const inc = await api.getIncident(incidentId);
        if (my !== seq.current) return;
        const sel = res.candidates.find((c) => c.id === res.decision.selected_id);
        setPreview({
          pick: sel?.label ?? res.decision.selected_id,
          pickId: res.decision.selected_id,
          handoff: isHandoff(sel),
          rationale: res.decision.rationale ?? "",
          passed: res.candidates.filter((c) => !c.filtered_out).length,
          total: res.candidates.length,
          blocked: res.candidates.filter((c) => c.filtered_out).map((c) => `${c.label} (${c.filter_reason})`),
          noAction: inc.no_action_forecast.risk_note,
          provider: res.decision.provider,
        });
        setError(null);
      } catch (e) {
        if (my === seq.current) setError(e);
      } finally {
        if (my === seq.current) setBusy(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(changes)]);

  const set = (k: keyof ScenarioValues, v: number | string) => setValues((prev) => ({ ...prev, [k]: v }));

  const start = async () => {
    setStarting(true);
    try {
      saveScenario(values);
      await api.resetDemo(changes); // 미리보기 기록을 지우고 같은 상황으로 깨끗하게 시작
      clearDecisions();
      resetIds();
      navigate("/operations");
    } catch (e) {
      setError(e);
      setStarting(false);
    }
  };

  const header = (
    <PageHeader
      crumbs={["시연 준비", "상황 설정"]}
      title="상황 설정 · Scenario"
      right={
        <>
          <StatusChip variant="sim" />
          {preview && <ProviderChip provider={preview.provider} />}
        </>
      }
    />
  );

  return (
    <>
      {header}
      <div className="nx-content">
        {API_MODE === "live" && (
          <div className="nx-preview-note">
            <Icon name="info" size={16} />
            <span>
              <b>서버 모드</b> · 상황 값은 서버가 <span className="mono">POST /api/demo/reset</span>의 <span className="mono">scenario</span>를 지원해야 반영됩니다. 지원하지 않으면 기본 상황으로 시작합니다.
            </span>
          </div>
        )}

        <Section title="어떤 상황을 시연할까요" desc="상황을 고르면 오른쪽에서 AI가 어떤 대안을 고르는지 바로 보여 줍니다.">
          <div className="nx-scn-presets">
            {PRESETS.map((p) => {
              const on = preset?.id === p.id;
              const tags = describe(toChanges(valuesOf(p)));
              return (
                <button key={p.id} type="button" className={`nx-scn-preset${on ? " on" : ""}`} aria-pressed={on} onClick={() => setValues(valuesOf(p))}>
                  <strong>{p.name}</strong>
                  <span>{p.desc}</span>
                  <span className="nx-scn-tags">{tags.length ? tags.map((t) => <em key={t}>{t}</em>) : <em>시드 값 그대로</em>}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <div className="nx-split">
          <Section
            title="직접 조정"
            desc="값을 하나씩 바꿔 보세요. 바꾼 값은 이후 모든 화면과 판단에 그대로 쓰입니다."
            className="nx-split-main"
            right={
              <button type="button" className="nx-scn-reset" onClick={() => setValues(DEFAULT_VALUES)} disabled={!Object.keys(changes).length}>
                <Icon name="refresh" size={14} /> 기본값으로
              </button>
            }
          >
            <Card>
              <table className="nx-table nx-scn-table">
                <thead>
                  <tr>
                    <th>조건</th>
                    <th>설정 값</th>
                    <th>기본</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => {
                    const changed = values[r.key] !== DEFAULT_VALUES[r.key];
                    return (
                      <tr key={r.key} className={changed ? "changed" : ""}>
                        <td>
                          <strong>{r.label}</strong>
                          <span className="caption">{r.hint}</span>
                        </td>
                        <td>
                          <div className="nx-seg" role="group" aria-label={r.label}>
                            {r.opts.map((o) => (
                              <button key={String(o.v)} type="button" className={values[r.key] === o.v ? "on" : ""} aria-pressed={values[r.key] === o.v} onClick={() => set(r.key, o.v)}>
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="muted mono">{r.opts.find((o) => o.v === DEFAULT_VALUES[r.key])?.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </Section>

          <Section title="이 상황에서 AI는?" desc="회사 정책을 적용한 뒤 판단한 결과" className="nx-split-side">
            <Card className={`nx-scn-result${busy ? " busy" : ""}`}>
              {error ? (
                <ErrorState error={error} onRetry={() => setValues({ ...values })} />
              ) : !preview ? (
                <p className="caption">판단하는 중…</p>
              ) : (
                <>
                  <span className="caption">{preset ? preset.name : "직접 설정한 상황"}</span>
                  <div className={`nx-scn-pick${preview.handoff ? " handoff" : ""}`}>
                    <span className="caption">AI 선택</span>
                    <strong>{preview.pick}</strong>
                    {preview.handoff && <span className="nx-scn-flag">설비 조작 없음 · 사람에게 넘김</span>}
                  </div>
                  <p className="nx-scn-why">{preview.rationale}</p>
                  <dl className="nx-scn-facts">
                    <div>
                      <dt>정책 통과</dt>
                      <dd>
                        후보 {preview.total}개 → <b>{preview.passed}개</b>
                      </dd>
                    </div>
                    <div>
                      <dt>아무것도 안 하면</dt>
                      <dd>{preview.noAction}</dd>
                    </div>
                    {preview.blocked.length > 0 && (
                      <div>
                        <dt>정책에 막힌 행동</dt>
                        <dd>{preview.blocked.join(", ")}</dd>
                      </div>
                    )}
                  </dl>
                  <p className="caption">판단은 실행이 아닙니다. 이후 안전 검사와 권한자 승인을 거칩니다.</p>
                </>
              )}
            </Card>
          </Section>
        </div>

        <div className="nx-actions">
          <span className="caption nx-scn-summary">
            {Object.keys(changes).length ? `바꾼 값: ${describe(changes).join(" · ")}` : "기본 상황 (시드 값 그대로)"}
          </span>
          <Button arrow onClick={start} disabled={starting}>
            이 상황으로 시작
          </Button>
        </div>
      </div>
    </>
  );
}
