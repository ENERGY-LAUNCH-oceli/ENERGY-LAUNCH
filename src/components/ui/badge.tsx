import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/utils/cn';

export const badgeVariants = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-pill font-medium [&_svg]:size-3.5', {
  variants: {
    tone: {
      neutral: 'bg-surface-sunken text-text-secondary',
      accent: 'bg-accent-subtle text-accent-strong',
      info: 'bg-info-subtle text-info',
      success: 'bg-success-subtle text-success',
      warning: 'bg-warning-subtle text-warning',
      error: 'bg-error-subtle text-error',
      inverse: 'bg-primary text-primary-foreground',
    },
    size: { sm: 'h-5 px-1.5 text-[11px] leading-4', md: 'h-[22px] px-2 text-caption' },
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
