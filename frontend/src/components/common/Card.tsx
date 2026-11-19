import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function Card({
  title,
  sub,
  right,
  emphasis = false,
  dashed = false,
  className = "",
  children,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  emphasis?: boolean;
  dashed?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const cls = ["nx-card", emphasis ? "emph" : "", dashed ? "dashed" : "", className].filter(Boolean).join(" ");
  return (
    <section className={cls}>
      {(title || right || sub) && (
        <div className="nx-card-head">
          <div className="nx-card-title">{title}</div>
          {right ?? (sub && <div className="nx-card-sub">{sub}</div>)}
        </div>
      )}
      {children}
    </section>
  );
}

/** KPI 타일. tone="dark"는 레퍼런스의 짙은 남색 그라데이션 타일(운영 현황 상단용). */
export function Kpi({
  label,
  value,
  unit,
  sub,
  icon,
  tone = "light",
  meter,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  icon?: IconName;
  tone?: "light" | "dark";
  /** 0~100: 아래 얇은 진행 막대 */
  meter?: number;
}) {
  return (
    <section className={`nx-kpi nx-kpi--${tone}`}>
      {icon && (
        <span className="nx-kpi-icon">
          <Icon name={icon} size={26} strokeWidth={1.6} />
        </span>
      )}
      <div className="nx-kpi-body">
        <div className="nx-kpi-label">{label}</div>
        <div className="nx-kpi-value">
          {value}
          {unit && <span className="nx-kpi-unit">{unit}</span>}
        </div>
        {sub && <div className="nx-kpi-sub">{sub}</div>}
        {meter !== undefined && (
          <div className="nx-kpi-meter">
            <span style={{ width: `${Math.max(0, Math.min(100, meter))}%` }} />
          </div>
        )}
      </div>
    </section>
  );
}
