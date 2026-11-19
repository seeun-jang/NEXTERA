import { useEffect, useId, useRef, useState } from "react";

// 온도 추이·예측 차트. 의존성 없이 SVG로 그린다(§7 차트 규칙).
// 관측 = 파란 실선, 예측 = 파란 점선, 비교 노드 = 회청색 점선, 85°C 스로틀 = 회색 점선, 88°C 한계 = 검정 실선.

export interface ChartSeries {
  id: string;
  label?: string; // 선 끝 직접 라벨
  points: { x: number; y: number }[];
  style?: "observed" | "forecast" | "compare";
  /** 선 아래를 옅은 파랑 그라데이션으로 채움(관측 선에 권장) */
  area?: boolean;
  /** 마지막 점 위 말풍선(예: "현재 81°C") */
  currentLabel?: string;
}

export interface ChartThreshold {
  y: number;
  label: string;
  kind: "limit" | "throttle";
}

interface Props {
  series: ChartSeries[];
  thresholds?: ChartThreshold[];
  xDomain: [number, number];
  yDomain: [number, number];
  xTicks: { value: number; label: string }[];
  yTicks: number[];
  height?: number;
  /** 세로 기준선(예: 지금 시각) */
  marker?: { x: number; label: string };
  ariaLabel: string;
}

const DEFAULT_W = 560;
const PAD = { top: 14, right: 40, bottom: 24, left: 30 };

const STROKE: Record<NonNullable<ChartSeries["style"]>, { color: string; dash?: string; width: number }> = {
  observed: { color: "var(--nx-accent)", width: 2 },
  forecast: { color: "var(--nx-accent)", dash: "5 4", width: 2 },
  compare: { color: "var(--nx-text-2)", dash: "3 3", width: 1.5 },
};

export function TempChart({ series, thresholds = [], xDomain, yDomain, xTicks, yTicks, height = 180, marker, ariaLabel }: Props) {
  // 실제 픽셀 폭으로 그려서 좁은 카드에서도 글자가 11px로 유지되게 한다.
  const ref = useRef<HTMLDivElement | null>(null);
  const [W, setW] = useState(DEFAULT_W);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height;
  const gid = useId().replace(/:/g, "");
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * iw;
  const sy = (y: number) => PAD.top + (1 - (y - yDomain[0]) / (yDomain[1] - yDomain[0])) * ih;
  const clampY = (y: number) => Math.min(yDomain[1], Math.max(yDomain[0], y));

  return (
    <div ref={ref} style={{ width: "100%" }}>
    <svg className="nx-chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={ariaLabel}>
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={PAD.left} x2={W - PAD.right} y1={sy(t)} y2={sy(t)} stroke="var(--nx-grid)" />
          <text x={PAD.left - 8} y={sy(t) + 4} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={`x${t.value}`} x={sx(t.value)} y={H - 6} textAnchor="middle">
          {t.label}
        </text>
      ))}

      {thresholds.map((th) => (
        <g key={th.label}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={sy(th.y)}
            y2={sy(th.y)}
            stroke={th.kind === "limit" ? "var(--nx-ink)" : "var(--nx-text-3)"}
            strokeDasharray={th.kind === "throttle" ? "4 4" : undefined}
            strokeWidth={th.kind === "limit" ? 1.5 : 1}
          />
          <text className="thr-label" x={PAD.left + 6} y={sy(th.y) - 5}>
            {th.label}
          </text>
        </g>
      ))}

      {marker && (
        <g>
          <line x1={sx(marker.x)} x2={sx(marker.x)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--nx-border-strong)" />
          <text x={sx(marker.x) + 4} y={PAD.top + 10}>
            {marker.label}
          </text>
        </g>
      )}

      <defs>
        <linearGradient id={`area-${gid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--nx-accent)" stopOpacity=".28" />
          <stop offset="1" stopColor="var(--nx-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {series.map((s) => {
        const st = STROKE[s.style ?? "observed"];
        const d = s.points.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(clampY(p.y)).toFixed(1)}`).join(" ");
        const last = s.points[s.points.length - 1];
        const first = s.points[0];
        const areaD =
          s.area && first && last
            ? `${d} L${sx(last.x).toFixed(1)},${(H - PAD.bottom).toFixed(1)} L${sx(first.x).toFixed(1)},${(H - PAD.bottom).toFixed(1)} Z`
            : null;
        return (
          <g key={s.id}>
            {areaD && <path d={areaD} fill={`url(#area-${gid})`} stroke="none" />}
            <path d={d} fill="none" stroke={st.color} strokeWidth={st.width} strokeDasharray={st.dash} strokeLinejoin="round" />
            {s.currentLabel && last && (
              <g>
                <line x1={sx(last.x)} x2={sx(last.x)} y1={sy(clampY(last.y))} y2={H - PAD.bottom} stroke="var(--nx-accent)" strokeOpacity=".35" />
                <circle cx={sx(last.x)} cy={sy(clampY(last.y))} r="4.5" fill="#fff" stroke="var(--nx-accent)" strokeWidth="2.5" />
                <g transform={`translate(${Math.min(sx(last.x), W - PAD.right) - 74} ${Math.max(sy(clampY(last.y)) - 34, 2)})`}>
                  <rect width="80" height="22" rx="11" fill="var(--nx-accent)" />
                  <text x="40" y="15" textAnchor="middle" style={{ fill: "#fff", fontWeight: 700, fontSize: 11 }}>
                    {s.currentLabel}
                  </text>
                </g>
              </g>
            )}
            {s.label && last && (
              <text x={sx(last.x) + 6} y={sy(clampY(last.y)) + 4} style={{ fill: st.color, fontWeight: 700 }}>
                {s.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
    </div>
  );
}
