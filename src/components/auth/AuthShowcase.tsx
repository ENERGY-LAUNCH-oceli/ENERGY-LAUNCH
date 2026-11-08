import * as React from 'react';
import { GlowBrand, GlowPanel } from '@/components/common/GlowPanel';
import { cn } from '@/utils/cn';

/**
 * Левая панель окна входа: тёмный градиент в палитре сайта, стеклянные карточки с фрагментами интерфейса
 * (телеметрия, готовность, сигналы активов) и три слайда о продукте. Карточки парят (auth-float в styles.css).
 */

const SLIDES = [
  { title: 'Каждый этап проверен', text: 'История счётчиков, телеметрия, управление и дашборды проверяются автоматически – по правилам ТЗ, а не вручную.' },
  { title: 'Ошибка с причиной', text: 'Видно, какой сигнал, дата и значение не прошли проверку, и что сделать, чтобы снять препятствие.' },
  { title: 'Готовность подтверждена', text: 'Подтверждения ролей, журнал аудита и протокол готовности объекта – всё в одном следе.' },
];

function Glass({ className, style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div className={cn('auth-float absolute rounded-xl border border-white/15 bg-white/[0.07] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md', className)} style={style}>
      {children}
    </div>
  );
}

function Chip({ dot, children, className, style }: { dot: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <Glass className={cn('flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium text-white/85', className)} style={style}>
      <span className="size-1.5 rounded-full" style={{ background: dot }} />
      {children}
    </Glass>
  );
}

export function AuthShowcase() {
  const [slide, setSlide] = React.useState(0);
  React.useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 6000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <GlowPanel className="hidden rounded-2xl lg:flex lg:flex-col">
      <div className="p-8">
        <GlowBrand />
      </div>

      {/* Карточки интерфейса */}
      <div aria-hidden className="relative min-h-[320px] flex-1">
        {/* Телеметрия */}
        <Glass className="left-[12%] top-[22%] w-[46%] p-4" style={{ ['--r' as string]: '-6deg' }}>
          <div className="mb-2 flex items-center justify-between text-[10px] text-white/60">
            <span className="font-mono">Grid.power_kW · 48 ч</span>
            <span className="text-[#2BC7D6]">● в сети</span>
          </div>
          <svg viewBox="0 0 200 70" className="w-full">
            <defs>
              <linearGradient id="auth-area" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#2BC7D6" stopOpacity=".35" />
                <stop offset="1" stopColor="#2BC7D6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 48 C18 44 26 30 40 34 S62 52 78 40 S102 12 118 22 S142 46 158 30 S184 18 200 24 V70 H0Z" fill="url(#auth-area)" />
            <path d="M0 48 C18 44 26 30 40 34 S62 52 78 40 S102 12 118 22 S142 46 158 30 S184 18 200 24" fill="none" stroke="#2BC7D6" strokeWidth="1.6" />
            <line x1="118" y1="0" x2="118" y2="70" stroke="white" strokeOpacity=".25" strokeDasharray="2 3" />
            <circle cx="118" cy="22" r="3" fill="white" />
          </svg>
        </Glass>

        {/* Готовность */}
        <Glass className="right-[12%] top-[40%] w-[30%] p-4" style={{ ['--r' as string]: '7deg', animationDelay: '-2.5s' }}>
          <svg viewBox="0 0 80 80" className="mx-auto w-[70%]">
            <circle cx="40" cy="40" r="30" fill="none" stroke="white" strokeOpacity=".12" strokeWidth="9" />
            <circle cx="40" cy="40" r="30" fill="none" stroke="#2BC7D6" strokeWidth="9" strokeDasharray={`${2 * Math.PI * 30 * 0.75} 999`} strokeLinecap="round" transform="rotate(-90 40 40)" />
            <text x="40" y="45" textAnchor="middle" fill="white" fontSize="15" fontWeight="600">
              3/4
            </text>
          </svg>
          <p className="mt-2 text-center text-[10px] text-white/65">этапов завершено</p>
        </Glass>

        <Chip dot="#F0BD69" className="left-[30%] top-[8%]" style={{ ['--r' as string]: '-3deg', animationDelay: '-1s' }}>
          PV1 · 44,4 кВт
        </Chip>
        <Chip dot="#2BC7D6" className="right-[16%] top-[22%]" style={{ ['--r' as string]: '4deg', animationDelay: '-4s' }}>
          АКБ1 · SoC 62 %
        </Chip>
        <Chip dot="#67D39C" className="left-[18%] top-[64%]" style={{ ['--r' as string]: '-2deg', animationDelay: '-3s' }}>
          TM-008 · пройдено
        </Chip>
      </div>

      {/* Слайды */}
      <div className="relative flex flex-col items-center gap-3 px-10 pb-10 text-center">
        {/* Все слайды в одной ячейке сетки: высота не прыгает, смена – плавное растворение */}
        <div className="grid w-full max-w-lg">
          {SLIDES.map((x, i) => (
            <div
              key={x.title}
              aria-hidden={i !== slide}
              className={cn(
                'col-start-1 row-start-1 flex flex-col items-center gap-3 transition-[opacity,transform,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                i === slide ? 'translate-y-0 opacity-100 blur-0' : 'pointer-events-none translate-y-3 opacity-0 blur-[2px]',
              )}
            >
              <h2 className="font-heading text-[clamp(26px,2.4vw,36px)] font-semibold leading-tight tracking-[-0.02em] text-white">{x.title}</h2>
              <p className="max-w-md text-body-sm text-white/65">{x.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-1.5" role="tablist" aria-label="Слайды">
          {SLIDES.map((x, i) => (
            <button
              key={x.title}
              type="button"
              role="tab"
              aria-selected={i === slide}
              aria-label={x.title}
              onClick={() => setSlide(i)}
              className={cn('h-1.5 rounded-full transition-all duration-500', i === slide ? 'w-8 bg-white' : 'w-1.5 bg-white/35 hover:bg-white/60')}
            />
          ))}
        </div>
      </div>
    </GlowPanel>
  );
}
