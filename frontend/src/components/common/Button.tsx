import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  size?: "md" | "sm";
  block?: boolean;
  /** 주 행동 버튼 끝의 → */
  arrow?: boolean;
  /** 비활성일 때 버튼 아래에 보여줄 사유 (예: 권한 없음 · POL-04) */
  disabledReason?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  arrow = false,
  disabledReason,
  disabled,
  className = "",
  children,
  ...rest
}: Props) {
  const cls = ["nx-btn", `nx-btn--${variant}`, size === "sm" ? "nx-btn--sm" : "", block ? "nx-btn--block" : "", className]
    .filter(Boolean)
    .join(" ");
  const btn = (
    <button type="button" className={cls} disabled={disabled} {...rest}>
      {children}
      {arrow && <span aria-hidden="true">→</span>}
    </button>
  );
  if (disabled && disabledReason) {
    return (
      <span className="nx-btn-wrap">
        {btn}
        <span className="nx-btn-reason">{disabledReason}</span>
      </span>
    );
  }
  return btn;
}
