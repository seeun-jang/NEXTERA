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
        { title: "과열 노드, 마감이 임박한 일, 줄 서 있는 일이 동시에 생긴다", sub: "GPU 클러스터에서 매일 생기는 충돌" },
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
      sub: "상황을 정하면, 회사 규칙 안에서 AI가 계획을 고르고, 사람이 실행을 통제합니다",
      kind: "flow",
      flow: { steps: ["상황 설정", "사건 정렬", "계획 생성", "Zoro-1 선택", "안전 검사", "역할별 승인", "가상 실행", "회차 · 기록"], animate: true },
    },
    5600,
  );
  await t.click(BTN, "지금 체험하기", MOVE);

  // ---------- 1 상황 설정 ----------
  await t.waitFor(".nx-scn-presets");
  t.hideCursor();
  await t.chapter(ch(0, "처음에 상황을 정한다"), 2400);
  t.stage(0);
  await t.spot(".nx-scn-presets", { tag: "상황 설정", title: "시연할 상황을 고릅니다", sub: "정해진 한 장면이 아니라, 여러 날의 상황을 바로 바꿔 볼 수 있습니다" }, READ);
  await t.spot(".nx-sb-zones", { tag: "상황 설정", title: "노드 1~6개 · 온도 · 팬 이상 · 구역별 냉각 레벨과 상한", sub: "냉각 구역 하나가 노드 2개를 맡습니다 (N1·N2=Z1, N3·N4=Z2, N5·N6=Z3)" }, READ);
  await t.spot(".nx-sb-jobs", { tag: "상황 설정", title: "일 1~10개 · GPU · 우선순위 · 마감 · 남은 작업 · 배치 노드", sub: "GPU 합이 8장 이하면 동시에 실행, 넘으면 그 노드에서 대기 · 노드당 4개까지" }, 4800);
  const base = await t.text(".nx-scn-pick strong");
  await t.spot(".nx-scn-result", { tag: "상황 설정", title: "값을 바꾸면 사건과 AI 선택을 바로 다시 계산합니다", sub: `기본 상황 → ${base}` }, READ);
  t.unspot();

  await t.click(".nx-scn-preset", "옮길 자리가 없는 날", { moveMs: 800, afterMs: 900 });
  t.hideCursor();
  const full = await t.text(".nx-scn-pick strong");
  await t.spot(".nx-scn-result", { tag: "상황 설정", title: "모든 노드가 꽉 찬 날이면?", sub: `옮길 빈자리가 없어 → ${full}` }, 4600);
  t.unspot();
  await t.click(".nx-scn-preset", "사건이 동시에 터진 날", { moveMs: 800, afterMs: 900 });
  t.hideCursor();
  const multi = await t.text(".nx-scn-pick strong");
  await t.spot(".nx-scn-result", { tag: "상황 설정", title: "과열 두 곳 + 줄 때문에 마감을 놓칠 일 하나", sub: `세 사건을 한 계획으로 → ${multi}` }, 4800);
  t.caption({ tag: "상황 설정", title: "이번 시연은 이 상황으로 끝까지 따라갑니다", sub: "이후 화면은 모두 이 설정이 만든 결과입니다" });
  await t.sleep(1800);
  await t.click(BTN, "이 상황으로 시작", MOVE);

  // ---------- 2 상황 파악 ----------
  await t.waitFor(".nx-inc-list");
  t.hideCursor();
  await t.chapter(ch(1, "무엇이 급한가"), 2400);
  t.stage(1);
  await t.spot(".nx-inc-list", { tag: "운영 현황", title: "사건을 중요도 순으로 줄 세웁니다", sub: "사건 = 조치 없이 두면 88°C를 넘는 노드, 마감을 놓치는 일 · 한계까지 짧을수록, 우선순위가 높을수록 위" }, 5200);
  await t.spot(".nx-board", { tag: "운영 현황", title: "노드마다 실행 중인 일과 대기 중인 일", sub: "N5에서는 J08이 GPU 8장을 차지해 J06이 줄 서 있습니다" }, 4800);
  t.unspot();
  await t.click(BTN, "사건 상세 보기", MOVE);
  await t.waitFor(".nx-callout");
  t.hideCursor();
  const forecast = await t.text(".nx-callout");
  await t.spot(".nx-split-main .nx-card", { tag: "사건 상세", title: "아무것도 하지 않으면?", sub: forecast }, READ);
  await t.spot(".nx-reasons", { tag: "사건 상세", title: "단순 임계값 규칙으로는 풀 수 없습니다", sub: "팬 이상 · 재시작 지연 · 구역 단위 냉각 · 역할별 승인이 함께 걸려 있습니다" }, READ);
  t.unspot();
  await t.click(BTN, "회사 운영 정책 확인", MOVE);

  // ---------- 3 판단 ----------
  await t.waitFor(".nx-funnel");
  t.hideCursor();
  await t.chapter(ch(2, "규칙 안에서 계획을 만들고 고른다"), 2400);
  t.stage(2);
  await t.spot(".nx-split-main .nx-table", { tag: "운영 정책", title: "회사가 먼저 규칙을 정합니다", sub: "필수 제약은 어떤 승인으로도 풀리지 않습니다" }, READ);
  await t.spot(".nx-funnel", { tag: "운영 정책", title: "전략 10종 → 연쇄 계획 → 정리 → Safety Gate → 열위 제거", sub: "전략마다 '가장 급한 문제 → 행동 1개 → 시뮬레이션'을 문제가 없어질 때까지 반복" }, 5200);
  await t.spot(".nx-rulelist", { tag: "운영 정책", title: "멈추기 규칙", sub: "더 급한 일만 멈출 수 있고, P0는 멈추지 않으며, 멈춘 일이 마감을 놓치는 계획은 제외" }, READ);
  t.unspot();
  await t.click(BTN, "정책 적용 후 AI 판단", { moveMs: 800, afterMs: 1000 });
  await t.waitFor(".nx-verdict", undefined, 20000);
  t.hideCursor();
  await t.spot(".nx-modelbar", { tag: "의사결정 센터", title: "Zoro-1 판단 자리 (이 영상은 MOCK 응답)", sub: "검증된 후보만 최대 24개까지 전달 · 실제 모델 연결 시 후보별 확률 표시" }, READ);
  await t.spot(".nx-cands", { tag: "의사결정 센터", title: "후보 하나 = 행동 여러 개로 된 계획", sub: "떠맡기기 · 새치기 · 임시 대피 · 연기 · 냉각 변경을 이어 붙입니다" }, 4800);
  const pick = await t.text(".nx-verdict-main strong");
  await t.spot(".nx-verdict", { tag: "의사결정 센터", title: `AI의 선택: ${pick}`, sub: "단계마다 필요한 승인이 다릅니다 · 아직 실행 전" }, 4800);
  t.unspot();
  await t.click(BTN, "대안별 결과 보기", MOVE);
  await t.waitFor(".nx-ftable");
  t.hideCursor();
  await t.spot(".nx-futures", { tag: "대안별 결과", title: "과열 노드의 온도를 계획별로 비교합니다", sub: "같은 상황 · 같은 발열 모델에서 계획만 다르게" }, READ);
  await t.spot(".nx-ftable", { tag: "대안별 결과", title: "최고 온도 · 에너지 · 일별 완료 · 풀리는/남는 문제", sub: "전수 탐색이 아니라 '검증된 전략안 중 선택'입니다" }, 4800);
  t.unspot();

  // ---------- 4 통제된 실행 ----------
  await t.chapter(ch(3, "AI가 골라도, 바로 실행되지 않는다"), 2400);
  t.stage(3);
  await t.click(BTN, "실행 전 안전 검사", MOVE);
  await t.waitFor(".nx-banner--conditional, .nx-banner--allowed", undefined, 20000);
  t.hideCursor();
  await t.spot(".nx-split-main .nx-card", { tag: "안전 검사", title: "모델과 분리된 코드가 단계마다 다시 검사합니다", sub: "P0 보호 · 대상 노드 자리 · 멈추기 규칙 · 냉각 상한 · 열 한계 · 승인 권한" }, 5000);
  t.unspot();
  await t.click(BTN, "강제 입력 검사 실행", MOVE);
  t.hideCursor();
  await t.spot(".nx-testpanel", { tag: "안전 검사", title: "누군가 P0 일을 옮기라고 넣는다면?", sub: "AI가 고르지 않은 행동도 같은 검사를 거칩니다" }, READ);
  t.unspot();
  await t.click(BTN, "담당자 승인 요청", MOVE);

  await t.waitFor(".nx-decide");
  t.hideCursor();
  await t.spot(".nx-split-main .nx-table", { tag: "협업 · 승인", title: "냉각 단계는 A, 일 이동 단계는 B가 승인합니다", sub: "한 계획에 두 역할의 승인이 모두 필요할 수 있습니다" }, READ);
  t.unspot();
  await t.click(".nx-decide .nx-seg button", "관제 운영자", { moveMs: 800, afterMs: 400 });
  t.hideCursor();
  await t.spot(".nx-decide", { tag: "협업 · 승인", title: "관제 운영자에게는 승인 권한이 없습니다", sub: "승인 버튼이 잠겨 있습니다" }, 3600);
  await t.click(BTN, "그래도 서버에 승인 요청 보내 보기", MOVE);
  t.hideCursor();
  await t.spot(".nx-decide .nx-block-danger", { tag: "협업 · 승인", title: "화면을 우회해도 거부됩니다", sub: "권한 검사는 버튼 + 서버 두 겹" }, 3800);
  t.unspot();
  await t.click(".nx-decide .nx-seg button", "A · 냉각 운영", { moveMs: 800, afterMs: 400 });
  t.hideCursor();
  await t.spot(".nx-card:has(.nx-comment-input)", { tag: "협업 · 승인", title: "냉각 담당자가 의견을 남깁니다", sub: "어느 역할이든 의견은 남길 수 있습니다", top: true }, 1200);
  await t.type("input[aria-label='의견 입력']", "Z2 냉각은 한 단계만 올리겠습니다. N4 팬은 오늘 교체합니다.");
  await t.click(BTN, "의견 등록", { moveMs: 600, afterMs: 800 });
  t.caption({ tag: "협업 · 승인", title: "냉각 담당자가 냉각 단계를 승인합니다" });
  await t.click(".nx-decide .nx-btn", "승인", { moveMs: 800, afterMs: 1200 });
  await t.click(".nx-decide .nx-seg button", "B · GPU 운영", { moveMs: 800, afterMs: 500 });
  t.caption({ tag: "협업 · 승인", title: "GPU 담당자가 일 이동 단계를 승인하면 실행됩니다", sub: "실행 직전에 최신 상태로 한 번 더 검사" });
  await t.sleep(1800);
  await t.click(".nx-decide .nx-btn", "승인하고 실행", { moveMs: 800, afterMs: 1300 });

  await t.waitFor(".nx-exec-banner", undefined, 20000);
  t.hideCursor();
  await t.spot(".nx-kpis--3", { tag: "실행 및 결과", title: "가상 환경에서만 실행합니다", sub: "실제 설비 제어 없음 · 모든 수치는 시뮬레이션" }, READ);
  await t.spot(".nx-split-main .nx-card", { tag: "실행 및 결과", title: "일별 예상 완료가 실행 전후로 어떻게 바뀌었는지", sub: "옮기거나 멈춘 일은 재시작 지연만큼 늦게 끝납니다" }, READ);
  t.unspot();
  await t.click(BTN, "회차 결과 보기", MOVE);
  await t.waitFor(".nx-rounds");
  t.hideCursor();
  await t.spot(".nx-banner", { tag: "회차 요약", title: "실행 뒤 상태로 남은 문제를 다시 계산합니다", sub: "남은 문제 없음 · 안전한 후보 없음 · 직전과 같음 · 최대 회차 중 하나면 멈춥니다" }, 5000);
  t.unspot();

  // ---------- 5 결정 영수증 ----------
  await t.chapter(ch(4, "상황부터 결과까지, 하나의 기록으로"), 2400);
  t.stage(4);
  await t.click(BTN, "결정 영수증 확인", MOVE);
  await t.waitFor(".nx-timeline");
  t.hideCursor();
  await t.spot(".nx-receipt-rounds", { tag: "결정 영수증", title: "회차마다 사건 · 후보 · 선택 · 승인 · 결과", sub: "원래 AI 제안은 덮어쓰지 않습니다" }, READ);
  await t.spot(".nx-timeline", { tag: "결정 영수증", title: "누가, 언제, 무엇을 결정했는지 추적합니다", sub: "테스트 차단과 거부된 승인까지 남습니다" }, 1400);
  await t.scrollBy(400, 2600);
  t.unspot();
  await t.click(BTN, "기록 상세 보기", MOVE);
  await t.waitFor(".nx-tbars", undefined, 20000);
  t.hideCursor();
  await t.spot(".nx-kpis--6", { tag: "기록 · 분석", title: "쌓인 결정 기록으로 운영 품질을 봅니다", sub: "이 화면의 숫자는 예시 데이터입니다" }, READ);
  await t.spot(".nx-tbars", { tag: "기록 · 분석", title: "어떤 유형의 사건에서 마감을 놓쳤는지 찾습니다", sub: "실패 패턴 → 정책 · 시스템 개선으로 연결" }, READ);
  t.unspot();

  // ---------- 다른 상황: 회차 반복과 사람에게 넘김 ----------
  t.stage(-1);
  await t.chapter({ no: "", title: "다른 상황이라면?", sub: "어떻게 해도 마감 안에 못 끝나는 일이 섞인 날", kind: "title" }, 2800);
  await t.go("/scenario");
  await t.waitFor(".nx-scn-presets");
  await t.click(".nx-scn-preset", "손쓸 수 없는 문제가 섞인 날", { moveMs: 800, afterMs: 900 });
  t.hideCursor();
  t.stage(0);
  await t.spot(".nx-scn-result", { tag: "상황 설정", title: "N4 과열은 풀 수 있지만, J05는 일 자체가 마감보다 깁니다", sub: "같은 흐름으로 따라가 봅니다" }, READ);
  t.unspot();
  await t.click(BTN, "이 상황으로 시작", MOVE);
  await t.waitFor(".nx-inc-list");
  await t.go("/decision/1");
  await t.waitFor(".nx-verdict");
  t.stage(2);
  t.hideCursor();
  await t.spot(".nx-verdict", { tag: "의사결정 센터 · 1회차", title: "1회차: 풀 수 있는 과열부터 해결하는 계획", sub: "J05 마감 위험은 남습니다" }, READ);
  t.unspot();
  await t.go("/decision/1/validate");
  await t.waitFor(".nx-banner--conditional, .nx-banner--allowed");
  t.stage(3);
  await t.click(BTN, "담당자 승인 요청", MOVE);
  await t.waitFor(".nx-decide");
  await t.click(".nx-decide .nx-seg button", "B · GPU 운영", { moveMs: 800, afterMs: 400 });
  await t.click(".nx-decide .nx-btn", "승인하고 실행", { moveMs: 800, afterMs: 1200 });
  await t.waitFor(".nx-exec-banner");
  await t.click(BTN, "회차 결과 보기", MOVE);
  await t.waitFor(".nx-rounds");
  t.hideCursor();
  await t.spot(".nx-banner", { tag: "회차 요약", title: "남은 문제에 안전한 계획이 없어 멈춥니다", sub: "무리해서 실행하지 않고 사람에게 넘깁니다" }, READ);
  t.unspot();
  await t.click(BTN, "사람에게 넘김 보기", MOVE);
  await t.waitFor(".nx-handoff");
  t.hideCursor();
  await t.spot(".nx-handoff", { tag: "사람에게 넘김", title: "AI가 멈추고 사람을 부릅니다", sub: "설비는 건드리지 않고, 승인 · 실행 단계로도 가지 않습니다" }, READ);
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
        { title: "동시다발 대응", sub: "여러 사건을 중요도 순으로 묶어 검증된 계획으로" },
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
