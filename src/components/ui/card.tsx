import * as React from 'react';
import { cn } from '@/utils/cn';

/** Карточка: белая поверхность, тонкая рамка, без тени (тени — только у всплывающих слоёв). */
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean; tone?: 'default' | 'secondary' }>(
  ({ className, interactive, tone = 'default', ...p }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-border text-text-primary',
        tone === 'secondary' ? 'bg-surface-secondary' : 'bg-surface',
        interactive && 'transition-colors duration-fast hover:border-border-strong',
        className,
      )}
      {...p}
    />
  ),
);
Card.displayName = 'Card';

export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...p} />
);
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn('text-h3', className)} {...p} />;
export const CardDescription = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-body-sm text-text-secondary', className)} {...p} />
);
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('px-5 pb-5', className)} {...p} />;
export const CardFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-wrap items-center gap-2 border-t border-border px-5 py-3', className)} {...p} />
);
