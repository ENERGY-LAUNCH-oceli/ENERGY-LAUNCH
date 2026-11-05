import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import * as React from 'react';
import { cn } from '@/utils/cn';

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps extends Omit<React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>, 'children'> {
  options: RadioOption[];
}

export function RadioGroup({ options, className, ...props }: RadioGroupProps) {
  const baseId = React.useId();
  return (
    <RadioGroupPrimitive.Root className={cn('flex flex-col gap-3', className)} {...props}>
      {options.map((o) => {
        const id = `${baseId}-${o.value}`;
        return (
          <div key={o.value} className="flex items-start gap-2.5">
            <RadioGroupPrimitive.Item
              id={id}
              value={o.value}
              disabled={o.disabled}
              className="peer mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-border-strong bg-surface transition-colors duration-fast hover:border-accent disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:border-accent-strong"
            >
              <RadioGroupPrimitive.Indicator className="size-2.5 rounded-full bg-accent-strong" />
            </RadioGroupPrimitive.Item>
            <label htmlFor={id} className="cursor-pointer text-body-sm peer-disabled:cursor-not-allowed peer-disabled:opacity-45">
              <span className="font-medium">{o.label}</span>
              {o.description && <span className="block text-caption text-text-muted">{o.description}</span>}
            </label>
          </div>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
