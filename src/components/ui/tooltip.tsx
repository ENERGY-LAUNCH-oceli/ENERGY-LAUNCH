import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type * as React from 'react';

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/** Подсказка: тёмная (navy) плашка, как подвал Oceli. Только для пояснений, не для критичной информации. */
export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs rounded-sm bg-surface-inverse px-3 py-2 text-caption text-text-inverse shadow-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-surface-inverse" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
