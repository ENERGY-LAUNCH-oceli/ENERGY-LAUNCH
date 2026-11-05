import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/utils/cn';

export const badgeVariants = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-pill border font-semibold [&_svg]:size-3.5', {
  variants: {
    tone: {
      neutral: 'border-border bg-surface-sunken text-text-secondary',
      accent: 'border-accent/30 bg-accent-subtle text-accent-strong',
      info: 'border-info-border bg-info-subtle text-info',
      success: 'border-success-border bg-success-subtle text-success',
      warning: 'border-warning-border bg-warning-subtle text-warning',
      error: 'border-error-border bg-error-subtle text-error',
      inverse: 'border-transparent bg-primary text-primary-foreground',
    },
    size: { sm: 'h-5 px-2 text-[11px] leading-4', md: 'h-6 px-2.5 text-caption' },
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
