import type { ReactNode } from 'react';
import { GlowBrand, GlowPanel } from '@/components/common/GlowPanel';
import { CLASS_TITLE, statusClass, type StatusInfo } from '@/errors/codes';
import { cn } from '@/utils/cn';

/** «Нет сигнала»: точка и три гаснущие дуги волн. */
export function NoSignal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={cn('w-[clamp(120px,14vw,190px)]', className)} fill="none" strokeLinecap="round" aria-hidden>
      <path d="M44.44 68.44A22 22 0 0 1 75.56 68.44" stroke="white" strokeOpacity=".4" strokeWidth="7" />
      <path d="M30.3 54.3A42 42 0 0 1 89.7 54.3" stroke="white" strokeOpacity=".2" strokeWidth="7" />
      <path d="M16.16 40.16A62 62 0 0 1 103.84 40.16" stroke="white" strokeOpacity=".1" strokeWidth="7" />
      <circle cx="60" cy="84" r="6.5" fill="white" />
    </svg>
  );
}

export interface StatusScreenProps {
  info: StatusInfo;
  actions?: ReactNode;
  /** Под кнопками: ссылки, пояснения. */
  footer?: ReactNode;
  /** Отдельная страница (по адресу, офлайн): во весь экран и с логотипом на тёмной панели. */
  standalone?: boolean;
  className?: string;
}

/**
 * Страница состояния – одна для всех кодов HTTP и «Нет подключения»: слева тёмная панель с кодом
 * (как на окне входа), справа – что произошло и что делать.
 */
export function StatusScreen({ info, actions, footer, standalone, className }: StatusScreenProps) {
  const cls = statusClass(info.code);
  const failing = cls === 'client' || cls === 'server' || cls === 'offline';
  return (
    <section
      data-testid="status-screen"
      data-status={info.code}
      aria-labelledby="status-title"
      className={cn('grid w-full overflow-hidden rounded-2xl border border-border bg-surface md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]', standalone ? 'min-h-[calc(100dvh-1.5rem)]' : 'min-h-[460px]', className)}
    >
      <GlowPanel className="min-h-[240px]">
        {/* Код – ровно по центру всей панели; логотип и подпись не сдвигают его */}
        <div className="absolute inset-0 flex items-center justify-center">
          {info.code ? (
            // Отрицательный трекинг съедает правый край последней цифры – компенсация справа
            <span className="pr-[0.05em] font-heading text-[clamp(96px,13vw,200px)] font-semibold leading-none tracking-[-0.05em]">{info.code}</span>
          ) : (
            <NoSignal />
          )}
        </div>
        {standalone && (
          <div className="absolute left-8 top-8">
            <GlowBrand />
          </div>
        )}
        <span className="absolute bottom-8 left-8 font-mono text-caption uppercase tracking-[0.14em] text-white/60">{info.code ? `HTTP ${info.code} · ${info.name}` : 'Offline · нет ответа сервера'}</span>
      </GlowPanel>

      <div className="flex flex-col justify-center gap-4 p-8 sm:p-12">
        <span className={cn('text-label', failing ? 'text-error' : 'text-accent-strong')}>{CLASS_TITLE[cls]}</span>
        <h1 id="status-title" className="text-h1">
          {info.title}
        </h1>
        <p className="max-w-lg text-body-lg text-text-secondary">{info.text}</p>
        <p className="max-w-lg text-body-sm text-text-muted">{info.hint}</p>
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
        {footer}
      </div>
    </section>
  );
}
