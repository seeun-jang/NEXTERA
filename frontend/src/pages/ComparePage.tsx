import { useNavigate, useParams } from "react-router-dom";
import type { Estimate, Experiment } from "@contracts/types";
import { api } from "@/api/client";
import { Button, Card, ErrorState, Icon, PageHeader, PageSkeleton, ProviderChip, Section, StatusChip } from "@/components/common";
import { useApi } from "@/hooks/useApi";
import { useDemo } from "@/state/DemoContext";

// SCREEN 07 · A/B 판단 비교 — 같은 스냅샷에서 조건 하나만 바꾼 두 판단을 나란히 놓고 무엇이 왜 달라졌는지 보여 준다.
// 판단을 억지로 다르게 만들지 않는다. 같게 나와도 그대로 보여 준다.
const KEY_LABEL: Record<string, { label: string; unit?: string }> = {
  deadline_min: { label: "작업 마감", unit: "분" },
  cooling_max: { label: "냉각 용량(Z2 최대)" },
  n2_gpus_free: { label: "N2 여유 GPU", unit: "장" },
  j07_priority: { label: "J07 우선순위" },
  objective: { label: "목표" },
  approval_delay_min: { label: "승인 지연", unit: "분" },
};

const label = (e: Experiment) => e.candidates.find((c) => c.id === e.decision.selected_id)?.label ?? e.decision.selected_id;
const deadlineOf = (e: Experiment) => e.changes.deadline_min ?? 5;

function slaRisk(slack: number) {
  if (slack < 0) return "높음 · 마감 초과";
  if (slack < 1) return "보통";
  return "낮음";
}

function rows(e: Experiment, est: Estimate) {
  const slack = est.deadline_slack_min.J07 ?? 0;
  const peak = est.peak_temp_c.N4;
  const policyOk = est.violations.filter((v) => v !== "DEADLINE_MISS").length === 0;
  return [
    { k: "후보 확률", v: e.decision.provider === "zoro1" && e.decision.probs ? `${Math.round((e.decision.probs[e.decision.selected_id] ?? 0) * 100)}%` : "실제 모델 연결 시 표시" },
    { k: "예상 완료 (J07)", v: `${est.job_finish_min.J07}분` },
    { k: "마감 대비 여유", v: `${slack}분` },
    { k: "예상 냉각 에너지 (Z2)", v: est.cooling_kwh_delta_pct === 0 ? "변화 없음" : `${est.cooling_kwh_delta_pct > 0 ? "+" : ""}${est.cooling_kwh_delta_pct}%` },
    { k: "열 안전 (N4 최고)", v: peak !== undefined ? `${peak}°C` : "—" },
    { k: "SLA 위험", v: slaRisk(slack) },
    { k: "정책 준수", v: policyOk ? "통과" : "위반" },
  ];
}

function Column({ tag, title, e, other, assumption }: { tag: "A" | "B"; title: string; e: Experiment; other: Experiment; assumption: boolean }) {
  const mine = rows(e, e.estimate);
  const theirs = rows(other, other.estimate);
  return (
    <div className={`nx-abcol nx-abcol--${tag}`}>
      <div className="nx-abcol-head">
        <span className="nx-abtag">{tag}</span>
        <div>
          <strong>{title}</strong>
          <span className="caption">마감 {deadlineOf(e)}분 ({assumption ? "가정" : "실제"})</span>
        </div>
        <div className="nx-abcol-chips">
          {assumption && <StatusChip variant="assumption" />}
          <ProviderChip provider={e.decision.provider} fallbackReason={e.decision.fallback_reason} />
        </div>
      </div>
      <div className="nx-abcol-pick">
        <span className="caption">선택 행동</span>
        <strong>{label(e)}</strong>
      </div>
      <dl className="nx-abrows">
        {mine.map((r, i) => (
          <div key={r.k} className={r.v !== theirs[i].v ? "diff" : undefined}>
            <dt>{r.k}</dt>
            <dd>{r.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** 완료 시점 막대 + 각자의 마감 점선 (0~6분 눈금, 마감이 길면 늘어남) */
function FinishBars({ items }: { items: { name: string; finish: number; deadline: number; ink?: boolean }[] }) {
  const max = Math.max(6, ...items.map((i) => Math.ceil(Math.max(i.finish, i.deadline))));
  const pct = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="nx-bars">
      {items.map((it) => (
        <div key={it.name} className="nx-barrow">
          <span className="nx-barrow-name">{it.name}</span>
          <div className="nx-barrow-track">
            <span className={`nx-barrow-fill${it.finish > it.deadline ? " over" : ""}${it.ink ? " ink" : ""}`} style={{ width: pct(it.finish) }}>
              <em>{it.finish}분</em>
            </span>
            <span className="nx-barrow-deadline" style={{ left: pct(it.deadline) }} title={`마감 ${it.deadline}분`}>
              <i>마감 {it.deadline}분</i>
            </span>
          </div>
        </div>
      ))}
      <div className="nx-barrow-axis">
        <span />
        <div>
          {Array.from({ length: max + 1 }, (_, i) => (
            <span key={i} style={{ left: pct(i) }}>{i}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const navigate = useNavigate();
  const { branch = "" } = useParams<{ branch: string }>();
  const { decisionId } = useDemo();
  const { data, error, loading, reload } = useApi(async () => {
    const cmp = await api.compareExperiment(branch);
    // 반사실: B 조건에서 A가 고른 행동을 했다면? (같은 시뮬레이터로 추정)
    const cf =
      cmp.base.decision.selected_id !== cmp.branch.decision.selected_id
        ? (await api.futures({ decision_id: cmp.branch.decision.decision_id, snapshot_id: branch, action_ids: [cmp.base.decision.selected_id], horizon_ticks: 10 })).estimates[0]
        : null;
    return { cmp, cf };
  }, [branch]);

  const header = (
    <PageHeader
      crumbs={["조건 실험", `S0 vs ${branch}`]}
      title="A/B 판단 비교"
      right={
        <>
          <StatusChip variant="sim" />
          <StatusChip variant="estimate" />
        </>
      }
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

  const { cmp, cf } = data;
  const { base: A, branch: B } = cmp;
  const same = A.decision.selected_id === B.decision.selected_id;
  const changed = cmp.changed_keys.map((k) => {
    const meta = KEY_LABEL[k] ?? { label: k };
    const before = k === "deadline_min" ? deadlineOf(A) : "실제 값";
    const after = (B.changes as Record<string, unknown>)[k];
    return `${meta.label} ${before}${meta.unit && k === "deadline_min" ? meta.unit : ""} (실제) → ${after}${meta.unit ?? ""} (가정)`;
  });

  let why: string;
  if (same) {
    why = "두 판단이 같습니다. 같은 행동이 여전히 적절하거나 다른 후보가 조건을 만족하지 못할 수 있습니다. 근거와 예상 결과는 아래에서 비교할 수 있습니다.";
  } else if (cf) {
    const over = Math.round((cf.job_finish_min.J07 - deadlineOf(B)) * 10) / 10;
    why =
      over > 0
        ? `마감이 ${deadlineOf(B)}분이면 "${label(A)}"은(는) 완료가 ${cf.job_finish_min.J07}분이라 마감을 ${over}분 넘깁니다. 그래서 B에서는 마감 안에 끝나는 "${label(B)}"이(가) 선택됐습니다.`
        : `B 조건에서는 "${label(B)}"이(가) 정책 v${B.decision.policy_version} 목표 순서(마감 → 에너지)에 더 맞아 선택됐습니다.`;
    if (B.decision.selected_id === "A-COOL-Z2-UP") why += " N4 팬 이상 메모는 영수증에 '주의'로 남습니다.";
  } else {
    why = "조건 변경으로 선택이 바뀌었습니다.";
  }

  const bars = [
    { name: `A · ${label(A)}`, finish: A.estimate.job_finish_min.J07, deadline: deadlineOf(A) },
    { name: `B · ${label(B)}`, finish: B.estimate.job_finish_min.J07, deadline: deadlineOf(B), ink: true },
    ...(cf ? [{ name: `B에서 "${label(A)}"을(를) 골랐다면`, finish: cf.job_finish_min.J07, deadline: deadlineOf(B) }] : []),
  ];

  return (
    <>
      {header}
      <div className="nx-content">
        <div className="nx-changed">
          <span className="nx-changed-label">바뀐 변수</span>
          <strong>{changed.join(" · ")}</strong>
          <span className="caption">나머지 조건 · 정책 · 스냅샷 · 난수 시드는 A와 B가 같습니다 · B의 파란 값 = A와 다른 값</span>
        </div>

        <div className="nx-abgrid">
          <Column tag="A" title="원래 조건" e={A} other={B} assumption={false} />
          <div className="nx-abvs" aria-hidden="true">
            <Icon name="arrow-right" size={18} />
          </div>
          <Column tag="B" title="변경 조건" e={B} other={A} assumption />
        </div>

        <div className="nx-split">
          <Section title="예상 완료 시점과 마감" desc="막대 = J07 예상 완료 · 세로 점선 = 각 조건의 마감 · 빗금 = 마감 초과" className="nx-split-main">
            <Card>
              <FinishBars items={bars} />
            </Card>
          </Section>
          <Section title={same ? "판단이 같은 이유" : "판단이 달라진 이유"} desc="시뮬레이터 추정으로 계산한 설명" className="nx-split-side">
            <Card className="nx-fill-top">
              <p className="nx-why">{why}</p>
            </Card>
          </Section>
        </div>

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate("/lab/S0")}>
            조건 다시 바꾸기
          </Button>
          <Button arrow onClick={() => navigate(`/decision/${decisionId ?? A.decision.decision_id}/validate`)}>
            실행 전 안전 검사
          </Button>
        </div>
      </div>
    </>
  );
}
