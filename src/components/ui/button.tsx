import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/utils/cn';

/**
 * Кнопка. Сдержанная форма (скругление 8px), начертание 500.
 * primary – основное действие экрана, accent – действие, продвигающее запуск,
 * secondary – поверхность с рамкой, outline – бирюзовая рамка, ghost – без фона, danger – деструктивное.
 */
export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,transform] duration-fast ease-brand active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        accent: 'bg-accent-strong text-accent-foreground hover:bg-accent-hover',
        secondary: 'border border-border bg-surface text-text-primary hover:border-border-strong hover:bg-surface-hover',
        outline: 'border border-accent bg-transparent text-accent-strong hover:bg-accent-subtle',
        ghost: 'text-text-secondary hover:bg-surface-sunken hover:text-text-primary',
        danger: 'border border-error-border bg-error-subtle text-error hover:bg-error-hover',
        link: 'link-line h-auto rounded-none px-0 text-accent-strong active:scale-100',
      },
      size: {
        sm: 'h-8 px-3 text-caption font-medium',
        md: 'h-9 px-4 text-body-sm font-medium',
        lg: 'h-11 px-5 text-body font-medium',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...(asChild ? {} : { type: props.type ?? 'button' })}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
