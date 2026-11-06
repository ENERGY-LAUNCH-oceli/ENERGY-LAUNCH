import * as React from 'react';
import { cn } from '@/utils/cn';

/** Один пробег тока по линии, мс. Загрузка завершается только на границе пробега. */
export const CURRENT_CYCLE_MS = 1800;
/** Минимум – два пробега: сцена успевает прорисоваться, анимация не обрывается на середине. */
const MIN_CYCLES = 2;
/** Сцена после загрузки: вспышка → опоры уходят → провода стягиваются в черту → появляется текст. */
const MORPH_DELAY_MS = 450;
const MORPH_MS = 900;
const REVEAL_MS = 4300;
/** Надпись полностью появилась – анимация неподвижна: безопасный момент для тяжёлой работы основного потока. */
const HOLD_MS = 3050;
const EXIT_MS = 1100;

type Phase = 'loading' | 'reveal' | 'exit' | 'done';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ── Геометрия сцены (viewBox 800×260): опоры уходят к горизонту ──────────────
const VB = { w: 800, h: 260 };
const TOWERS = [
  { x: 120, base: 238, s: 1 },
  { x: 345, base: 216, s: 0.72 },
  { x: 518, base: 202, s: 0.53 },
  { x: 646, base: 193, s: 0.4 },
  { x: 742, base: 187, s: 0.31 },
];
/** Точки подвеса четырёх фаз (низ гирлянды изоляторов) в координатах опоры. */
const PHASES: [number, number][] = [
  [-50, -98],
  [50, -98],
  [-38, -128],
  [38, -128],
];
const EARTH: [number, number] = [0, -170];
/** Черта, в которую стягиваются провода и из-за которой поднимается текст. */
const LINE_Y = 150;
const LINE_X: [number, number] = [190, 610];

const at = (t: (typeof TOWERS)[number], [px, py]: [number, number]) => [t.x + px * t.s, t.base + py * t.s] as const;

/** Провод от опоры к опоре с провисом; структура команд одинакова с прямой – для морфинга. */
function wire(anchor: [number, number]): string {
  const pts = TOWERS.map((t) => at(t, anchor));
  let d = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    const sag = Math.hypot(x1 - x0, y1 - y0) * 0.11;
    d += ` Q${((x0 + x1) / 2).toFixed(1)},${((y0 + y1) / 2 + sag).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

function straight(): string {
  const n = TOWERS.length;
  const xs = TOWERS.map((_, i) => LINE_X[0] + ((LINE_X[1] - LINE_X[0]) * i) / (n - 1));
  let d = `M${xs[0]},${LINE_Y}`;
  for (let i = 1; i < n; i++) d += ` Q${(xs[i - 1]! + xs[i]!) / 2},${LINE_Y} ${xs[i]},${LINE_Y}`;
  return d;
}

/** Решётчатая опора ЛЭП (основание – 0,0; высота ~172). */
const TOWER_BODY = [
  'M-30,0 L-12,-92 L-8,-128 L-4,-160 L0,-172 L4,-160 L8,-128 L12,-92 L30,0',
  'M-30,0 L22,-40 M30,0 L-22,-40 M-22,-40 L16,-70 M22,-40 L-16,-70 M-16,-70 L12,-92 M16,-70 L-12,-92',
  'M-26,-20 L26,-20 M-22,-40 L22,-40 M-16,-70 L16,-70 M-12,-92 L12,-92',
  'M-56,-108 L56,-108 M-56,-108 L-12,-96 M56,-108 L12,-96 M-30,-108 L-12,-100 M30,-108 L12,-100',
  'M-43,-138 L43,-138 M-43,-138 L-9,-128 M43,-138 L9,-128',
  'M-8,-128 L0,-172 L8,-128 M-4,-150 L4,-150',
].join(' ');
const INSULATORS = PHASES.map(([x, y]) => `M${x},${y - 10} L${x},${y}`).join(' ');

function Tower({ t, index }: { t: (typeof TOWERS)[number]; index: number }) {
  return (
    <g style={{ '--i': index, '--far': TOWERS.length - 1 - index } as React.CSSProperties} className="pl-tower">
      <g transform={`translate(${t.x} ${t.base}) scale(${t.s})`}>
        <path d={TOWER_BODY} pathLength={1} className="pl-tower-body" vectorEffect="non-scaling-stroke" />
        <path d={INSULATORS} pathLength={1} className="pl-insulators" vectorEffect="non-scaling-stroke" />
        {PHASES.map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={2.4} className="pl-clamp" />
        ))}
      </g>
    </g>
  );
}

const WORD = 'Energy Launch';
const TAGLINE = 'Платформа для сопровождения запуска энергетических объектов';

/**
 * Прелоадер: перспектива линии электропередачи, по фазам бегут импульсы тока.
 * После загрузки (на границе пробега тока): линия вспыхивает, опоры уходят, провода стягиваются в одну черту,
 * из-за неё по буквам поднимается «Energy Launch»; затем буквы уходят вверх, и экран поднимается шторкой.
 */
export function Preloader({ ready, canExit = true, status, onHold, onDone }: { ready: boolean; canExit?: boolean; status?: string; onHold?: () => void; onDone?: () => void }) {
  const [timeUp, setTimeUp] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>('loading');
  const started = React.useRef(performance.now());
  const svgRef = React.useRef<SVGSVGElement>(null);
  const curved = React.useMemo(() => PHASES.map(wire), []);
  const line = React.useMemo(straight, []);

  React.useEffect(() => {
    if (!ready || phase !== 'loading') return;
    const elapsed = performance.now() - started.current;
    const cycles = Math.max(MIN_CYCLES, Math.ceil(elapsed / CURRENT_CYCLE_MS));
    const wait = reducedMotion() ? 0 : cycles * CURRENT_CYCLE_MS - elapsed;
    const t = window.setTimeout(() => setPhase('reveal'), Math.max(0, wait));
    return () => window.clearTimeout(t);
  }, [ready, phase]);

  React.useEffect(() => {
    if (phase === 'reveal') {
      const morph = window.setTimeout(
        () => svgRef.current?.querySelectorAll<SVGAnimateElement>('animate.pl-morph').forEach((a) => a.beginElement()),
        reducedMotion() ? 0 : MORPH_DELAY_MS,
      );
      const hold = window.setTimeout(() => onHold?.(), reducedMotion() ? 0 : HOLD_MS);
      const next = window.setTimeout(() => setTimeUp(true), reducedMotion() ? 400 : REVEAL_MS);
      return () => {
        window.clearTimeout(morph);
        window.clearTimeout(hold);
        window.clearTimeout(next);
      };
    }
    if (phase === 'exit') {
      const t = window.setTimeout(() => {
        setPhase('done');
        onDone?.();
      }, reducedMotion() ? 200 : EXIT_MS);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase, onDone, onHold]);

  // Уход – только когда время раскрытия вышло и приложение под прелоадером готово
  React.useEffect(() => {
    if (phase === 'reveal' && timeUp && canExit) setPhase('exit');
  }, [phase, timeUp, canExit]);

  if (phase === 'done') return null;

  const morph = (from: string) => (
    <animate className="pl-morph" attributeName="d" from={from} to={line} dur={`${MORPH_MS}ms`} begin="indefinite" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.16 1 0.3 1" />
  );

  return (
    <div
      className={cn('preloader fixed inset-0 z-[100] flex items-center justify-center bg-background', `is-${phase}`)}
      role="status"
      aria-live="polite"
      aria-label={phase === 'loading' ? 'Загрузка' : WORD}
      style={{ '--pl-cycle': `${CURRENT_CYCLE_MS}ms` } as React.CSSProperties}
    >
      <div className="pl-stage relative w-full max-w-[880px] px-6">
        <svg ref={svgRef} viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id="pl-horizon" x1="0" x2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0" />
              <stop offset="0.2" stopColor="currentColor" stopOpacity="0.4" />
              <stop offset="0.8" stopColor="currentColor" stopOpacity="0.2" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
            <filter id="pl-blur" x="-10%" y="-300%" width="120%" height="700%">
              <feGaussianBlur stdDeviation="3.5" />
            </filter>
          </defs>

          <path d="M20,240 L780,184" className="pl-horizon" stroke="url(#pl-horizon)" pathLength={1} />
          {TOWERS.map((t, i) => (
            <Tower key={t.x} t={t} index={i} />
          ))}
          <path d={wire(EARTH)} pathLength={1} className="pl-earth" />

          {curved.map((d, i) => (
            <g key={i} style={{ '--w': i } as React.CSSProperties}>
              <path d={d} pathLength={1} className="pl-wire">
                {morph(d)}
              </path>
              <path d={d} pathLength={100} className="pl-halo" filter="url(#pl-blur)" />
              <path d={d} pathLength={100} className="pl-core" />
              <path d={d} pathLength={1} className="pl-charge">
                {morph(d)}
              </path>
            </g>
          ))}
        </svg>

        {/* Название проявляется слева направо, пока черта втягивается: энергия переходит из провода в текст */}
        <div className="pl-title pointer-events-none absolute inset-x-0 flex flex-col items-center px-6 text-center" style={{ top: `${(LINE_Y / VB.h) * 100}%` }}>
          <span className="pl-word font-heading" aria-hidden>
            {WORD}
          </span>
          <span className="pl-tagline" aria-hidden>
            {TAGLINE}
          </span>
        </div>

        <p className="pl-status mt-2 h-4 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">{phase === 'loading' ? (status ?? 'Подключение линии') : ''}</p>
      </div>
    </div>
  );
}
