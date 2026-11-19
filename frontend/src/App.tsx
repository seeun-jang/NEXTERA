import { Link, Route, Routes, Navigate } from "react-router-dom";
import { AppShell, Button, Card, EmptyState, PageHeader } from "@/components/common";
import LandingPage from "@/pages/LandingPage";
import OperationsPage from "@/pages/OperationsPage";
import IncidentPage from "@/pages/IncidentPage";
import PoliciesPage from "@/pages/PoliciesPage";
import DecisionPage from "@/pages/DecisionPage";
import FuturesPage from "@/pages/FuturesPage";
import ValidatePage from "@/pages/ValidatePage";
import ApprovalPage from "@/pages/ApprovalPage";
import ExecutionPage from "@/pages/ExecutionPage";
import ReceiptPage from "@/pages/ReceiptPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import HandoffPage from "@/pages/HandoffPage";
import ScenarioPage from "@/pages/ScenarioPage";
import RoundPage from "@/pages/RoundPage";

// 라우트 = 화면 01~12 (번호와 단계는 components/common/StageGuide.tsx 한 곳에서 관리)
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<AppShell />}>
        <Route path="/scenario" element={<ScenarioPage />} />
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/incidents/:id" element={<IncidentPage />} />
        <Route path="/policies" element={<PoliciesPage />} />
        <Route path="/decision/:round" element={<DecisionPage />} />
        <Route path="/decision/:round/futures" element={<FuturesPage />} />
        <Route path="/decision/:round/validate" element={<ValidatePage />} />
        <Route path="/decision/:round/handoff" element={<HandoffPage />} />
        <Route path="/approvals" element={<ApprovalPage />} />
        <Route path="/approvals/:round" element={<ApprovalPage />} />
        <Route path="/executions/:round" element={<ExecutionPage />} />
        <Route path="/rounds/:round" element={<RoundPage />} />
        <Route path="/receipts" element={<ReceiptPage />} />
        <Route path="/receipts/:id" element={<ReceiptPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        {/* 예전 조건 실험 주소는 상황 설정으로 보낸다 */}
        <Route path="/lab/*" element={<Navigate to="/scenario" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <>
      <PageHeader crumbs={["NEXTERA"]} title="화면을 찾을 수 없습니다" guide={false} />
      <div className="nx-content">
        <Card>
          <EmptyState
            title="없는 주소입니다"
            description="사이드바 메뉴에서 화면을 고르거나 운영 현황으로 돌아가세요."
            action={
              <Link to="/operations">
                <Button variant="secondary" size="sm">
                  운영 현황으로
                </Button>
              </Link>
            }
          />
        </Card>
      </div>
    </>
  );
}
