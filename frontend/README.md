# NEXTERA frontend (소유: 세은)

공통 프롬프트(루트 `CLAUDE.md`) §3·§5·§7·§8을 따른다.

## 실행

```bash
cd frontend
cp .env.example .env        # 기본 VITE_API_MODE=mock
npm install
npm run dev                 # http://localhost:5173
```

통합할 때는 `.env`에서 `VITE_API_MODE=live`로만 바꾼다(백엔드 `http://localhost:8000`).

## 구조

| 경로 | 내용 |
| --- | --- |
| `src/styles/tokens.css` | §7 색·반경·폰트 변수. 헥스 값은 이 파일에만 |
| `src/styles/components.css` | 공통 컴포넌트 스타일(`nx-` 접두사) |
| `src/api/client.ts` | 모든 API 호출의 유일한 지점, mock/live 분기, `X-Role` 헤더 |
| `src/mocks/` | 시드(`@seed`) 기반 mock. 스토리보드 예시 수치는 여기서만 허용 |
| `src/state/DemoContext.tsx` | 현재 사건·결정·분기·승인·실행 ID와 역할 |
| `src/components/common/` | AppShell, PageHeader, StatusChip, PriorityBadge, PolicyTag, ResultMark/CheckRow, Card/Kpi, Button, States, TempChart, Icon |
| `src/components/screens/` | 화면 전용 컴포넌트(NodeGrid …) |
| `src/pages/` | 화면 1개 = 파일 1개. 03~13은 아직 자리표시 화면 |

별칭: `@contracts` → `../shared/contracts`, `@seed` → `../data/seed`, `@` → `src`.

## 의존성 원칙

react, react-dom, react-router-dom만 쓴다. 차트(`TempChart`)와 아이콘(`Icon`)은 직접 그린 SVG, 스타일은 CSS 변수 기반 일반 CSS다. 새 라이브러리는 추가 전에 팀에 묻는다.

## mock으로 확인된 흐름 (CP0 기준)

후보 7 → 5 · S0 판단 = J07→N2 · 마감 3분 분기 = Z2 냉각 강화 · J07→N3 강제 입력 차단(POL-03) · 승인 전 실행 403 · A 승인 시도 403(POL-04) · B 승인 → 실행(멱등) · 영수증에 분기·가정·차단·권한 거부 이벤트 기록.
