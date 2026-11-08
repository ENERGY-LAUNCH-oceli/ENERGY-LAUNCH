import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Зерно поверх градиента (SVG-шум, data: URL – разрешён CSP img-src). */
export const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E\")";

/** Тёмная панель бренда: тёмно-синий фон, бирюзовое свечение снизу, зерно. Общая для окна входа и страниц ошибок. */
export function GlowPanel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('relative overflow-hidden bg-[#020B16] text-white', className)}>
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(130%_85%_at_80%_110%,rgba(43,199,214,0.95)_0%,rgba(1,138,152,0.7)_22%,rgba(1,101,112,0.4)_42%,rgba(5,40,73,0.25)_62%,transparent_80%)]" />
      <div aria-hidden className="absolute inset-0 opacity-[0.18] mix-blend-overlay" style={{ backgroundImage: NOISE }} />
      {children}
    </div>
  );
}

/** Логотип на тёмной панели. */
export function GlowBrand() {
  return (
    <div className="relative flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="size-8" />
      <span className="font-heading text-lg font-semibold tracking-tight text-white">Energy Launch</span>
    </div>
  );
}
