import { cva, type VariantProps } from 'class-variance-authority';
import { CircleCheck, Info, OctagonAlert, TriangleAlert } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/utils/cn';

const alertVariants = cva('relative flex gap-3 rounded-md border border-l-[3px] p-4 text-body-sm [&>svg]:mt-0.5 [&>svg]:size-[18px] [&>svg]:shrink-0', {
  variants: {
    tone: {
      info: 'border-info-border border-l-info bg-info-subtle [&>svg]:text-info',
      success: 'border-success-border border-l-success bg-success-subtle [&>svg]:text-success',
      warning: 'border-warning-border border-l-warning bg-warning-subtle [&>svg]:text-warning',
      error: 'border-error-border border-l-status-blocked-solid bg-error-subtle [&>svg]:text-error',
    },
  },
  defaultVariants: { tone: 'info' },
});

const ICON = { info: Info, success: CircleCheck, warning: TriangleAlert, error: OctagonAlert } as const;

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>, VariantProps<typeof alertVariants> {
  title?: React.ReactNode;
  action?: React.ReactNode;
}

/** Сообщение в потоке страницы. Ошибки — светлая подложка и акцентная левая граница, без сплошной заливки. */
export function Alert({ tone = 'info', title, action, children, className, ...props }: AlertProps) {
  const Icon = ICON[tone ?? 'info'];
  return (
    <div role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'} className={cn(alertVariants({ tone }), className)} {...props}>
      <Icon aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="font-semibold text-text-primary">{title}</p>}
        {children && <div className="text-text-secondary">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
