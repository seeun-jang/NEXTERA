import type { ReactElement } from "react";

// 메인(01)용 그림. 사진 대신 SVG로 직접 그린다(저작권·용량 걱정 없음).
// RackArt: 원근이 있는 서버랙 복도 · GlassPanels / CubeField / WaveLines: 기능 카드 배경

/** 결정적 난수 — 새로고침해도 LED 배치가 같다 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const VW = 1000;
const VH = 620;

/** 오른쪽 벽을 따라 소실점으로 멀어지는 서버랙 */
export function RackArt({ dim = false, mirror = false }: { dim?: boolean; mirror?: boolean }) {
  const r = rng(7);
  const vp = { x: 360, y: 300 };
  const nearX = VW + 40;
  const x = (t: number) => nearX + (vp.x - nearX) * t;
  const y = (t: number, v: number) => vp.y + (v - vp.y) * (1 - t);
  // 랙 하나 = 깊이 구간 [t0, t1]
  const racks: [number, number][] = [
    [0.0, 0.2], [0.22, 0.38], [0.4, 0.52], [0.54, 0.63], [0.65, 0.71], [0.73, 0.77],
  ];
  const TOP = -60;
  const BOT = 700;
  const units = 26;

  return (
    <svg
      className="nx-art"
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    >
      <defs>
        <radialGradient id="rack-glow" cx="62%" cy="45%" r="55%">
          <stop offset="0" stopColor="#3d6fb8" stopOpacity={dim ? 0.35 : 0.55} />
          <stop offset="1" stopColor="#0a1424" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rack-face" x1="0" x2="1">
          <stop offset="0" stopColor="#0e1a2c" />
          <stop offset="1" stopColor="#1d3150" />
        </linearGradient>
        <linearGradient id="rack-edge" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#8fb6ff" stopOpacity=".05" />
          <stop offset=".5" stopColor="#8fb6ff" stopOpacity=".55" />
          <stop offset="1" stopColor="#8fb6ff" stopOpacity=".05" />
        </linearGradient>
        <linearGradient id="rack-fade" x1="0" x2="1">
          <stop offset="0" stopColor="#0a1424" stopOpacity="1" />
          <stop offset=".42" stopColor="#0a1424" stopOpacity=".85" />
          <stop offset=".7" stopColor="#0a1424" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rack-floor" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0a1424" stopOpacity="0" />
          <stop offset="1" stopColor="#0a1424" stopOpacity=".9" />
        </linearGradient>
        <filter id="led-blur" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      <rect width={VW} height={VH} fill="#0a1424" />
      <rect width={VW} height={VH} fill="url(#rack-glow)" />

      {/* 맞은편(왼쪽) 랙 실루엣 */}
      {[0.35, 0.5, 0.62].map((t, i) => {
        const xl = vp.x - (vp.x + 80) * (1 - t);
        const w = 70 * (1 - t);
        return <rect key={i} x={xl} y={y(t, TOP)} width={w} height={y(t, BOT) - y(t, TOP)} fill="#0c1729" opacity={0.9} />;
      })}

      {racks.map(([t0, t1], i) => {
        const pts = `${x(t0)},${y(t0, TOP)} ${x(t1)},${y(t1, TOP)} ${x(t1)},${y(t1, BOT)} ${x(t0)},${y(t0, BOT)}`;
        const leds: ReactElement[] = [];
        const lines: ReactElement[] = [];
        for (let u = 1; u < units; u++) {
          const v = TOP + ((BOT - TOP) * u) / units;
          lines.push(
            <line key={`l${u}`} x1={x(t0)} y1={y(t0, v)} x2={x(t1)} y2={y(t1, v)} stroke="#2a4468" strokeWidth={1.2 * (1 - t0)} opacity={0.7} />,
          );
          const count = 1 + Math.floor(r() * 3);
          for (let k = 0; k < count; k++) {
            if (r() < 0.35) continue;
            const tt = t0 + (t1 - t0) * (0.08 + r() * 0.5);
            const vv = v + ((BOT - TOP) / units) * 0.5;
            const size = 2.6 * (1 - tt);
            const hot = r() < 0.18;
            const color = hot ? "#d7e6ff" : "#4f8fff";
            leds.push(
              <g key={`d${u}-${k}`} className={r() < 0.12 ? "nx-led-blink" : undefined}>
                <circle cx={x(tt)} cy={y(tt, vv)} r={size * 2.4} fill={color} opacity={0.35} filter="url(#led-blur)" />
                <rect x={x(tt) - size * 1.6} y={y(tt, vv) - size * 0.45} width={size * 3.2} height={size * 0.9} fill={color} rx={size * 0.3} />
              </g>,
            );
          }
        }
        return (
          <g key={i} opacity={dim ? 0.6 : 1}>
            <polygon points={pts} fill="url(#rack-face)" />
            {lines}
            {leds}
            <line x1={x(t0)} y1={y(t0, TOP)} x2={x(t0)} y2={y(t0, BOT)} stroke="url(#rack-edge)" strokeWidth={3 * (1 - t0)} />
          </g>
        );
      })}

      <rect x="0" y={VH * 0.62} width={VW} height={VH * 0.38} fill="url(#rack-floor)" />
      <rect width={VW} height={VH} fill="url(#rack-fade)" />
    </svg>
  );
}

/** 의사결정 Lab — 겹쳐진 유리판 */
export function GlassPanels() {
  return (
    <svg className="nx-art" viewBox="0 0 400 260" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="gp-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b5f95" />
          <stop offset="1" stopColor="#7fa7d8" />
        </linearGradient>
        <linearGradient id="gp-pane" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity=".05" />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill="url(#gp-bg)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${190 + i * 34} ${30 - i * 6}) skewY(-14)`}>
          <rect width="60" height={190 + i * 10} rx="4" fill="url(#gp-pane)" stroke="#ffffff" strokeOpacity=".6" strokeWidth="1" />
        </g>
      ))}
    </svg>
  );
}

/** 협업·승인 — 빛나는 아이소메트릭 큐브 */
export function CubeField() {
  const s = 26; // 큐브 한 변(화면상)
  const cubes: { x: number; y: number; lit: number }[] = [];
  const r = rng(3);
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      if (r() < 0.25) continue;
      const x = 180 + (col - row) * s * 0.87;
      const y = 20 + (col + row) * s * 0.5 - (r() < 0.3 ? s * 0.6 : 0);
      cubes.push({ x, y, lit: r() });
    }
  }
  cubes.sort((a, b) => a.y - b.y);
  const h = s * 0.87;
  return (
    <svg className="nx-art" viewBox="0 0 400 260" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <rect width="400" height="260" fill="#0b1626" />
      {cubes.map((c, i) => {
        const top = `${c.x},${c.y} ${c.x + h},${c.y + s / 2} ${c.x},${c.y + s} ${c.x - h},${c.y + s / 2}`;
        const left = `${c.x - h},${c.y + s / 2} ${c.x},${c.y + s} ${c.x},${c.y + 2 * s} ${c.x - h},${c.y + 1.5 * s}`;
        const right = `${c.x + h},${c.y + s / 2} ${c.x},${c.y + s} ${c.x},${c.y + 2 * s} ${c.x + h},${c.y + 1.5 * s}`;
        const lit = c.lit > 0.7;
        return (
          <g key={i} opacity={0.55 + c.lit * 0.45}>
            <polygon points={top} fill={lit ? "#9cc4ff" : "#2c4a73"} />
            <polygon points={left} fill={lit ? "#3f78c9" : "#16273f"} />
            <polygon points={right} fill={lit ? "#5d95e6" : "#1d3354"} />
          </g>
        );
      })}
    </svg>
  );
}

/** 운영 정책·매뉴얼 — 흐르는 선 */
export function WaveLines() {
  const lines = Array.from({ length: 22 }, (_, i) => i);
  return (
    <svg className="nx-art" viewBox="0 0 400 260" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="wl-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3f6fb" />
          <stop offset="1" stopColor="#d9e3f0" />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill="url(#wl-bg)" />
      {lines.map((i) => (
        <path
          key={i}
          d={`M ${120 + i * 6} 270 C ${200 + i * 4} ${180 - i * 3}, ${260 - i * 2} ${120 - i * 4}, ${420} ${40 + i * 5}`}
          fill="none"
          stroke={i % 3 === 0 ? "#9db6d6" : "#ffffff"}
          strokeWidth={i % 3 === 0 ? 1.2 : 1.6}
          opacity={0.9}
        />
      ))}
    </svg>
  );
}
