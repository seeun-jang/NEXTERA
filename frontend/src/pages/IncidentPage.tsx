import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Icon, PageHeader, PriorityBadge, Section, StatusChip } from "@/components/common";
import { IncidentList, SimChart } from "@/components/screens/sim";
import { nodeViews } from "@/sim/engine";
import { LIMIT_C, RESTART_MIN, zoneOfNode } from "@/sim/model";
import { useRun } from "@/state/run";

// SCREEN 03 · 사건 상세 — AI를 부르기 전에 무엇이 문제이고 어떤 제약이 걸렸는지 사람이 먼저 이해한다.
export default function IncidentPage() {
  const navigate = useNavigate();
  const { id = "" } = useParams<{ id: string }>();
  const run = useRun();
  const { base, analysis } = run.rounds[0];
  const inc = analysis.incidents.find((x) => x.id === id) ?? analysis.incidents[0];
  if (!inc) {
    return (
      <>
        <PageHeader crumbs={["운영 현황", "사건 상세"]} title="사건 상세" />
        <div className="nx-content"><Card><p className="caption">조치가 필요한 사건이 없습니다.</p></Card></div>
      </>
    );
  }
  const node = base.nodes.find((n) => n.id === inc.node)!;
  const zone = base.zones.find((z) => z.id === zoneOfNode(node.id))!;
  const v = nodeViews(base).find((x) => x.id === node.id)!;
  const job = inc.kind === "deadline" ? base.jobs.find((j) => j.id === inc.target)! : null;
  const others = analysis.incidents.filter((x) => x.id !== inc.id);
  const forecast = inc.kind === "heat" ? `조치가 없으면 약 ${inc.tLimit}분 뒤 ${node.id}가 안전 한계 ${LIMIT_C}°C에 도달할 것으로 추정됩니다.` : inc.detail;

  const reasons =
    inc.kind === "heat"
      ? [
          { icon: "thermometer" as const, title: node.fan ? "팬 이상" : "높은 부하", sub: node.fan ? "같은 부하에서도 더 빨리 뜨거워집니다" : `GPU ${v.usedGpus}장이 동시에 돌고 있습니다` },
          { icon: "clock" as const, title: "옮기면 재시작 지연", sub: `옮기거나 멈춘 일은 ${RESTART_MIN}분 늦게 다시 시작합니다` },
          { icon: "layers" as const, title: "냉각은 구역 단위", sub: `${zone.id}(레벨 ${zone.level}/${zone.max})를 올리면 같은 구역 노드가 함께 식고 에너지가 듭니다` },
          { icon: "shield" as const, title: "승인 권한", sub: "일 이동 · 새치기 · 연기는 B, 냉각 변경은 A의 승인이 필요합니다" },
        ]
      : [
          { icon: "clock" as const, title: "줄 서기", sub: "앞의 일이 GPU를 차지하면 뒤의 일은 기다립니다" },
          { icon: "activity" as const, title: "멈추기 규칙", sub: "더 급한 일만 다른 일을 멈출 수 있고, P0는 멈출 수 없습니다" },
          { icon: "layers" as const, title: "옮길 자리", sub: "다른 노드로 옮기면 재시작 지연이 생깁니다" },
          { icon: "shield" as const, title: "승인 권한", sub: "새치기 · 이동 · 연기는 GPU 운영 담당 B의 승인이 필요합니다" },
        ];

  return (
    <>
      <PageHeader crumbs={["운영 현황", "사건 상세"]} title={<>{inc.title} <PriorityBadge priority={inc.priority} /></>} right={<StatusChip variant="sim" />} />
      <div className="nx-content">
        <div className="nx-split">
          <Section title={inc.kind === "heat" ? `${node.id} 예측 온도` : `${job!.id} 완료 예측`} desc="조치가 없을 때 · 시뮬레이션 추정" className="nx-split-main">
            <Card>
              {inc.kind === "heat" ? (
                <SimChart sim={analysis.sim} nodes={[node.id]} height={260} />
              ) : (
                <div className="nx-jobline">
                  <div className="nx-jobline-bar">
                    <span className="fill" style={{ width: `${Math.min(100, (analysis.sim.finish[job!.id] / Math.max(job!.deadline, analysis.sim.finish[job!.id])) * 100)}%` }} />
                    <span className="deadline" style={{ left: `${(job!.deadline / Math.max(job!.deadline, analysis.sim.finish[job!.id])) * 100}%` }}>마감 {job!.deadline}분</span>
                  </div>
                  <p className="caption">예상 완료 {analysis.sim.finish[job!.id]}분 · {job!.priority} · {job!.gpus}장 · {v.waiting.some((x) => x.id === job!.id) ? `${node.id}에서 대기 중` : `${node.id}에서 실행 중`}</p>
                </div>
              )}
              <div className="nx-callout">
                <Icon name="info" size={16} />
                {forecast}
              </div>
            </Card>
          </Section>
          <Section title="사건 정보" className="nx-split-side">
            <Card>
              <dl className="nx-kv">
                <div><dt>노드 · 구역</dt><dd>{node.id} · {zone.id} (냉각 {zone.level}/{zone.max})</dd></div>
                <div><dt>현재 온도</dt><dd>{node.temp}°C{node.fan ? " · 팬 이상" : ""}</dd></div>
                <div><dt>실행 중</dt><dd>{v.running.map((j) => `${j.id}(${j.priority}·${j.gpus}장)`).join(", ") || "없음"}</dd></div>
                <div><dt>대기</dt><dd>{v.waiting.map((j) => `${j.id}(${j.priority}·${j.gpus}장)`).join(", ") || "없음"}</dd></div>
                <div><dt>한계까지</dt><dd>{inc.tLimit}분</dd></div>
              </dl>
            </Card>
          </Section>
        </div>

        <Section title="왜 단순 규칙으로 풀 수 없나" desc="여러 조건이 서로 충돌합니다">
          <div className="nx-reasons">
            {reasons.map((r) => (
              <div key={r.title} className="nx-reason">
                <span className="nx-reason-icon"><Icon name={r.icon} size={18} /></span>
                <strong>{r.title}</strong>
                <span className="caption">{r.sub}</span>
              </div>
            ))}
          </div>
        </Section>

        {others.length > 0 && (
          <Section title="함께 있는 사건" desc="한 번의 판단에서 함께 다룹니다">
            <Card><IncidentList items={others} /></Card>
          </Section>
        )}

        <div className="nx-actions">
          <Button variant="secondary" onClick={() => navigate("/operations")}>운영 현황</Button>
          <Button arrow onClick={() => navigate("/policies")}>회사 운영 정책 확인</Button>
        </div>
      </div>
    </>
  );
}
