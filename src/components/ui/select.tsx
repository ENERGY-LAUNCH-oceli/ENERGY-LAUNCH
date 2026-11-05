import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/utils/cn';
import { fieldControlClass } from './input';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps {
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Выпадающий список на Radix Select: клавиатура, экранные дикторы, без нативного вида. */
export function Select({ id, options, placeholder = 'Выберите…', invalid, className, ...props }: SelectProps) {
  return (
    <SelectPrimitive.Root value={props.value} defaultValue={props.defaultValue} onValueChange={props.onValueChange} disabled={props.disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={props['aria-label']}
        aria-invalid={invalid || undefined}
        className={cn(fieldControlClass, 'flex h-10 items-center justify-between gap-2 px-3 text-left data-[placeholder]:text-text-muted', className)}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-text-muted" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-surface shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectItem key={o.value} {...o} />
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectOption>(({ value, label, description, disabled }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    value={value}
    disabled={disabled}
    className="relative flex cursor-pointer select-none flex-col rounded-sm py-2 pl-8 pr-3 text-body-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-secondary data-[disabled]:opacity-45"
  >
    <SelectPrimitive.ItemIndicator className="absolute left-2.5 top-2.5">
      <Check className="size-4 text-accent-strong" aria-hidden />
    </SelectPrimitive.ItemIndicator>
    <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
    {description && <span className="text-caption text-text-muted">{description}</span>}
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';
