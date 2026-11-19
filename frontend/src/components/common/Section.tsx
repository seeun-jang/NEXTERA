import type { ReactNode } from "react";

/** 화면 안의 구역. 제목 + 한 줄 설명을 카드 밖(배경 위)에 둬서 구역 경계가 바로 보이게 한다. */
export function Section({
  title,
  desc,
  right,
  className = "",
  children,
}: {
  title: string;
  desc?: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`nx-section ${className}`}>
      <div className="nx-section-head">
        <div>
          <h2 className="nx-section-title">{title}</h2>
          {desc && <p className="nx-section-desc">{desc}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
