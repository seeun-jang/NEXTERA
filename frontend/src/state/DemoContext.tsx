import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { RoleId } from "@contracts/types";
import { setClientRole } from "@/api/role";

// 시연 한 판의 "현재 위치". 사이드바 메뉴가 이 값으로 최신 화면을 연다.
export interface DemoIds {
  incidentId: string;
  decisionId: string | null;
  branchId: string | null;
  approvalId: string | null;
  executionId: string | null;
}

interface DemoContextValue extends DemoIds {
  role: RoleId;
  setRole: (r: RoleId) => void;
  setIds: (patch: Partial<DemoIds>) => void;
  resetIds: () => void;
}

const INITIAL: DemoIds = {
  incidentId: "INC-0412",
  decisionId: null,
  branchId: null,
  approvalId: null,
  executionId: null,
};

const KEY = "nextera.demo";

function load(): { ids: DemoIds; role: RoleId } {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* 저장소를 못 쓰는 환경이면 메모리로만 */
  }
  return { ids: INITIAL, role: "operator" };
}

function save(v: { ids: DemoIds; role: RoleId }) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* 무시 */
  }
}

const Ctx = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(load, []);
  const [ids, setIdsState] = useState<DemoIds>(initial.ids);
  const [role, setRoleState] = useState<RoleId>(() => {
    setClientRole(initial.role);
    return initial.role;
  });

  const setRole = useCallback(
    (r: RoleId) => {
      setClientRole(r);
      setRoleState(r);
      save({ ids, role: r });
    },
    [ids],
  );

  const setIds = useCallback(
    (patch: Partial<DemoIds>) => {
      setIdsState((prev) => {
        const next = { ...prev, ...patch };
        save({ ids: next, role });
        return next;
      });
    },
    [role],
  );

  const resetIds = useCallback(() => {
    setIdsState(INITIAL);
    setClientRole("operator");
    setRoleState("operator");
    save({ ids: INITIAL, role: "operator" });
  }, []);

  const value = useMemo(() => ({ ...ids, role, setRole, setIds, resetIds }), [ids, role, setRole, setIds, resetIds]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo(): DemoContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDemo는 DemoProvider 안에서만 쓸 수 있습니다.");
  return v;
}
