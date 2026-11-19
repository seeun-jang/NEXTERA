import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Snapshot } from "@contracts/types";
import { api } from "@/api/client";
import { ErrorState, Icon, Kpi, StatusChip, Stepper, TempChart, type IconName } from "@/components/common";
import { CubeField, GlassPanels, RackArt, WaveLines } from "@/components/landing/LandingArt";
import { useAction, useApi } from "@/hooks/useApi";
import { useDemo } from "@/state/DemoContext";
import { useRun } from "@/state/run";
import { PRESETS } from "@/sim/model";
import { useTour } from "@/tour/TourProvider";

// 메인(랜딩) · 제품 진입 — 제품 UI 시안(레퍼런스) 구성을 따른다.
// 수치는 시드 S0(GET /api/state)에서 읽는다. 검증되지 않은 고객·파트너 로고는 넣지 않는다.

const FLOW: { icon: IconName; title: string; sub: string }[] = [
  { icon: "file", title: "정책 적용", sub: "운영 매뉴얼 · 제약 조건" },
  { icon: "sparkle", title: "AI 판단", sub: "허용 후보 중 선택" },
  { icon: "flask", title: "조건 실험", sub: "What-if · A/B 비교" },
  { icon: "users", title: "승인 · 실행", sub: "역할 검토 · 안전 실행" },
  { icon: "database", title: "기록 · 분석", sub: "결정 영수증 · 성과 평가" },
];

const PREVIEW_MENU: { icon: IconName; label: string; to: string }[] = [
  { icon: "grid", label: "운영 대시보드", to: "/operations" },
  { icon: "layers", label: "상황 설정", to: "/scenario" },
  { icon: "users", label: "협업 · 승인", to: "/approvals" },
  { icon: "book", label: "운영 정책 · 매뉴얼", to: "/policies" },
  { icon: "chart", label: "결정 기록", to: "/analytics" },
];

function minutesBetween(a: string, b: string) {
  const m = (t: string) => t.split(":").map(Number).reduce((acc, v, i) => acc + v * [60, 1, 1 / 60][i], 0);
  return m(b) - m(a);
}

/** 시드에서 화면에 쓸 값 계산 */
function summarize(s: Snapshot) {
  const hottest = s.nodes.reduce((a, n) => (n.temp_c > a.temp_c ? n : a));
  const hist = s.history.find((h) => h.node_id === hottest.id)?.points ?? [];
  const rise = hist.length ? Math.round(hottest.temp_c - hist[0].temp_c) : 0;
  const avgUtil = Math.round(s.nodes.reduce((a, n) => a + n.gpu_util_pct, 0) / s.nodes.length);
  const kw = Math.round(s.nodes.reduce((a, n) => a + n.power_kw, 0) * 10) / 10;
  const last = hist.length ? hist[hist.length - 1].t : s.sim_time;
  const points = hist.map((p) => ({ x: -minutesBetween(p.t, last), y: p.temp_c }));
  return { hottest, hist, rise, avgUtil, kw, points };
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { resetIds } = useDemo();
  const run = useRun();
  const state = useApi(() => api.getState("S0"), []);
  const start = useAction(async (to: string = "/scenario") => {
    if (run.mode === "mock") await run.start(PRESETS[0].situation, PRESETS[0].name); // 첫 화면에서 들어오면 기본 상황부터
    resetIds();
    navigate(to);
  });
  const sum = state.data ? summarize(state.data) : null;
  const tour = useTour();
  // 녹화용: 주소에 ?tour=1(발표용 2분) 또는 ?tour=full(제출용 긴 버전)을 붙이면 자동 시연이 바로 시작된다
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tour");
    if ((q === "1" || q === "full") && !tour.running) {
      const id = window.setTimeout(() => tour.start(q === "full" ? "full" : "short"), 900);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="lp">
      {/* ---------------- 히어로 ---------------- */}
      <header className="lp-hero">
        <RackArt />
        <nav className="lp-nav" aria-label="메인 메뉴">
          <span className="lp-logo">
            <span className="lp-logo-mark" aria-hidden="true">
              <i />
              <i />
            </span>
            Nextera
          </span>
          <div className="lp-links">
            <button type="button" className="active" onClick={() => scrollTo("features")}>제품 소개</button>
            <button type="button" onClick={() => scrollTo("flow")}>기능</button>
            <button type="button" onClick={() => scrollTo("preview")}>솔루션</button>
            <button type="button" onClick={() => scrollTo("value")}>리소스</button>
          </div>
          {/* 들어가는 버튼은 첫 화면의 "지금 체험하기" 하나로만 둔다 */}
          <div className="lp-nav-right" aria-hidden="true" />
        </nav>

        <div className="lp-hero-body">
          <div className="lp-hero-copy">
            <div className="lp-eyebrow">INDUSTRIAL AI OPERATIONS</div>
            <h1>
              AI로 더 <span className="lp-grad">안정적인</span>
              <br />
              데이터센터 운영을.
            </h1>
            <p>
              운영 매뉴얼과 기업의 정책을 기반으로,
              <br />
              상황을 이해하고 최적의 대응을 제안하는 산업용 AI 플랫폼입니다.
            </p>
            <div className="lp-cta">
              <button type="button" className="lp-pill lp-pill--light" onClick={() => start.run()} disabled={start.pending}>
                {start.pending ? "시연 데이터 불러오는 중" : "지금 체험하기"} <Icon name="arrow-right" size={18} />
              </button>
              <button type="button" className="lp-pill lp-pill--ghost" onClick={() => tour.start()} disabled={tour.running}>
                <Icon name="play" size={14} /> 자동 시연 보기 (2분)
              </button>
            </div>
            {start.error != null && (
              <div className="lp-error">
                <ErrorState error={start.error} onRetry={() => start.run()} />
              </div>
            )}
          </div>

          <aside className="lp-glass" aria-label="실시간 운영 현황">
            <div className="lp-glass-head">
              <span className="lp-live" aria-hidden="true" />
              실시간 운영 현황
            </div>
            {sum ? (
              <>
                <div className="lp-glass-row">
                  <Icon name="thermometer" size={24} strokeWidth={1.6} />
                  <span className="k">최고 노드 온도 · {sum.hottest.id}</span>
                  <span className="v">
                    <span>
                      {sum.hottest.temp_c.toFixed(1)}
                      <small>°C</small>
                    </span>
                    <em>▲ +{sum.rise}°C / 10분</em>
                  </span>
                </div>
                <div className="lp-glass-row">
                  <Icon name="bolt" size={24} strokeWidth={1.6} />
                  <span className="k">클러스터 전력</span>
                  <span className="v">
                    <span>
                      {sum.kw.toFixed(1)}
                      <small>kW</small>
                    </span>
                  </span>
                </div>
                <div className="lp-glass-row">
                  <Icon name="layers" size={24} strokeWidth={1.6} />
                  <span className="k">평균 GPU 사용률</span>
                  <span className="v">
                    <span>
                      {sum.avgUtil}
                      <small>%</small>
                    </span>
                  </span>
                  <span className="lp-glass-bar">
                    <span style={{ width: `${sum.avgUtil}%` }} />
                  </span>
                </div>
                <div className="lp-glass-foot">시뮬레이션 예시 데이터 · {state.data?.sim_time}</div>
              </>
            ) : (
              <div className="lp-glass-foot">{state.error ? "현황을 불러오지 못했습니다" : "불러오는 중"}</div>
            )}
          </aside>
        </div>
      </header>

      {/* ---------------- 핵심 기능 ---------------- */}
      <section id="features" className="lp-section lp-features">
        <div className="lp-head">
          <div>
            <div className="lp-eyebrow lp-eyebrow--dark">CORE FEATURES</div>
            <h2>
              운영의 핵심 기능을
              <br />
              하나의 플랫폼에서.
            </h2>
          </div>
          <p className="lp-head-side">
            의사결정부터 실행, 기록까지
            <br />
            데이터센터 운영의 모든 단계를 통합합니다.
          </p>
        </div>
        <div className="lp-feature-grid">
          <Link to="/scenario" className="lp-feature lp-feature--blue">
            <GlassPanels />
            <div className="lp-feature-body">
              <Icon name="layers" size={30} strokeWidth={1.5} />
              <h3>상황 설정</h3>
              <p>
                상황과 조건을 직접 정하고
                <br />
                AI가 고르는 대안을 바로 봅니다.
              </p>
              <Icon name="arrow-right" size={20} />
            </div>
          </Link>
          <Link to="/approvals" className="lp-feature lp-feature--dark">
            <CubeField />
            <div className="lp-feature-body">
              <Icon name="users" size={30} strokeWidth={1.5} />
              <h3>협업 · 승인</h3>
              <p>
                역할 기반으로 검토하고
                <br />
                안전하게 승인합니다.
              </p>
              <Icon name="arrow-right" size={20} />
            </div>
          </Link>
          <Link to="/policies" className="lp-feature lp-feature--light">
            <WaveLines />
            <div className="lp-feature-body">
              <Icon name="book" size={30} strokeWidth={1.5} />
              <h3>운영 정책 · 매뉴얼</h3>
              <p>
                기업의 운영 기준을 설정하고
                <br />
                AI가 그 안에서 판단합니다.
              </p>
              <Icon name="arrow-right" size={20} />
            </div>
          </Link>
        </div>
      </section>

      {/* ---------------- 운영 흐름 ---------------- */}
      <section id="flow" className="lp-flow">
        <div className="lp-flow-copy">
          <div className="lp-eyebrow lp-eyebrow--light">OPERATION FLOW</div>
          <h2>
            정책을 지키며,
            <br />
            실행 가능한 대안을 찾습니다.
          </h2>
        </div>
        <ol className="lp-flow-steps">
          {FLOW.map((f, i) => (
            <li key={f.title}>
              {i > 0 && (
                <span className="lp-flow-arrow" aria-hidden="true">
                  <Icon name="arrow-right" size={18} />
                </span>
              )}
              <div className="lp-flow-tile">
                <Icon name={f.icon} size={22} strokeWidth={1.6} />
                <strong>{f.title}</strong>
                <span>{f.sub}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------- 제품 미리보기 ---------------- */}
      <section id="preview" className="lp-section lp-preview">
        <div className="lp-preview-side">
          <div className="lp-eyebrow lp-eyebrow--dark">PRODUCT PREVIEW</div>
          <h2>
            실제 운영 화면을
            <br />
            미리 확인하세요.
          </h2>
          <ul className="lp-preview-menu">
            {PREVIEW_MENU.map((m, i) => (
              <li key={m.label}>
                <button type="button" className={i === 0 ? "active" : undefined} onClick={() => start.run(m.to)}>
                  <Icon name={m.icon} size={20} strokeWidth={1.7} />
                  {m.label}
                  {i === 0 && <Icon name="arrow-right" size={18} />}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-dash">
          <div className="lp-dash-head">
            <strong>운영 대시보드</strong>
            <span>GPU 클러스터 · 시뮬레이션</span>
            <i aria-hidden="true" />
            <span>실시간 운영 현황과 AI 대응 상태를 한눈에 확인합니다.</span>
            <StatusChip variant="sim" />
          </div>
          {sum ? (
            <>
              <div className="lp-dash-kpis">
                <Kpi tone="dark" icon="thermometer" label={`최고 노드 온도 · ${sum.hottest.id}`} value={sum.hottest.temp_c.toFixed(1)} unit="°C" sub={`▲ +${sum.rise}°C (10분 전 대비)`} />
                <Kpi tone="dark" icon="bolt" label="클러스터 전력" value={sum.kw.toFixed(1)} unit="kW" sub="노드 6개 합계" />
                <Kpi tone="dark" icon="layers" label="평균 GPU 사용률" value={sum.avgUtil} unit="%" meter={sum.avgUtil} />
              </div>
              <div className="lp-dash-row">
                <div className="lp-dash-card">
                  <div className="lp-dash-card-title">GPU 온도 추이 · {sum.hottest.id}</div>
                  <TempChart
                    ariaLabel={`${sum.hottest.id} 최근 10분 온도`}
                    series={[{ id: "t", points: sum.points, style: "observed", area: true, currentLabel: `현재 ${sum.hottest.temp_c.toFixed(1)}°C` }]}
                    thresholds={[{ y: 85, label: "스로틀 85°C", kind: "throttle" }]}
                    xDomain={[sum.points[0]?.x ?? -10, 0]}
                    yDomain={[70, 90]}
                    yTicks={[70, 75, 80, 85, 90]}
                    xTicks={[0, 10, 20].filter((i) => sum.hist[i]).map((i) => ({ value: sum.points[i].x, label: sum.hist[i].t.slice(0, 5) }))}
                    height={190}
                  />
                </div>
                <div className="lp-dash-card">
                  <div className="lp-dash-card-title lp-dash-card-title--row">
                    현재 대응 상태
                    <StatusChip variant="mock" />
                  </div>
                  <div className="lp-response">
                    <span className="lp-response-icon">
                      <Icon name="layers" size={26} strokeWidth={1.6} />
                    </span>
                    <div>
                      <strong>J07을 N2로 이동</strong>
                      <p>N4 팬 이상 메모와 J07 마감(5분)을 고려해 작업 재배치를 제안했습니다. GPU 운영 담당 승인 대기 중입니다.</p>
                    </div>
                  </div>
                  <Stepper
                    steps={[
                      { label: "AI 제안", state: "done" },
                      { label: "안전 검사", state: "done" },
                      { label: "승인 (B)", state: "current" },
                      { label: "실행", state: "todo" },
                    ]}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="lp-dash-empty">{state.error ? "미리보기를 불러오지 못했습니다" : "불러오는 중"}</div>
          )}
        </div>
      </section>

      {/* ---------------- 가치 ---------------- */}
      <section id="value" className="lp-value">
        <RackArt dim mirror />
        <div className="lp-value-inner">
          <div className="lp-eyebrow">THE VALUE OF NEXTERA</div>
          <h2>
            데이터센터 운영의
            <br />
            <span className="lp-grad">안정성, 효율성,</span> 그리고 신뢰성.
          </h2>
          <div className="lp-values">
            <div className="lp-value-item">
              <Icon name="shield" size={30} strokeWidth={1.5} />
              <div>
                <strong>안정적인 운영</strong>
                <span>기업 정책 준수와 안전한 실행</span>
              </div>
            </div>
            <div className="lp-value-item">
              <Icon name="layers" size={30} strokeWidth={1.5} />
              <div>
                <strong>높은 운영 효율</strong>
                <span>열·에너지·마감을 함께 비교</span>
              </div>
            </div>
            <div className="lp-value-item">
              <Icon name="trend" size={30} strokeWidth={1.5} />
              <div>
                <strong>투명한 의사결정</strong>
                <span>모든 판단의 근거와 결과 추적</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
