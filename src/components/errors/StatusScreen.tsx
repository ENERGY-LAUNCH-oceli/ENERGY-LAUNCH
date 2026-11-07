import { useEffect, useRef, useState, type ReactNode } from 'react';
import { pickAnimation, startStatusAnimation, type StatusAnimation } from '@/errors/animations';
import { statusClass, type StatusInfo } from '@/errors/codes';
import { animationColors } from '@/errors/theme';
import { cn } from '@/utils/cn';

/** Принудительная анимация для проверки: ?anim=<id>. */
const forcedAnimation = () => {
  try {
    return new URLSearchParams(window.location.search).get('anim');
  } catch {
    return null;
  }
};

/**
 * Анимация на canvas: выбирается один раз при монтировании (при обновлении страницы – другая),
 * при смене темы перезапускается с новыми цветами.
 */
export function useStatusAnimation(info: StatusInfo) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [anim] = useState<StatusAnimation>(() => pickAnimation(forcedAnimation()));
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const label = info.code ? String(info.code) : '000';
    const cls = statusClass(info.code);
    let running = startStatusAnimation(canvas, { label, colors: animationColors(cls), animation: anim });
    const mo = new MutationObserver(() => {
      running.stop();
      running = startStatusAnimation(canvas, { label, colors: animationColors(cls), animation: anim });
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] });
    return () => {
      mo.disconnect();
      running.stop();
    };
  }, [anim, info.code]);
  return { ref, anim };
}

export interface StatusScreenProps {
  info: StatusInfo;
  actions?: ReactNode;
  /** Под кнопками: ссылки, пояснения. */
  footer?: ReactNode;
  className?: string;
}

/** Страница состояния: анимация, код, пояснение и что делать. Один вид для кодов HTTP и «нет подключения». */
export function StatusScreen({ info, actions, footer, className }: StatusScreenProps) {
  const { ref, anim } = useStatusAnimation(info);
  const cls = statusClass(info.code);
  const failing = cls === 'client' || cls === 'server' || cls === 'offline';
  return (
    <section data-testid="status-screen" data-status={info.code} data-animation={anim.id} aria-labelledby="status-title" className={cn('mx-auto flex w-full max-w-3xl flex-col items-center gap-6 py-6 text-center', className)}>
      <canvas ref={ref} aria-hidden className="h-[220px] w-full touch-none sm:h-[280px]" />
      <div className="flex max-w-xl flex-col items-center gap-2">
        <span className={cn('font-mono text-caption font-medium uppercase tracking-wide', failing ? 'text-error' : 'text-accent-strong')}>{info.code ? `HTTP ${info.code} · ${info.name}` : 'Offline · нет ответа сервера'}</span>
        <h1 id="status-title" className="text-h1">
          {info.title}
        </h1>
        <p className="text-body-lg text-text-secondary">{info.text}</p>
        <p className="text-body-sm text-text-muted">{info.hint}</p>
      </div>
      {actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
      {footer}
      <p className="text-caption text-text-muted" data-testid="status-animation-name">
        Анимация «{anim.name}» – при обновлении страницы будет другая
      </p>
    </section>
  );
}
