import { Card, EmptyState, PageHeader, StatusChip } from "@/components/common";

/** 아직 구현 전인 화면. 무엇을 만들지(§8)와 어떤 API를 쓸지 화면에 적어 둔다. */
export function Placeholder({
  no,
  title,
  crumbs,
  api,
  cp,
  parts,
}: {
  no: string;
  title: string;
  crumbs: string[];
  api: string;
  cp: string;
  parts: string[];
}) {
  return (
    <>
      <PageHeader crumbs={crumbs} title={title} right={<StatusChip variant="neutral">SCREEN {no} · {cp} 구현 예정</StatusChip>} />
      <div className="nx-content">
        <Card title={`SCREEN ${no} · ${title}`} sub={<span className="mono">{api}</span>}>
          <EmptyState
            title="아직 구현 전인 화면입니다"
            description={
              <>
                공통 프롬프트 §8 구성: {parts.join(" · ")}
              </>
            }
          />
        </Card>
      </div>
    </>
  );
}
