import { cn } from '@/utils/cn';

/** Знак ENERGY LAUNCH: опора ЛЭП с проводами на акцентном квадрате (как в заставке) и словесный знак. */
export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-text-primary', className)}>
      <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden>
        <rect width="24" height="24" rx="6" className="fill-accent" />
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" className="stroke-accent-foreground">
          <path d="M6 12.5Q3 14.3 0 13.2M18 12.5Q21 14.3 24 13.2M8.5 9Q4.5 11 0 9.8M15.5 9Q19.5 11 24 9.8" strokeWidth={1} opacity={0.65} />
          <path d="M8 20 12 4.5l4 15.5M6 12.5h12M8.5 9h7M10.1 12.5 15.4 20M13.9 12.5 8.6 20" strokeWidth={1.6} />
        </g>
      </svg>
      {!compact && (
        <span className="font-heading text-[15px] font-semibold tracking-[-0.03em]">
          Energy Launch
        </span>
      )}
      {compact && <span className="sr-only">ENERGY LAUNCH</span>}
    </span>
  );
}
