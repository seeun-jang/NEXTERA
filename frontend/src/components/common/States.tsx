import type { ReactNode } from "react";
import { ApiClientError } from "@/api/errors";
import { Button } from "./Button";
import { Icon } from "./Icon";

export function Skeleton({ height = 120, width = "100%" }: { height?: number; width?: number | string }) {
  return <div className="nx-skeleton" style={{ height, width }} aria-busy="true" aria-label="불러오는 중" />;
}

/** 화면 전체 로딩: 카드 모양 스켈레톤 여러 개 */
export function PageSkeleton() {
  return (
    <div className="nx-content">
      <div className="nx-kpis">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={104} />
        ))}
      </div>
      <div className="nx-row">
        <div className="nx-grow">
          <Skeleton height={420} />
        </div>
        <div style={{ width: 360 }}>
          <Skeleton height={420} />
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="nx-empty">
      <Icon name="inbox" size={28} />
      <div className="t">{title}</div>
      {description && <div className="d">{description}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = error instanceof ApiClientError ? error : null;
  const message = e?.message ?? (error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
  return (
    <div className="nx-error" role="alert">
      <Icon name="alert" size={28} />
      <div className="t">요청을 처리하지 못했습니다</div>
      <div className="d">{message}</div>
      {e && (
        <div className="code">
          {e.status} · {e.code}
          {e.policyId ? ` · ${e.policyId}` : ""}
        </div>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  );
}
