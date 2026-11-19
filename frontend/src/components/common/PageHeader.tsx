import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { StageGuide } from "./StageGuide";

/** 브레드크럼 → 페이지 제목, 오른쪽에 표기 칩 */
export function PageHeader({ crumbs, title, right, guide = true }: { crumbs: string[]; title: ReactNode; right?: ReactNode; guide?: boolean }) {
  const { pathname } = useLocation();
  return (
    <div className="nx-headwrap">
      <header className="nx-header">
        <div>
          <div className="nx-crumb">{crumbs.join(" / ")}</div>
          <h1 className="nx-title">{title}</h1>
        </div>
        {right && <div className="nx-header-right">{right}</div>}
      </header>
      {guide && <StageGuide pathname={pathname} />}
    </div>
  );
}
