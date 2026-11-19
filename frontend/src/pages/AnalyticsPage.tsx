import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type AnalyticsResponse } from "@/api/client";
import { Button, Card, ErrorState, Icon, Kpi, PageHeader, PageSkeleton, Section, StatusChip } from "@/components/common";
import { useApi } from "@/hooks/useApi";

// SCREEN 11 · 기록·분석 — 쌓인 결정 기록으로 운영 품질을 보고, 실패 패턴을 정책·시스템 개선으로 연결한다.
// 집계 숫자는 화면 설계용 예시(is_example)일 때 반드시 "예시 데이터 · 측정값 아님"을 붙인다.
const FILTERS = {
  scenario: ["전체", "열 위험", "승인 지연", "용량 부족", "정비 일정"],
  policy: ["v1.2"],
  period: ["최근 7일", "오늘", "최근 30일"],
  result: ["전체", "성공", "보류", "실패"],
} as const;
type FilterKey = keyof typeof FILTERS;
const FILTER_LABEL: Record<FilterKey, string> = { scenario: "시나리오", policy: "정책", period: "기간", result: "결과" };
const STATUS = { open: "진행 중", executed: "성공", held: "보류", failed: "실패" } as const;

/** 사건 유형별 결정 건수(막대) + 그중 마감 미준수(빗금). 한 가지 색 + 빗금이라 색만으로 구분하지 않는다. */
function TypeBars({ rows }: { rows: AnalyticsResponse["by_type"] }) {
  const max = Math.max(...rows.map((r) => r.decisions), 1);
  return (
    <div className="nx-tbars">
      <div className="nx-tbars-legend">
        <span><i className="sw" />결정 건수</span>
        <span><i className="sw hatch" />그중 마감 미준수</span>
      </div>
      {rows.map((r) => (
        <div key={r.type} className="nx-tbar" tabIndex={0}>
          <span className="nx-tbar-name">{r.type}</span>
          <div className="nx-tbar-track">
            <span className="nx-tbar-fill" style={{ width: `${(r.decisions / max) * 100}%` }}>
              {r.missed > 0 && <span className="nx-tbar-miss" style={{ width: `${(r.missed / r.decisions) * 100}%` }} />}
            </span>
            <span className="nx-tbar-tip" role="tooltip">
              {r.type} · 결정 {r.decisions}건 · 마감 미준수 {r.missed}건
            </span>
          </div>
          <span className="nx-tbar-val num">
            {r.decisions}건<small>{r.missed ? ` · 미준수 ${r.missed}` : " · 미준수 0"}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Record<FilterKey, string>>({ scenario: "전체", policy: "v1.2", period: "최근 7일", result: "전체" });
  const { data, error, loading, reload } = useApi(
    () => Promise.all([api.getAnalytics(filters), api.listReceipts()]),
    [filters.scenario, filters.policy, filters.period, filters.result],
  );

  const header = (
    <PageHeader
      crumbs={["기록·분석", "운영 분석"]}
      title="기록 · 분석"
      right={data?.[0].is_example ? <StatusChip variant="assumption">예시 데이터 · 측정값 아님</StatusChip> : <StatusChip variant="sim" />}
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

  const [a, receipts] = data;
  // 최근 결정: 이번 시연의 실제 영수증을 맨 위에, 그 아래는 예시 기록
  const live = receipts.map((r) => {
    const sel = r.branches.find((b) => b.branch_id === "S0")?.selected_id;
    return {
      decision_id: r.decision_id,
      incident_id: r.incident_id,
      action_label: r.candidates.find((c) => c.id === sel)?.label ?? sel ?? "—",
      status: r.status,
      deadline_met: r.execution ? r.execution.sla.met : null,
      real: true,
    };
  });
  const recent = [...live, ...a.recent.filter((x) => !live.some((l) => l.decision_id === x.decision_id)).map((x) => ({ ...x, real: false }))];

  const exportCsv = () => {
    const csv = toCsv([["결정", "사건", "행동", "실행", "마감", "구분"], ...recent.map((r) => [r.decision_id, r.incident_id, r.action_label, STATUS[r.status], r.deadline_met === null ? "—" : r.deadline_met ? "준수" : "미준수", r.real ? "이번 시연" : "예시"])]);
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "nextera_decisions.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {header}
      <div className="nx-content">
        <div className="nx-filters" role="group" aria-label="필터">
          {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
            <label key={k} className="nx-filter">
              <span>{FILTER_LABEL[k]}</span>
              <select value={filters[k]} onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.value }))}>
                {FILTERS[k].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          ))}
          <button type="button" className="nx-linkbtn" onClick={() => setFilters({ scenario: "전체", policy: "v1.2", period: "최근 7일", result: "전체" })}>
            필터 초기화
          </button>
        </div>

        <Section title="운영 품질 한눈에" desc={a.is_example ? "화면 설계용 예시 값입니다. 실제 영수증이 쌓이면 서버가 집계합니다." : "결정 영수증 집계"}>
          <div className="nx-kpis nx-kpis--6">
            <Kpi label="평가된 결정" value={a.total_decisions} unit="건" />
            <Kpi label="차단된 정책 위반 시도" value={a.blocked_attempts} unit="건" />
            <Kpi label="사람 이관률" value={a.escalation_rate_pct} unit="%" />
            <Kpi label="마감 준수" value={`${a.deadline_met.met} / ${a.deadline_met.total}`} />
            <Kpi label="결정 일관성" value={`${a.consistency.same} / ${a.consistency.total}`} sub="같은 입력 반복" />
            <Kpi label="실행 결과" value={`${a.results.succeeded} · ${a.results.held} · ${a.results.failed}`} sub="성공 · 보류 · 실패" />
          </div>
        </Section>

        <div className="nx-split">
          <Section title="사건 유형별 결정과 마감 미준수" desc="막대 = 결정 건수 · 빗금 = 그중 마감 미준수" className="nx-split-main">
            <Card>
              <TypeBars rows={a.by_type} />
            </Card>
          </Section>
          <Section title="읽는 법" desc="이 화면에서 찾을 것" className="nx-split-side">
            <Card className="nx-fill-top">
              <p className="nx-why">
                기록을 사건 유형별로 묶으면, 결정 건수 대비 <strong>승인 지연</strong>에서 마감 미준수가 가장 많이 나옵니다. 아래 실패 패턴은 다음 정책 버전 검토 항목으로 바로 연결됩니다.
              </p>
            </Card>
          </Section>
        </div>

        <Section title="실패 패턴 → 개선 조치" desc="대표 기록을 누르면 해당 결정 영수증을 엽니다">
          <Card>
            <table className="nx-table">
              <thead>
                <tr>
                  <th>실패 패턴</th>
                  <th style={{ width: 80 }}>건수</th>
                  <th style={{ width: 150 }}>대표 기록</th>
                  <th>개선 조치</th>
                </tr>
              </thead>
              <tbody>
                {a.patterns.map((p) => {
                  const real = live.some((l) => l.decision_id === p.decision_id);
                  return (
                    <tr key={p.pattern}>
                      <td className="strong">{p.pattern}</td>
                      <td className="num">{p.count}</td>
                      <td>
                        {real ? (
                          <button type="button" className="nx-linkbtn mono" onClick={() => navigate(`/receipts/${p.decision_id}`)}>{p.decision_id}</button>
                        ) : (
                          <span className="mono caption" title="예시 기록 · 열 수 없음">{p.decision_id}</span>
                        )}
                      </td>
                      <td>
                        <span className="nx-improve"><Icon name="arrow-right" size={13} /> {p.action}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </Section>

        <Section
          title="최근 결정"
          desc="맨 위는 이번 시연에서 만든 실제 영수증, 나머지는 예시 기록"
          right={
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              CSV 내보내기
            </Button>
          }
        >
          <Card>
            <table className="nx-table">
              <thead>
                <tr>
                  <th>결정</th>
                  <th>사건</th>
                  <th>행동</th>
                  <th style={{ width: 110 }}>실행</th>
                  <th style={{ width: 110 }}>마감</th>
                  <th style={{ width: 110 }}>구분</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.decision_id} className={r.real ? "nx-row-pick nx-row-link" : undefined} onClick={r.real ? () => navigate(`/receipts/${r.decision_id}`) : undefined}>
                    <td className="mono strong">{r.decision_id}</td>
                    <td className="mono">{r.incident_id}</td>
                    <td>{r.action_label}</td>
                    <td>{STATUS[r.status]}</td>
                    <td>{r.deadline_met === null ? "—" : r.deadline_met ? "준수" : "미준수"}</td>
                    <td>{r.real ? <StatusChip variant="sim">이번 시연</StatusChip> : <span className="caption">예시</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Section>

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate("/")}>처음부터 다시 시연</Button>
          {live[0] && (
            <Button arrow onClick={() => navigate(`/receipts/${live[0].decision_id}`)}>
              이번 결정 영수증 보기
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
