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
  caption(c: { tag?: string; title: string; sub?: string } | null): void;
  chapter(c: Chapter, ms?: number): Promise<void>;
  spot(sel: string, c: { tag?: string; title: string; sub?: string } | null, ms: number, opts?: { text?: string; block?: ScrollLogicalPosition }): Promise<void>;
  unspot(): void;
  click(sel: string, text?: string, opts?: { moveMs?: number; afterMs?: number }): Promise<void>;
  type(sel: string, value: string): Promise<void>;
  hideCursor(): void;
  scrollBy(dy: number, ms: number): Promise<void>;
  exists(sel: string, text?: string): boolean;
  stage(i: number): void;
}

const ch = (i: number, sub: string): Chapter => ({
  no: String(i + 1).padStart(2, "0"),
  title: STAGES[i],
  sub,
  flow: { steps: STAGES, active: i },
});

const BTN = "button";

export async function runScript(t: TourApi) {
  // ---------- 오프닝 ----------
  await t.go("/");
  window.scrollTo(0, 0);
  await t.chapter({ no: "", title: "NEXTERA", sub: "AI 인프라 운영팀을 위한 의사결정 에이전트", kind: "title" }, 2600);
  await t.chapter(
    {
      no: "",
      title: "AI 인프라는 멈추면 안 됩니다",
      kind: "pitch",
      items: [
        { title: "과열된 노드 위에서 마감이 임박한 작업이 돌고 있다", sub: "GPU 클러스터에서 매일 생기는 충돌" },
        { title: "식히면 에너지, 옮기면 지연, 미루면 고객 약속 위반", sub: "어느 쪽도 공짜가 아니다" },
        { title: "사내 규정과 승인 권한까지 함께 봐야 한다", sub: "모니터링만으로는 결정할 수 없다" },
      ],
    },
    4200,
  );
  await t.chapter(
    {
      no: "",
      title: "기존 모니터링 위에 얹는 의사결정 · 검증 계층",
      sub: "회사가 규칙을 정하고, AI가 고르고, 사람이 실행을 통제합니다",
      kind: "flow",
      flow: { steps: ["기업 정책", "Zoro-1 판단", "조건 실험", "독립 안전 검사", "권한자 승인", "가상 실행", "결정 영수증"], animate: true },
    },
    5000,
  );
  await t.spot(".lp-glass", { title: "지금, 한 노드가 뜨거워지고 있습니다", sub: "실제 시연 화면으로 따라가 봅니다" }, 2400);
  t.unspot();
  await t.click(BTN, "지금 체험하기", { afterMs: 900 });

  // ---------- 01 상황 ----------
  await t.waitFor(".nx-incident");
  t.hideCursor();
  await t.chapter(ch(0, "무엇이 문제인가"), 2300);
  t.stage(0);
  await t.spot(".nx-node.alert", { tag: "운영 현황", title: "N4가 10분 사이 빠르게 뜨거워졌습니다", sub: "팬 이상까지 보고된 노드" }, 3000);
  await t.spot(".nx-incident", { tag: "운영 현황", title: "그 위에서는 마감 5분 남은 중요 작업이 돌고 있습니다", sub: "식히면 에너지, 옮기면 재시작 지연, 미루면 마감 위반 — 조건이 충돌합니다" }, 4200);
  t.unspot();
  await t.click(BTN, "사건 상세 보기", { afterMs: 900 });

  await t.waitFor(".nx-callout");
  t.hideCursor();
  const forecast = await t.text(".nx-callout");
  await t.spot(".nx-split-main .nx-card", { tag: "사건 상세", title: "아무것도 하지 않으면?", sub: forecast }, 4200);
  await t.spot(".nx-reasons", { tag: "사건 상세", title: "단순 임계값 규칙으로는 풀 수 없습니다", sub: "팬 이상 · 마감과 재시작 비용 · 옮길 자리와 승인 권한" }, 4000);
  t.unspot();
  await t.click(BTN, "회사 운영 정책 확인", { afterMs: 900 });

  // ---------- 02 판단 ----------
  await t.waitFor(".nx-funnel");
  t.hideCursor();
  await t.chapter(ch(1, "회사 규칙 안에서 AI가 고른다"), 2300);
  t.stage(1);
  await t.spot(".nx-split-main .nx-table", { tag: "운영 정책", title: "회사가 먼저 규칙을 정합니다", sub: "필수 제약은 어떤 승인으로도 풀리지 않습니다" }, 2600);
  await t.spot(".nx-funnel", { tag: "운영 정책", title: "규칙을 어기는 후보는 AI에게 전달조차 되지 않습니다", sub: "후보 7개 → AI 판단 대상 5개" }, 3800);
  t.unspot();
  await t.click(BTN, "정책 적용 후 AI 판단", { afterMs: 1200 });

  await t.waitFor(".nx-verdict", undefined, 30000);
  t.hideCursor();
  const live = t.exists(".nx-modelbar.live");
  await t.spot(".nx-modelbar", { tag: "의사결정 센터", title: live ? "Zoro-1이 실시간으로 판단합니다" : "Zoro-1 판단 (초안 영상: MOCK 응답)", sub: "실제 모델 출력은 검정 배지, 예시 응답은 점선 배지로 구분합니다" }, 3200);
  await t.spot(".nx-cands", { tag: "의사결정 센터", title: "허용된 다섯 가지 중 하나를 고릅니다", sub: live ? "후보별 확률과 함께" : "실제 모델 연결 시 후보별 확률 표시" }, 3800);
  const pick = await t.text(".nx-verdict-main strong");
  await t.spot(".nx-verdict", { tag: "의사결정 센터", title: `AI의 선택: ${pick}`, sub: "아직 실행 전 — 안전 검사와 승인이 남았습니다" }, 3400);
  t.unspot();

  // ---------- 03 판단 실험 ----------
  await t.chapter(ch(2, "조건 하나만 바꿔 다시 묻는다"), 2300);
  t.stage(2);
  await t.click(BTN, "조건 변경 실험", { afterMs: 900 });
  await t.waitFor(".nx-condtable");
  await t.click(BTN, "마감 3분 (단축)", { afterMs: 500 });
  t.hideCursor();
  await t.spot(".nx-condtable tr.changed", { tag: "조건 실험", title: "마감만 5분 → 3분으로 바꿔 봅니다", sub: "실제 운영 값은 그대로 · 실험 값은 '가정'으로 기록" }, 3200);
  t.unspot();
  await t.click(BTN, "변경 조건으로 재판단", { afterMs: 1200 });

  await t.waitFor(".nx-abgrid", undefined, 30000);
  t.hideCursor();
  await t.spot(".nx-abgrid", { tag: "A/B 비교", title: "같은 상황, 다른 마감 → 다른 판단", sub: "미리 만든 답이 아니라 후보 생성 · 정책 검사 · 판단을 다시 실행한 결과" }, 4800);
  await t.spot(".nx-bars", { tag: "A/B 비교", title: "왜 바뀌었을까?", sub: "막대 = 예상 완료 · 점선 = 마감 · 빗금 = 마감 초과" }, 3800);
  const why = await t.text(".nx-why");
  await t.spot(".nx-why", { tag: "A/B 비교", title: "판단의 이유까지 비교합니다", sub: why.length > 90 ? `${why.slice(0, 88)}…` : why }, 4200);
  t.unspot();

  // ---------- 04 통제된 실행 ----------
  await t.chapter(ch(3, "AI가 골라도, 바로 실행되지 않는다"), 2300);
  t.stage(3);
  await t.click(BTN, "실행 전 안전 검사", { afterMs: 1000 });
  await t.waitFor(".nx-banner--conditional, .nx-banner--allowed, .nx-banner--blocked", undefined, 20000);
  t.hideCursor();
  await t.spot(".nx-split-main .nx-card", { tag: "안전 검사", title: "모델과 분리된 코드가 다시 검사합니다", sub: "용량 · P0 작업 보호 · 열 안전 한계 · 마감 · 승인 권한" }, 4000);
  t.unspot();
  await t.click(BTN, "강제 입력 검사 실행", { afterMs: 900 });
  t.hideCursor();
  await t.spot(".nx-testpanel", { tag: "안전 검사", title: "누군가 여유 GPU가 없는 N3로 옮기라고 한다면?", sub: "정책 단계에서 이미 빠진 행동을 일부러 넣는 테스트" }, 4200);
  await t.spot(".nx-testpanel .nx-block-danger", { tag: "안전 검사", title: "차단 · 실행 큐에 들어가지 않습니다", sub: "차단 기록은 결정 영수증에 그대로 남습니다" }, 3000);
  t.unspot();
  await t.click(BTN, "담당자 승인 요청", { afterMs: 1000 });

  await t.waitFor(".nx-decide");
  t.hideCursor();
  await t.spot(".nx-proposal", { tag: "협업 · 승인", title: "실행하려면 권한 있는 사람의 승인이 필요합니다" }, 2600);
  await t.click(".nx-decide .nx-seg button", "A · 냉각 운영", { afterMs: 400 });
  t.hideCursor();
  await t.spot(".nx-card:has(.nx-comment-input)", { tag: "협업 · 승인", title: "냉각 담당자가 의견을 남깁니다", sub: "어느 역할이든 의견은 남길 수 있습니다" }, 900);
  await t.type("input[aria-label='의견 입력']", "Z2 냉각은 현재 레벨로 유지해도 됩니다. N4가 비면 바로 팬을 교체하겠습니다.");
  await t.click(BTN, "의견 등록", { afterMs: 500 });
  t.hideCursor();
  await t.spot(".nx-card:has(.nx-comment-input)", { tag: "협업 · 승인", title: "의견은 승인 이력에 그대로 남습니다" }, 1600);
  await t.spot(".nx-decide", { tag: "협업 · 승인", title: "냉각 담당자는 의견만 남길 수 있습니다", sub: "작업 이동 승인 권한이 없어 버튼이 잠겨 있습니다" }, 3400);
  await t.click(BTN, "그래도 서버에 승인 요청 보내 보기", { afterMs: 700 });
  t.hideCursor();
  await t.spot(".nx-decide .nx-block-danger", { tag: "협업 · 승인", title: "화면을 우회해도 서버가 거부합니다", sub: "권한 검사는 버튼 + 서버 두 겹" }, 3000);
  t.unspot();
  await t.click(".nx-decide .nx-seg button", "B · GPU 운영", { afterMs: 400 });
  t.caption({ tag: "협업 · 승인", title: "GPU 운영 담당자가 승인합니다", sub: "실행 직전에 최신 상태로 한 번 더 검사" });
  await t.click(BTN, "승인하고 실행", { afterMs: 1400 });

  await t.waitFor(".nx-exec-banner", undefined, 30000);
  t.hideCursor();
  await t.spot(".nx-kpis--3", { tag: "실행 및 결과", title: "가상 환경에서만 실행합니다", sub: "실제 설비 제어 없음 · 모든 수치는 시뮬레이션" }, 3600);
  await t.spot(".nx-split-main .nx-table", { tag: "실행 및 결과", title: "실행 전과 후를 비교합니다" }, 2800);
  t.unspot();

  // ---------- 05 결정 영수증 ----------
  await t.chapter(ch(4, "판단부터 결과까지, 하나의 기록으로"), 2300);
  t.stage(4);
  await t.click(BTN, "결정 영수증 확인", { afterMs: 1000 });
  await t.waitFor(".nx-timeline");
  t.hideCursor();
  await t.spot(".nx-receipt-head", { tag: "결정 영수증", title: "결정마다 영수증이 남습니다", sub: "정책 버전 · 입력 상태 · 판단 제공자" }, 2200);
  await t.spot(".nx-col.nx-split-main > section:nth-child(2) .nx-card", { tag: "결정 영수증", title: "고르지 않은 대안과 차단된 시도까지", sub: "원래 AI 제안은 덮어쓰지 않습니다" }, 3600);
  await t.spot(".nx-timeline", { tag: "결정 영수증", title: "누가, 언제, 무엇을 결정했는지 추적합니다" }, 1200, { block: "start" });
  await t.scrollBy(500, 3000);
  await t.sleep(800);
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
        { title: "빠른 판단", sub: "조건이 바뀌면 바로 다시 판단하고 대안을 비교" },
        { title: "감사 대응", sub: "모든 결정의 근거 · 승인 · 결과를 한 기록으로" },
      ],
    },
    4000,
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
    4200,
  );

  // ---------- 엔딩 ----------
  await t.chapter({ no: "", title: "Better Decisions. Better Operations.", sub: "NEXTERA · 더 나은 판단이 더 안전한 운영을 만듭니다", kind: "end" }, 4000);
  await t.go("/");
  window.scrollTo(0, 0);
}
