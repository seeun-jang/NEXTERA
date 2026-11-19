import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { runScript, type TourApi } from "./script";

// 자동 시연(광고) 모드. 실제 화면을 그대로 조작하면서 스포트라이트 · 커서 · 자막 · 챕터 카드를 얹는다.
// 녹화용이라 사람이 중간에 클릭하지 못하게 막고, ESC로만 멈춘다.

interface Caption {
  tag?: string;
  title: string;
  sub?: string;
  /** 아래쪽 입력칸을 가리는 장면(협업·승인의 의견 입력)에서만 true로 화면 위쪽에 띄웁니다. */
  top?: boolean;
}
export interface Chapter {
  no: string;
  title: string;
  sub?: string;
  kind?: "chapter" | "title" | "end" | "pitch" | "flow";
  /** 흐름도: 단계 이름들, active = 지금 단계(챕터 카드), animate = 하나씩 켜기(구조 소개) */
  flow?: { steps: string[]; active?: number; animate?: boolean };
  /** 사업 제안 카드의 항목 */
  items?: { title: string; sub?: string }[];
  numbered?: boolean;
}

export const STAGES = ["상황", "판단", "판단 실험", "통제된 실행", "결정 영수증"];

interface Ctx {
  running: boolean;
  start: () => void;
  stop: () => void;
}
const TourCtx = createContext<Ctx>({ running: false, start: () => {}, stop: () => {} });
export const useTour = () => useContext(TourCtx);

class Aborted extends Error {}

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [caption, setCaption] = useState<Caption | null>(null);
  const [chapter, setChapter] = useState<(Chapter & { ms: number }) | null>(null);
  const [target, setTarget] = useState<Element | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number; visible: boolean; click: number }>({ x: -100, y: -100, visible: false, click: 0 });
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(-1);
  const abort = useRef<AbortController | null>(null);

  // 스포트라이트 대상의 위치를 매 프레임 따라간다(스크롤·레이아웃 변화 대응)
  useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      const r = target.getBoundingClientRect();
      setRect((prev) => (prev && prev.x === r.x && prev.y === r.y && prev.width === r.width && prev.height === r.height ? prev : r));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const stop = useCallback(() => {
    abort.current?.abort();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && stop();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stop]);

  const start = useCallback(() => {
    if (abort.current) return;
    const ac = new AbortController();
    abort.current = ac;
    setRunning(true);
    const t0 = performance.now();
    const TOTAL = 195_000;
    const prog = window.setInterval(() => setProgress(Math.min(1, (performance.now() - t0) / TOTAL)), 200);

    const check = () => {
      if (ac.signal.aborted) throw new Aborted();
    };
    const sleep = (ms: number) =>
      new Promise<void>((res, rej) => {
        const id = window.setTimeout(res, ms);
        ac.signal.addEventListener("abort", () => {
          clearTimeout(id);
          rej(new Aborted());
        });
      });

    const find = (sel: string, text?: string): Element | null => {
      const all = Array.from(document.querySelectorAll(sel));
      return (text ? all.find((el) => (el.textContent ?? "").includes(text)) : all[0]) ?? null;
    };
    const waitFor = async (sel: string, text?: string, timeout = 15000): Promise<Element> => {
      const end = performance.now() + timeout;
      for (;;) {
        check();
        const el = find(sel, text);
        if (el) return el;
        if (performance.now() > end) throw new Error(`자동 시연: ${sel}${text ? ` "${text}"` : ""}를 찾지 못했습니다`);
        await sleep(120);
      }
    };
    const center = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const scrollTo = async (el: Element, block: ScrollLogicalPosition = "center") => {
      el.scrollIntoView({ behavior: "smooth", block });
      await sleep(650);
    };

    const api: TourApi = {
      sleep,
      waitFor,
      text: async (sel, fallback = "") => ((await waitFor(sel).catch(() => null))?.textContent ?? fallback).trim(),
      go: async (path) => {
        navigate(path);
        await sleep(300);
      },
      caption: (c) => setCaption(c),
      chapter: async (c, ms = 1900) => {
        setTarget(null);
        setCaption(null);
        setChapter({ ...c, ms });
        await sleep(ms);
        setChapter(null);
        await sleep(350);
      },
      spot: async (sel, c, ms, opts) => {
        const el = await waitFor(sel, opts?.text);
        await scrollTo(el, opts?.block ?? "center");
        setTarget(el);
        if (c) setCaption(c);
        await sleep(ms);
      },
      unspot: () => setTarget(null),
      click: async (sel, text, opts) => {
        const el = (await waitFor(sel, text)) as HTMLElement;
        await scrollTo(el);
        const p = center(el);
        setCursor((c) => ({ ...c, visible: true }));
        await sleep(60);
        setCursor((c) => ({ ...c, x: p.x, y: p.y }));
        await sleep(opts?.moveMs ?? 700);
        setCursor((c) => ({ ...c, click: c.click + 1 }));
        await sleep(180);
        el.click();
        await sleep(opts?.afterMs ?? 450);
      },
      type: async (sel, value) => {
        const el = (await waitFor(sel)) as HTMLInputElement;
        await scrollTo(el);
        const p = center(el);
        setCursor((c) => ({ ...c, visible: true, x: p.x - el.getBoundingClientRect().width / 2 + 40, y: p.y }));
        await sleep(600);
        el.focus();
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        for (let i = 1; i <= value.length; i++) {
          setter.call(el, value.slice(0, i));
          el.dispatchEvent(new Event("input", { bubbles: true }));
          await sleep(28);
        }
        await sleep(300);
      },
      hideCursor: () => setCursor((c) => ({ ...c, visible: false })),
      stage: (i) => setStage(i),
      scrollBy: async (dy, ms) => {
        const steps = Math.max(1, Math.round(ms / 16));
        for (let i = 0; i < steps; i++) {
          check();
          window.scrollBy(0, dy / steps);
          await sleep(16);
        }
      },
      exists: (sel, text) => !!find(sel, text),
    };

    runScript(api)
      .catch((e) => {
        if (!(e instanceof Aborted)) console.error(e);
      })
      .finally(() => {
        clearInterval(prog);
        abort.current = null;
        setRunning(false);
        setTarget(null);
        setCaption(null);
        setChapter(null);
        setCursor({ x: -100, y: -100, visible: false, click: 0 });
        setProgress(0);
        setStage(-1);
        document.documentElement.classList.remove("nx-touring");
      });
    document.documentElement.classList.add("nx-touring");
  }, [navigate]);

  const pad = 10;
  return (
    <TourCtx.Provider value={{ running, start, stop }}>
      {children}
      {running && (
        <div className="tour-layer" aria-live="polite">
          {/* 스포트라이트: 화면을 어둡게 하고 대상만 뚫는다 */}
          <svg className={`tour-dim${rect ? " on" : ""}`} width="100%" height="100%" aria-hidden="true">
            <defs>
              <mask id="tour-hole">
                <rect width="100%" height="100%" fill="#fff" />
                {rect && (
                  <rect
                    className="tour-hole"
                    x={rect.left - pad}
                    y={rect.top - pad}
                    width={rect.width + pad * 2}
                    height={rect.height + pad * 2}
                    rx="18"
                    fill="#000"
                  />
                )}
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(5,11,22,.62)" mask="url(#tour-hole)" />
          </svg>
          {rect && (
            <div
              className="tour-ring"
              style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
            />
          )}

          {/* 가짜 커서 */}
          <div className={`tour-cursor${cursor.visible ? " on" : ""}`} style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}>
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 3l15 8-6.5 1.6L9.5 19z" fill="#fff" stroke="#0b1220" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            <span key={cursor.click} className={cursor.click ? "tour-ripple" : undefined} />
          </div>

          {/* 자막 */}
          {caption && (
            <div className={`tour-caption${caption.top ? " tour-caption--top" : ""}`} key={caption.title}>
              {caption.tag && <span className="tour-tag">{caption.tag}</span>}
              <strong>{caption.title}</strong>
              {caption.sub && <span className="tour-sub">{caption.sub}</span>}
            </div>
          )}

          {/* 챕터 카드 */}
          {chapter && (
            <div className={`tour-chapter tour-chapter--${chapter.kind ?? "chapter"}`} key={chapter.title} style={{ animationDuration: `${chapter.ms}ms` }}>
              <div className="tour-chapter-inner" style={{ animationDuration: `${chapter.ms}ms` }}>
                {chapter.no && <span className="tour-chapter-no">{chapter.no}</span>}
                <h2>{chapter.title}</h2>
                {chapter.sub && <p>{chapter.sub}</p>}
                {chapter.items && (
                  <ol className={`tour-items${chapter.numbered ? " numbered" : ""}`}>
                    {chapter.items.map((it, i) => (
                      <li key={it.title} style={{ animationDelay: `${0.35 + i * 0.35}s` }}>
                        {chapter.numbered && <span className="n">{i + 1}</span>}
                        <div>
                          <strong>{it.title}</strong>
                          {it.sub && <span>{it.sub}</span>}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {chapter.flow && (
                  <div className={`tour-flow${chapter.flow.animate ? " animate" : ""}`}>
                    {chapter.flow.steps.map((st, i) => (
                      <div key={st} className="tour-flow-cell" style={{ animationDelay: `${0.3 + i * 0.42}s` }}>
                        {i > 0 && <span className="tour-flow-arrow">→</span>}
                        <span className={`tour-flow-node${chapter.flow!.active === i ? " active" : ""}${chapter.flow!.active !== undefined && i < chapter.flow!.active ? " done" : ""}`}>{st}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 지금 어느 단계인지: 화면 위 흐름 띠 */}
          {stage >= 0 && !chapter && (
            <div className="tour-stagebar">
              {STAGES.map((st, i) => (
                <span key={st} className={i === stage ? "on" : i < stage ? "done" : ""}>
                  <i>{i + 1}</i>
                  {st}
                </span>
              ))}
            </div>
          )}

          <div className="tour-progress">
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="tour-esc">자동 시연 중 · ESC로 멈춤</div>
        </div>
      )}
    </TourCtx.Provider>
  );
}
