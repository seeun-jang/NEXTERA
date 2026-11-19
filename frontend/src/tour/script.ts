// 자동 시연 대본 — 사업 제안 영상 구성: 문제 → 해결 구조(흐름도) → 데모 5단계 → 기업이 얻는 것 → 단계적 도입.
// 시뮬레이터 값에 따라 달라지는 숫자는 하드코딩하지 않고 화면의 문구를 읽어 자막에 쓴다.
// 검증하지 않은 성과 수치(절감률 등)는 넣지 않는다.
import type { Chapter } from "./TourProvider";
import { STAGES } from "./TourProvider";

export interface TourApi {
  sleep(ms: number): Promise<void>;
  waitFor(sel: string, text?: string, timeout?: number): Promise<Element>;
  text(sel: string, fallback?: string): Promise<string>;
  go(path: string): Promise<void>;
  caption(c: { tag?: string; title: string; sub?: string; top?: boolean } | null): void;
  chapter(c: Chapter, ms?: number): Promise<void>;
  spot(sel: string, c: { tag?: string; title: string; sub?: string; top?: boolean } | null, ms: number, opts?: { text?: string; block?: ScrollLogicalPosition }): Promise<void>;
  unspot(): void;
  click(sel: string, text?: string, opts?: { moveMs?: number; afterMs?: number }): Promise<void>;
  type(sel: string, value: string): Promise<void>;
  hideCursor(): void;
  scrollBy(dy: number, ms: number): Promise<void>;
  exists(sel: string, text?: string): boolean;
  stage(i: number): void;
}

export const ch = (i: number, sub: string): Chapter => ({
  no: String(i + 1).padStart(2, "0"),
  title: STAGES[i],
  sub,
  flow: { steps: STAGES, active: i },
});

export const BTN = "button";

export async function runScript(t: TourApi) {
  // 발표용 2분 버전 — 장면마다 자막 하나. "사건이 동시에 터진 날"로 여러 사건을 한 번에 다루는 흐름을 보여 준다.
  // ---------- 오프닝 ----------
  await t.go("/");
  window.scrollTo(0, 0);
  await t.chapter({ no: "", title: "NEXTERA", sub: "AI 인프라 운영팀을 위한 의사결정 에이전트", kind: "title" }, 1300);
  await t.chapter(
    {
      no: "",
      title: "기존 모니터링 위에 얹는 의사결정 · 검증 계층",
      sub: "상황을 정하면, 회사 규칙 안에서 AI가 계획을 고르고, 사람이 실행을 통제합니다",
      kind: "flow",
      flow: { steps: ["상황 설정", "사건 정렬", "계획 생성", "Zoro-1 선택", "안전 검사", "역할별 승인", "가상 실행", "회차 · 기록"], animate: true },
    },
    3600,
  );
  await t.click(BTN, "지금 체험하기", { moveMs: 500, afterMs: 700 });

  // ---------- 1 상황 설정 ----------
  await t.waitFor(".nx-scn-presets");
  t.hideCursor();
  await t.chapter(ch(0, "처음에 상황을 정한다"), 1200);
  t.stage(0);
  await t.click(".nx-scn-preset", "사건이 동시에 터진 날", { moveMs: 500, afterMs: 500 });
  t.hideCursor();
  await t.spot(".nx-sb-jobs", { tag: "상황 설정", title: "노드 · 냉각 구역 · 일을 직접 정합니다", sub: "GPU 합이 8장 이하면 동시에 실행, 넘으면 그 노드에서 대기" }, 2600);
  const pick0 = await t.text(".nx-scn-pick strong");
  await t.spot(".nx-scn-result", { tag: "상황 설정", title: "사건 3건이 동시에 생겼습니다", sub: `바로 계산한 AI 선택 → ${pick0}` }, 2600);
  t.unspot();
  await t.click(BTN, "이 상황으로 시작", { moveMs: 600, afterMs: 700 });

  // ---------- 2 상황 파악 ----------
  await t.waitFor(".nx-inc-list");
  t.hideCursor();
  await t.chapter(ch(1, "무엇이 급한가"), 1200);
  t.stage(1);
  await t.spot(".nx-inc-list", { tag: "운영 현황", title: "사건을 중요도 순으로 줄 세웁니다", sub: "한계까지 남은 시간이 짧을수록, 일의 우선순위가 높을수록 위" }, 3000);
  t.unspot();
  await t.click(BTN, "사건 상세 보기", { moveMs: 500, afterMs: 700 });
  await t.waitFor(".nx-callout");
  t.hideCursor();
  const forecast = await t.text(".nx-callout");
  await t.spot(".nx-split-main .nx-card", { tag: "사건 상세", title: "아무것도 하지 않으면?", sub: forecast }, 2400);
  t.unspot();
  await t.click(BTN, "회사 운영 정책 확인", { moveMs: 500, afterMs: 700 });

  // ---------- 3 판단 ----------
  await t.waitFor(".nx-funnel");
  t.hideCursor();
  await t.chapter(ch(2, "규칙 안에서 계획을 만들고 고른다"), 1200);
  t.stage(2);
  await t.spot(".nx-funnel", { tag: "운영 정책", title: "전략 10종으로 계획을 만들고 걸러냅니다", sub: "연쇄 계획 → 정리 · 합치기 → Safety Gate → 열위 제거 → Zoro-1" }, 3000);
  t.unspot();
  await t.click(BTN, "정책 적용 후 AI 판단", { moveMs: 500, afterMs: 800 });
  await t.waitFor(".nx-verdict", undefined, 20000);
  t.hideCursor();
  await t.spot(".nx-cands", { tag: "의사결정 센터", title: "후보 하나 = 행동 여러 개로 된 계획", sub: "검증된 후보만 Zoro-1에 전달 (최대 24개)" }, 2800);
  const pick = await t.text(".nx-verdict-main strong");
  await t.spot(".nx-verdict", { tag: "의사결정 센터", title: `AI의 선택: ${pick}`, sub: "한 계획으로 사건 3건을 함께 풉니다 · MOCK 응답" }, 2800);
  t.unspot();
  await t.click(BTN, "대안별 결과 보기", { moveMs: 500, afterMs: 800 });
  await t.waitFor(".nx-ftable");
  t.hideCursor();
  await t.spot(".nx-ftable", { tag: "대안별 결과", title: "계획마다 결과를 나란히 비교합니다", sub: "최고 온도 · 에너지 · 일별 완료 · 남는 문제" }, 2800);
  t.unspot();

  // ---------- 4 통제된 실행 ----------
  await t.chapter(ch(3, "AI가 골라도, 바로 실행되지 않는다"), 1200);
  t.stage(3);
  await t.click(BTN, "실행 전 안전 검사", { moveMs: 500, afterMs: 800 });
  await t.waitFor(".nx-banner--conditional, .nx-banner--allowed", undefined, 20000);
  t.hideCursor();
  await t.spot(".nx-split-main .nx-card", { tag: "안전 검사", title: "모델과 분리된 코드가 단계마다 다시 검사합니다", sub: "P0 보호 · 자리 · 멈추기 규칙 · 열 한계 · 승인 권한" }, 2400);
  t.unspot();
  await t.click(BTN, "강제 입력 검사 실행", { moveMs: 500, afterMs: 600 });
  t.hideCursor();
  await t.spot(".nx-testpanel .nx-block-danger", { tag: "안전 검사", title: "규칙을 어기는 행동은 차단됩니다", sub: "P0 일 옮기기 → 실행 큐 제외 · 기록은 영수증에" }, 2400);
  t.unspot();
  await t.click(BTN, "담당자 승인 요청", { moveMs: 500, afterMs: 800 });

  await t.waitFor(".nx-decide");
  t.caption({ tag: "협업 · 승인", title: "이 계획은 냉각(A)과 일 이동(B) 승인이 모두 필요합니다" });
  await t.click(".nx-decide .nx-seg button", "관제 운영자", { moveMs: 500, afterMs: 300 });
  await t.click(BTN, "그래도 서버에 승인 요청 보내 보기", { moveMs: 500, afterMs: 500 });
  t.hideCursor();
  await t.spot(".nx-decide .nx-block-danger", { tag: "협업 · 승인", title: "권한 없는 승인은 거부됩니다", sub: "버튼 비활성 + 서버 거부, 두 겹" }, 2200);
  t.unspot();
  await t.click(".nx-decide .nx-seg button", "A · 냉각 운영", { moveMs: 500, afterMs: 300 });
  t.hideCursor();
  await t.spot(".nx-card:has(.nx-comment-input)", { tag: "협업 · 승인", title: "냉각 담당자가 의견을 남기고 냉각 단계를 승인합니다", top: true }, 500);
  await t.type("input[aria-label='의견 입력']", "N4 팬은 오늘 교체하겠습니다.");
  await t.click(BTN, "의견 등록", { moveMs: 400, afterMs: 500 });
  await t.click(".nx-decide .nx-btn", "승인", { moveMs: 600, afterMs: 500 });
  await t.click(".nx-decide .nx-seg button", "B · GPU 운영", { moveMs: 500, afterMs: 300 });
  t.caption({ tag: "협업 · 승인", title: "GPU 담당자가 일 이동 단계를 승인하면 실행됩니다", sub: "실행 직전에 최신 상태로 한 번 더 검사" });
  await t.click(".nx-decide .nx-btn", "승인하고 실행", { moveMs: 600, afterMs: 900 });

  await t.waitFor(".nx-exec-banner", undefined, 20000);
  t.hideCursor();
  await t.spot(".nx-kpis--3", { tag: "실행 및 결과", title: "가상 환경에서만 실행하고 결과를 확인합니다", sub: "실제 설비 제어 없음 · 모든 수치는 시뮬레이션" }, 2500);
  t.unspot();
  await t.click(BTN, "회차 결과 보기", { moveMs: 500, afterMs: 700 });
  await t.waitFor(".nx-rounds");
  t.hideCursor();
  await t.spot(".nx-banner", { tag: "회차 요약", title: "실행 뒤 상태로 남은 문제를 다시 계산합니다", sub: "남으면 다음 회차, 풀 수 없으면 사람에게 넘김" }, 2400);
  t.unspot();

  // ---------- 5 결정 영수증 ----------
  await t.chapter(ch(4, "상황부터 결과까지, 하나의 기록으로"), 1200);
  t.stage(4);
  await t.click(BTN, "결정 영수증 확인", { moveMs: 500, afterMs: 800 });
  await t.waitFor(".nx-timeline");
  t.hideCursor();
  await t.spot(".nx-receipt-rounds", { tag: "결정 영수증", title: "회차마다 사건 · 후보 · 선택 · 승인 · 결과를 남깁니다", sub: "차단된 시도와 거부된 승인까지" }, 2400);
  await t.spot(".nx-timeline", { tag: "결정 영수증", title: "누가, 언제, 무엇을 결정했는지 추적합니다" }, 1800);
  t.unspot();

  // ---------- 기업이 얻는 것 · 도입 ----------
  t.stage(-1);
  await t.chapter(
    {
      no: "",
      title: "기업이 얻는 것",
      kind: "pitch",
      items: [
        { title: "안전한 실행", sub: "회사 규칙을 어기는 실행은 처음부터 차단" },
        { title: "동시다발 대응", sub: "여러 사건을 중요도 순으로 묶어 한 계획으로" },
        { title: "감사 대응", sub: "모든 결정의 근거 · 승인 · 결과를 한 기록으로" },
      ],
    },
    3000,
  );
  await t.chapter(
    {
      no: "",
      title: "도입은 단계적으로",
      kind: "pitch",
      numbered: true,
      items: [
        { title: "Shadow Mode", sub: "실제 텔레메트리를 읽기 전용으로 연결해 제안만 기록" },
        { title: "제한된 파일럿", sub: "일부 클러스터에서 기존 승인 흐름과 함께 운영" },
        { title: "운영 확대", sub: "사내 정책 · 티켓 시스템과 연동해 범위 확장" },
      ],
    },
    2800,
  );

  // ---------- 엔딩 ----------
  await t.chapter({ no: "", title: "Better Decisions. Better Operations.", sub: "NEXTERA · 더 나은 판단이 더 안전한 운영을 만듭니다", kind: "end" }, 2600);
  await t.go("/");
  window.scrollTo(0, 0);
}
