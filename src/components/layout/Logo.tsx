import { cn } from '@/utils/cn';

/** Знак ENERGY LAUNCH: кольцо из трёх сегментов (мотив знака Oceli) с импульсом запуска. */
export function Logo({ className, inverse, compact }: { className?: string; inverse?: boolean; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <path d="M16 3a13 13 0 0 1 11.3 6.5" fill="none" stroke="#22AFBF" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M28.6 13.5A13 13 0 0 1 20 28.4" fill="none" stroke="#018A98" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M15.5 29A13 13 0 0 1 3.4 12" fill="none" stroke={inverse ? '#FFFFFF' : '#052849'} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M17.5 9.5 12 17h4l-1.5 5.5L20 15h-4z" fill={inverse ? '#FFFFFF' : '#052849'} />
      </svg>
      {!compact && <span className={cn('flex flex-col leading-none', inverse ? 'text-white' : 'text-text-primary')}>
        <span className="text-[15px] font-extrabold tracking-[0.04em]">ENERGY LAUNCH</span>
        <span className={cn('mt-1 text-[10px] font-semibold tracking-[0.16em]', inverse ? 'text-white/50' : 'text-text-muted')}>OCELI ENERGY</span>
      </span>}
      {compact && <span className="sr-only">ENERGY LAUNCH</span>}
    </span>
  );
}
