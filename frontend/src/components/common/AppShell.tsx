import { Link, Outlet, useLocation } from "react-router-dom";
import type { RoleId } from "@contracts/types";
import { API_MODE } from "@/api/client";
import { ROLE_LABEL } from "@/api/role";
import { useDemo } from "@/state/DemoContext";
import { Icon, type IconName } from "./Icon";

interface NavItem {
  label: string;
  icon: IconName;
  to: string;
  match: string[]; // 이 접두사로 시작하는 경로면 활성
}

export function AppShell() {
  const { pathname } = useLocation();
  const { incidentId, decisionId, branchId, approvalId, role, setRole } = useDemo();

  // 메뉴 ↔ 화면: §8 (운영 현황 02·03 · 운영 정책 04 · 의사결정 05·08·09 · 조건 실험 06·07 · 협업·승인 10·11 · 기록·분석 12·13)
  const items: NavItem[] = [
    { label: "운영 현황", icon: "activity", to: "/operations", match: ["/operations", "/incidents"] },
    { label: "운영 정책", icon: "file", to: "/policies", match: ["/policies"] },
    { label: "의사결정", icon: "clock", to: `/decision/${decisionId ?? "DR-0412-01"}`, match: ["/decision"] },
    { label: "조건 실험", icon: "flask", to: branchId ? `/lab/${branchId}/compare` : "/lab/S0", match: ["/lab"] },
    { label: "협업·승인", icon: "users", to: approvalId ? `/approvals/${approvalId}` : "/approvals", match: ["/approvals", "/executions"] },
    { label: "기록·분석", icon: "chart", to: decisionId ? `/receipts/${decisionId}` : "/analytics", match: ["/receipts", "/analytics"] },
  ];

  return (
    <div className="nx-shell">
      <aside className="nx-sidebar">
        <Link to="/" className="nx-logo">
          <div className="nx-logo-mark">
            <span className="n">N</span> Nextera
          </div>
          <div className="nx-logo-sub">Industrial Decision Intelligence</div>
        </Link>

        <nav className="nx-nav" aria-label="주 메뉴">
          {items.map((it) => {
            const active = it.match.some((m) => pathname.startsWith(m));
            return (
              <Link key={it.label} to={it.to} className={`nx-nav-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
                <Icon name={it.icon} />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="nx-sidebar-foot">
          <span className="label">시뮬레이션 환경 · {incidentId}</span>
          <label className="label" htmlFor="nx-role">
            현재 역할
          </label>
          <select id="nx-role" className="nx-role-select" value={role} onChange={(e) => setRole(e.target.value as RoleId)}>
            {(["operator", "cooling_A", "gpu_B"] as RoleId[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <span className="nx-mode" title="VITE_API_MODE">
            <span className="dot" />
            {API_MODE === "mock" ? "MOCK 모드 · 서버 미연결" : "LIVE · 백엔드 연결"}
          </span>
        </div>
      </aside>

      <main className="nx-main">
        <Outlet />
      </main>
    </div>
  );
}
