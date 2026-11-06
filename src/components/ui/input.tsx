import * as React from 'react';
import { cn } from '@/utils/cn';

export const fieldControlClass =
  'w-full rounded-md border border-border bg-surface text-body-sm text-text-primary transition-colors duration-fast placeholder:text-text-muted hover:border-border-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/15 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:ring-error/15';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Элемент слева (иконка). */
  leading?: React.ReactNode;
  /** Элемент справа (единица измерения, иконка). */
  trailing?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, leading, trailing, ...props }, ref) => {
  if (!leading && !trailing) return <input ref={ref} className={cn(fieldControlClass, 'h-9 px-3', className)} {...props} />;
  return (
    <div className="relative flex items-center">
      {leading && <span className="pointer-events-none absolute left-3 text-text-muted [&_svg]:size-4">{leading}</span>}
      <input ref={ref} className={cn(fieldControlClass, 'h-9 px-3', leading && 'pl-9', trailing && 'pr-12', className)} {...props} />
      {trailing && <span className="pointer-events-none absolute right-3 text-caption text-text-muted">{trailing}</span>}
    </div>
  );
});
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldControlClass, 'min-h-24 px-3 py-2.5', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Поле формы: подпись, контрол, подсказка или ошибка. Совместимо с React Hook Form. */
export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  const messageId = htmlFor ? `${htmlFor}-message` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-body-sm font-medium text-text-primary">
        {label}
        {required && (
          <span className="ml-0.5 text-error" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {(error || hint) && (
        <p id={messageId} className={cn('text-caption', error ? 'text-error' : 'text-text-muted')} role={error ? 'alert' : undefined}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
