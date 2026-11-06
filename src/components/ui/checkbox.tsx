import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/utils/cn';

export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const box = (
      <CheckboxPrimitive.Root
        ref={ref}
        id={inputId}
        className={cn(
          'peer mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-xs border-[1.5px] border-border-strong bg-surface transition-colors duration-fast hover:border-accent disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:border-accent-strong data-[state=indeterminate]:border-accent-strong data-[state=checked]:bg-accent-strong data-[state=indeterminate]:bg-accent-strong',
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="text-accent-foreground">
          {props.checked === 'indeterminate' ? <Minus className="size-3.5" strokeWidth={3} /> : <Check className="size-3.5" strokeWidth={3} />}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
    if (!label) return box;
    return (
      <div className="flex items-start gap-2.5">
        {box}
        <label htmlFor={inputId} className="cursor-pointer text-body-sm peer-disabled:cursor-not-allowed peer-disabled:opacity-45">
          <span className="font-medium">{label}</span>
          {description && <span className="block text-caption text-text-muted">{description}</span>}
        </label>
      </div>
    );
  },
);
Checkbox.displayName = 'Checkbox';
