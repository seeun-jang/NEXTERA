// 자동 시연 대본 · 제출용 긴 버전 (약 5분) — 기능을 빠짐없이, 자막을 읽을 시간이 충분하게.
// 발표용 2분 버전은 script.ts. 두 대본은 같은 화면 · 같은 TourApi를 쓰고, 이 파일은 장면과 시간만 다르다.
// 시작: 주소에 ?tour=full
import { BTN, ch, type TourApi } from "./script";

const READ = 4200; // 자막 한 장면 기본 시간
const MOVE = { moveMs: 800, afterMs: 900 };

export async function runScriptFull(t: TourApi) {
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
    5600,
  );
  await t.chapter(
    {
      no: "",
      title: "기존 모니터링 위에 얹는 의사결정 · 검증 계층",
      sub: "상황을 정하면, 회사 규칙 안에서 AI가 고르고, 사람이 실행을 통제합니다",
      kind: "flow",
      flow: { steps: ["상황 설정", "기업 정책", "Zoro-1 판단", "대안별 결과", "독립 안전 검사", "권한자 승인", "가상 실행", "결정 영수증"], animate: true },
    },
    5600,
  );
  await t.spot(".lp-glass", { title: "지금, 한 노드가 뜨거워지고 있습니다", sub: "실제 시연 화면으로 따라가 봅니다" }, 3000);
  t.unspot();
  await t.click(BTN, "지금 체험하기", MOVE);

  // ---------- 1 상황 설정 ----------
  await t.waitFor(".nx-scn-pick strong", undefined, 15000);
  t.hideCursor();
  await t.chapter(ch(0, "처음에 상황과 조건을 정한다"), 2400);
  t.stage(0);
  await t.spot(".nx-scn-presets", { tag: "상황 설정", title: "시연할 상황을 고릅니다", sub: "정해진 한 장면이 아니라, 여러 날의 상황을 바로 바꿔 볼 수 있습니다" }, READ);
  await t.spot(".nx-scn-table", { tag: "상황 설정", title: "조건을 하나씩 직접 바꿀 수도 있습니다", sub: "N4 온도 · 마감 · 우선순위 · 옮길 자리 · 냉각 여유 · 운영 목표 · 승인 지연" }, READ);
  const base = await t.text(".nx-scn-pick strong");
  await t.spot(".nx-scn-result", { tag: "상황 설정", title: `기본 상황에서 AI는 "${base}"를 고릅니다`, sub: "값을 바꿀 때마다 회사 정책을 적용해 다시 판단합니다" }, READ);
  t.unspot();

  await t.click(".nx-scn-preset", "옮길 자리가 없는 날", { moveMs: 800, afterMs: 1900 });
  t.hideCursor();
  const full = await t.text(".nx-scn-pick strong");
  await t.spot(".nx-scn-result", { tag: "상황 설정", title: "N2가 꽉 찬 날이면?", sub: `옮길 자리가 없어 이동은 정책에 막히고 → "${full}"` }, 4800);
  t.unspot();

  await t.click(".nx-scn-preset", "마감이 아주 촉박한 날", { moveMs: 800, afterMs: 1900 });
  t.hideCursor();
  const tight = await t.text(".nx-scn-pick strong");
  await t.spot(".nx-scn-result", { tag: "상황 설정", title: "마감이 2분밖에 없다면?", sub: `어떤 조작도 마감 안에 끝나지 않아 → "${tight}" · 무리해서 실행하지 않습니다` }, 4800);
  t.unspot();

  await t.click(".nx-scn-preset", "기본 상황", { moveMs: 800, afterMs: 700 });
  await t.click(".nx-scn-table [aria-label='N2 여유 GPU'] button", "0장", { moveMs: 700, afterMs: 300 });
  await t.click(".nx-scn-table [aria-label='Z2 냉각 상한'] button", "3 (여유 없음)", { moveMs: 700, afterMs: 1900 });
  t.hideCursor();
  const custom = await t.text(".nx-scn-pick strong");
  await t.spot(".nx-scn-result", { tag: "상황 설정 · 직접 조정", title: "옮길 자리도, 냉각 여유도 없다면?", sub: `남은 대안 → "${custom}"` }, 4800);
  t.unspot();

  await t.click(BTN, "기본값으로", { moveMs: 800, afterMs: 1500 });
  t.caption({ tag: "상황 설정", title: "이번 시연은 기본 상황으로 끝까지 따라갑니다", sub: "이후 화면은 모두 이 설정이 만든 결과입니다" });
  await t.sleep(2200);
  await t.click(BTN, "이 상황으로 시작", MOVE);

  // ---------- 2 상황 파악 ----------
  await t.waitFor(".nx-incident");
  t.hideCursor();
  await t.chapter(ch(1, "무엇이 문제인가"), 2400);
  t.stage(1);
  await t.spot(".nx-node.alert", { tag: "운영 현황", title: "N4가 10분 사이 빠르게 뜨거워졌습니다", sub: "설비팀이 팬 교체가 필요하다고 남긴 노드" }, READ);
  await t.spot(".nx-incident", { tag: "운영 현황", title: "그 위에서 마감 5분 남은 중요 작업 J07이 돌고 있습니다", sub: "식히면 에너지, 옮기면 재시작 지연, 미루면 마감 위반 — 조건이 서로 충돌합니다" }, 5000);
  t.unspot();
  await t.click(BTN, "사건 상세 보기", MOVE);

  await t.waitFor(".nx-callout");
  t.hideCursor();
  const forecast = await t.text(".nx-callout");
  await t.spot(".nx-split-main .nx-card", { tag: "사건 상세", title: "아무것도 하지 않으면?", sub: forecast }, 5000);
  await t.spot(".nx-reasons", { tag: "사건 상세", title: "단순 임계값 규칙으로는 풀 수 없습니다", sub: "팬 이상 · 마감과 재시작 비용 · 옮길 자리와 승인 권한을 함께 봐야 합니다" }, 4800);
  t.unspot();
  await t.click(BTN, "회사 운영 정책 확인", MOVE);

  // ---------- 3 판단 ----------
  await t.waitFor(".nx-funnel");
  t.hideCursor();
  await t.chapter(ch(2, "회사 규칙 안에서 AI가 고른다"), 2400);
  t.stage(2);
  await t.spot(".nx-split-main .nx-table", { tag: "운영 정책", title: "회사가 먼저 규칙을 정합니다", sub: "필수 제약은 어떤 승인으로도 풀리지 않습니다" }, READ);
  await t.spot(".nx-funnel", { tag: "운영 정책", title: "규칙을 어기는 후보는 AI에게 전달조차 되지 않습니다", sub: "후보 7개 → AI 판단 대상 5개" }, 4600);
  t.unspot();
  await t.click(BTN, "정책 적용 후 AI 판단", { moveMs: 800, afterMs: 1200 });

  await t.waitFor(".nx-verdict", undefined, 30000);
  t.hideCursor();
  const live = t.exists(".nx-modelbar.live");
  await t.spot(".nx-modelbar", { tag: "의사결정 센터", title: live ? "Zoro-1이 실시간으로 판단합니다" : "Zoro-1 판단 자리 (이 영상은 MOCK 응답)", sub: "실제 모델 출력은 검정 배지, 예시 응답은 점선 배지로 구분합니다" }, READ);
  await t.spot(".nx-cands", { tag: "의사결정 센터", title: "허용된 다섯 가지 안에서만 고릅니다", sub: live ? "후보별 확률과 함께" : "실제 모델 연결 시 후보별 확률 표시" }, READ);
  await t.spot(".nx-cand.first-handoff", { tag: "의사결정 센터", title: "안전한 설비 조작이 없으면 사람에게 넘깁니다", sub: "추가 정보 요청 · 운영자 호출 — 무리해서 실행하지 않습니다" }, READ);
  const pick = await t.text(".nx-verdict-main strong");
  await t.spot(".nx-verdict", { tag: "의사결정 센터", title: `AI의 선택: ${pick}`, sub: "판단 이유와 함께 · 아직 실행 전입니다" }, 4600);
  t.unspot();
  await t.click(BTN, "대안별 결과 보기", MOVE);

  await t.waitFor(".nx-futures", undefined, 20000);
  t.hideCursor();
  await t.spot(".nx-futures", { tag: "대안별 결과", title: "행동마다 5분 뒤를 나란히 비교합니다", sub: "같은 상황 · 같은 시드에서 행동만 다르게 — 온도 · 마감 · 냉각 에너지 · 위험" }, 5600);
  t.unspot();

  // ---------- 4 통제된 실행 ----------
  await t.chapter(ch(3, "AI가 골라도, 바로 실행되지 않는다"), 2400);
  t.stage(3);
  await t.click(BTN, "실행 전 안전 검사", MOVE);
  await t.waitFor(".nx-banner--conditional, .nx-banner--allowed, .nx-banner--blocked", undefined, 20000);
  t.hideCursor();
  await t.spot(".nx-split-main .nx-card", { tag: "안전 검사", title: "모델과 분리된 코드가 다시 검사합니다", sub: "용량 · P0 작업 보호 · 열 안전 한계 · 마감 · 승인 권한" }, 4800);
  t.unspot();
  await t.click(BTN, "강제 입력 검사 실행", MOVE);
  t.hideCursor();
  await t.spot(".nx-testpanel", { tag: "안전 검사", title: "누군가 여유 GPU가 없는 N3로 옮기라고 한다면?", sub: "정책 단계에서 이미 빠진 행동을 일부러 넣는 테스트" }, READ);
  await t.spot(".nx-testpanel .nx-block-danger", { tag: "안전 검사", title: "차단 · 실행 큐에 들어가지 않습니다", sub: "차단 기록은 결정 영수증에 그대로 남습니다" }, 3800);
  t.unspot();
  await t.click(BTN, "담당자 승인 요청", MOVE);

  await t.waitFor(".nx-decide");
  t.hideCursor();
  await t.spot(".nx-proposal", { tag: "협업 · 승인", title: "실행하려면 권한 있는 사람의 승인이 필요합니다", sub: "필요한 승인자와 알림 받은 역할이 함께 표시됩니다" }, READ);
  t.unspot();
  await t.click(".nx-decide .nx-seg button", "A · 냉각 운영", { moveMs: 800, afterMs: 400 });
  t.hideCursor();
  await t.spot(".nx-card:has(.nx-comment-input)", { tag: "협업 · 승인", title: "냉각 담당자가 의견을 남깁니다", sub: "어느 역할이든 의견은 남길 수 있습니다", top: true }, 1200);
  await t.type("input[aria-label='의견 입력']", "Z2 냉각은 현재 레벨로 유지해도 됩니다. N4가 비면 바로 팬을 교체하겠습니다.");
  await t.click(BTN, "의견 등록", { moveMs: 600, afterMs: 600 });
  t.hideCursor();
  await t.spot(".nx-card:has(.nx-comment-input)", { tag: "협업 · 승인", title: "의견은 승인 이력에 그대로 남습니다", top: true }, 2800);
  await t.spot(".nx-decide", { tag: "협업 · 승인", title: "하지만 냉각 담당자는 작업 이동을 승인할 수 없습니다", sub: "권한이 없어 승인 버튼이 잠겨 있습니다" }, READ);
  await t.click(BTN, "그래도 서버에 승인 요청 보내 보기", MOVE);
  t.hideCursor();
  await t.spot(".nx-decide .nx-block-danger", { tag: "협업 · 승인", title: "화면을 우회해도 서버가 거부합니다", sub: "권한 검사는 버튼 + 서버 두 겹" }, READ);
  t.unspot();
  await t.click(".nx-decide .nx-seg button", "B · GPU 운영", { moveMs: 800, afterMs: 500 });
  t.caption({ tag: "협업 · 승인", title: "GPU 운영 담당자가 승인합니다", sub: "실행 직전에 최신 상태로 한 번 더 검사" });
  await t.sleep(1800);
  await t.click(BTN, "승인하고 실행", { moveMs: 800, afterMs: 1400 });

  await t.waitFor(".nx-exec-banner", undefined, 30000);
  t.hideCursor();
  await t.spot(".nx-kpis--3", { tag: "실행 및 결과", title: "가상 환경에서만 실행합니다", sub: "실제 설비 제어 없음 · 모든 수치는 시뮬레이션" }, READ);
  await t.spot(".nx-split-main .nx-table", { tag: "실행 및 결과", title: "실행 전과 후를 비교합니다", sub: "바뀐 값만 보여 줍니다" }, READ);
  t.unspot();

  // ---------- 5 결정 영수증 ----------
  await t.chapter(ch(4, "판단부터 결과까지, 하나의 기록으로"), 2400);
  t.stage(4);
  await t.click(BTN, "결정 영수증 확인", MOVE);
  await t.waitFor(".nx-timeline");
  t.hideCursor();
  await t.spot(".nx-col.nx-split-main > section:nth-child(2) .nx-card", { tag: "결정 영수증", title: "고르지 않은 대안과 차단된 시도까지 남깁니다", sub: "원래 AI 제안은 덮어쓰지 않습니다" }, READ);
  await t.spot(".nx-timeline", { tag: "결정 영수증", title: "누가, 언제, 무엇을 결정했는지 추적합니다", sub: "설정한 상황도 기록의 첫 줄에 남습니다" }, 1400, { block: "start" });
  await t.scrollBy(600, 2800);
  t.unspot();
  await t.click(BTN, "기록 상세 보기", MOVE);

  await t.waitFor(".nx-tbars", undefined, 20000);
  t.hideCursor();
  await t.spot(".nx-kpis--6", { tag: "기록 · 분석", title: "쌓인 결정 기록으로 운영 품질을 봅니다", sub: "이 화면의 숫자는 예시 데이터입니다" }, READ);
  await t.spot(".nx-tbars", { tag: "기록 · 분석", title: "어떤 유형의 사건에서 마감을 놓쳤는지 찾습니다", sub: "실패 패턴 → 정책 · 시스템 개선으로 연결" }, READ);
  t.unspot();

  // ---------- 다른 상황: 사람에게 넘김 ----------
  t.stage(-1);
  await t.chapter({ no: "", title: "다른 상황이라면?", sub: "마감이 2분밖에 없는 날 — 안전한 대안이 없을 때", kind: "title" }, 2800);
  await t.go("/scenario");
  await t.waitFor(".nx-scn-pick strong", undefined, 15000);
  await t.click(".nx-scn-preset", "마감이 아주 촉박한 날", { moveMs: 800, afterMs: 1900 });
  t.hideCursor();
  t.stage(0);
  t.caption({ tag: "상황 설정", title: "같은 흐름, 다른 상황", sub: "마감 2분으로 시작합니다" });
  await t.sleep(1600);
  await t.click(BTN, "이 상황으로 시작", MOVE);
  await t.waitFor(".nx-incident");
  await t.go("/policies");
  await t.waitFor(".nx-funnel");
  t.stage(2);
  await t.click(BTN, "정책 적용 후 AI 판단", { moveMs: 800, afterMs: 1200 });
  await t.waitFor(".nx-verdict", undefined, 30000);
  t.hideCursor();
  const esc = await t.text(".nx-verdict-main strong");
  await t.spot(".nx-verdict", { tag: "의사결정 센터", title: `AI의 선택: ${esc}`, sub: "마감 안에 끝나는 설비 조작이 하나도 없습니다" }, READ);
  t.unspot();
  t.stage(3);
  await t.click(BTN, "사람에게 넘김 보기", MOVE);
  await t.waitFor(".nx-handoff");
  t.hideCursor();
  await t.spot(".nx-handoff", { tag: "사람에게 넘김", title: "AI가 멈추고 사람을 부릅니다", sub: "설비는 건드리지 않고, 승인·실행 단계로도 가지 않습니다" }, READ);
  await t.spot(".nx-ticket", { tag: "사람에게 넘김", title: "누구에게 무엇을 요청했는지 남깁니다", sub: "이 요청과 이유도 결정 영수증에 기록됩니다" }, READ);
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
        { title: "빠른 판단", sub: "상황이 바뀌면 바로 다시 판단하고 대안을 비교" },
        { title: "감사 대응", sub: "모든 결정의 근거 · 승인 · 결과를 한 기록으로" },
      ],
    },
    5000,
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
    5000,
  );

  // ---------- 엔딩 ----------
  await t.chapter({ no: "", title: "Better Decisions. Better Operations.", sub: "NEXTERA · 더 나은 판단이 더 안전한 운영을 만듭니다", kind: "end" }, 3600);
  await t.go("/");
  window.scrollTo(0, 0);
}
