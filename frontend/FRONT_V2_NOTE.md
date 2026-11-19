# 프론트 ↔ /api/v2 연결 메모 (백엔드 전달용)

프론트는 MULTI_API.md 모양 그대로 받습니다. 변환은 `frontend/src/api/v2.ts` 한 파일에 있고, `VITE_API_MODE=live`이면 화면이 이 경로로 동작합니다.
가짜 v2 서버(문서 모양 그대로)로 상황 설정 → 판단 → 안전 검사 · 강제 입력 차단 → 권한 없는 승인 403 → A · B 승인 → 실행 → 회차 → 영수증까지 확인했습니다.

## 프론트가 부르는 순서
1. `POST /api/v2/scenario` — 화면의 노드 · 구역 · 일을 그대로 보냅니다. `nodes[].id`, `temp_c` / `zones[]` / `jobs[].deadline_min`, `remaining_min`, `node` (배열 순서 = 줄 순서) / `objective: "balanced"`
2. `POST /api/v2/decide` — 응답의 `candidates`, `decision.selected_id`, `decision.rationale`, `decision.status`, `problems`를 씁니다.
3. `POST /api/v2/validate` — `{plan_id}`로 한 번, 강제 입력 테스트는 `{steps:[...]}` (P0 일 `move` → 안 되면 냉각 상한 초과 `cool`). `verdict: "blocked"`일 때 `checks[]`에서 `result`가 `fail`/`blocked`인 항목의 `message`(또는 `text`)와 `policy_id`(또는 `rule`)를 보여 줍니다.
4. `POST /api/v2/approvals` — `X-Role`을 바꿔 가며 `{plan_id, action:"approve"}`. 403 본문의 `error.message`를 화면에 그대로 보여 줍니다.
5. `POST /api/v2/execute` — `after`(상태), `resolved[]`, `remaining[]`(id 문자열 또는 problem 객체 둘 다 처리), `next.status`를 씁니다.
6. 남은 문제가 있으면 `GET /api/v2/state` → `POST /api/v2/decide`로 다음 회차.
헤더: `X-Role`(operator · cooling_A · gpu_B), `X-Session`(브라우저 세션마다 하나).

## 화면이 쓰는 필드 (없으면 그 칸만 비워 둡니다)
- `problems[]`: `id`, `kind`(overheat|deadline), `node`, `job`, `priority`, `time_min`(한계까지 남은 시간, 정렬은 서버 순서 그대로), `text`(상세 문구)
- `no_action`: `temps`(노드별 30초 간격 → 운영 현황 · 사건 상세 차트), `job_finish_min`
- `candidates[]`: `id`, `label`(없으면 `strategies` 이어 붙임), `steps[].type/label/job/to/zone/level`, `required_roles`, `max_peak_c`, `max_peak_node`, `cooling_kwh`, `late_jobs`, `job_finish_min`, `resolved`, `remaining`
- `state.nodes[].running/waiting`(노드 안 순서), `state.jobs[].status`(deferred면 연기 표시)

## 있으면 화면이 더 좋아지는 것 (선택)
- 후보별 노드 온도 곡선 `candidates[].temps` (노드별 30초 간격) → 06 대안별 결과의 계획별 온도 차트. 지금은 없으면 차트 대신 표만 보입니다.
- `no_action.cooling_kwh` → 운영 현황 · 대안 비교의 "조치 없음" 냉각 에너지 칸.
- 생성 단계 개수 `decision.stats`에 `strategies`, `built`, `merged`, `safe`, `pareto` → 04 운영 정책의 후보 깔때기. 지금은 전달 개수만 정확합니다.

## 프론트 쪽 차이 (알아 두기)
- 상황 설정 화면에 **팬 이상** 토글이 있지만 서버는 온도만 받으므로 보내지 않습니다. 화면에 그렇게 안내합니다.
- 의견(코멘트)은 서버 엔드포인트가 없어 프론트 기록에만 남습니다.
- mock 엔진(`src/sim`)의 발열 계수는 시연용 가정이라 서버 값과 다릅니다. live에서는 서버 결과가 기준입니다. 최대 회차 4, 임시 대피 복귀 78°C, 사건 id(HOT- · LATE-), 정책 이름(POL-09 · COOL-MAX)은 서버와 맞췄습니다.
