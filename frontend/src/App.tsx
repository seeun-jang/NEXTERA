import { Link, Route, Routes } from "react-router-dom";
import { AppShell, Button, Card, EmptyState, PageHeader } from "@/components/common";
import LandingPage from "@/pages/LandingPage";
import OperationsPage from "@/pages/OperationsPage";
import IncidentPage from "@/pages/IncidentPage";
import PoliciesPage from "@/pages/PoliciesPage";
import DecisionPage from "@/pages/DecisionPage";
import LabPage from "@/pages/LabPage";
import ComparePage from "@/pages/ComparePage";
import FuturesPage from "@/pages/FuturesPage";
import ValidatePage from "@/pages/ValidatePage";
import ApprovalPage from "@/pages/ApprovalPage";
import ExecutionPage from "@/pages/ExecutionPage";
import ReceiptPage from "@/pages/ReceiptPage";
import AnalyticsPage from "@/pages/AnalyticsPage";

// 라우트 = 스토리보드 SCREEN 01~13 (§8)
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<AppShell />}>
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/incidents/:id" element={<IncidentPage />} />
        <Route path="/policies" element={<PoliciesPage />} />
        <Route path="/decision/:id" element={<DecisionPage />} />
        <Route path="/decision/:id/futures" element={<FuturesPage />} />
        <Route path="/decision/:id/validate" element={<ValidatePage />} />
        <Route path="/lab/:snapshot" element={<LabPage />} />
        <Route path="/lab/:branch/compare" element={<ComparePage />} />
        <Route path="/approvals" element={<ApprovalPage />} />
        <Route path="/approvals/:id" element={<ApprovalPage />} />
        <Route path="/executions/:id" element={<ExecutionPage />} />
        <Route path="/receipts/:id" element={<ReceiptPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <>
      <PageHeader crumbs={["NEXTERA"]} title="화면을 찾을 수 없습니다" />
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
