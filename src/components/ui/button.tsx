import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/utils/cn';

/**
 * Кнопка. Форма «пилюля» и полужирное начертание — как у кнопок Oceli Energy.
 * primary — тёмно-синяя (основное действие), accent — бирюзовая (действие продвижения запуска),
 * secondary — белая с рамкой, outline — бирюзовая рамка (как «Посмотреть» на сайте),
 * ghost — без фона, danger — деструктивное действие.
 */
export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-pill font-semibold transition-colors duration-fast ease-brand disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-[#031A30]',
        accent: 'bg-accent-strong text-accent-foreground hover:bg-[#016E7A] active:bg-[#016570]',
        secondary: 'border border-border-strong bg-surface text-text-primary hover:border-text-muted hover:bg-surface-secondary',
        outline: 'border border-accent bg-transparent text-accent-strong hover:bg-accent-subtle',
        ghost: 'text-text-secondary hover:bg-surface-sunken hover:text-text-primary',
        danger: 'border border-error-border bg-error-subtle text-error hover:border-error hover:bg-[#FBE3DC]',
        link: 'h-auto rounded-none px-0 text-accent-strong underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3.5 text-caption font-semibold',
        md: 'h-10 px-5 text-body-sm font-semibold',
        lg: 'h-12 px-7 text-body font-semibold',
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
