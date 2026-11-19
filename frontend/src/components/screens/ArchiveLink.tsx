import { useNavigate } from "react-router-dom";
import { Button } from "@/components/common";

/** 저장소로 가는 버튼. hidden(= GET /api/v2/history 의 hidden)이 0보다 크면 "저장소에서 N건 더 보기"로 바뀐다. */
export function ArchiveLink({ hidden = 0, size = "md" }: { hidden?: number; size?: "md" | "sm" }) {
  const navigate = useNavigate();
  return (
    <Button variant="secondary" size={size} onClick={() => navigate("/archive")}>
      {hidden > 0 ? `저장소에서 ${hidden}건 더 보기` : "저장소 열기"}
    </Button>
  );
}
