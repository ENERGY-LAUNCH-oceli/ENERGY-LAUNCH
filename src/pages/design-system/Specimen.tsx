import type * as React from 'react';
import { cn } from '@/utils/cn';

export function DsSection({ id, eyebrow, title, description, children }: { id: string; eyebrow: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-6 border-t border-border pt-12 first:border-t-0 first:pt-0">
      <div className="flex max-w-3xl flex-col gap-2">
        <span className="text-label uppercase text-accent-strong">{eyebrow}</span>
        <h2 className="text-h1">{title}</h2>
        {description && <p className="text-body-lg text-text-secondary">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Образец компонента: название, назначение и область просмотра. */
export function Specimen({ id, title, description, children, className, tone = 'surface' }: { id?: string; title: string; description?: string; children: React.ReactNode; className?: string; tone?: 'surface' | 'background' }) {
  return (
    <div id={id} className="flex scroll-mt-24 flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-h3">{title}</h3>
        {description && <p className="max-w-3xl text-body-sm text-text-secondary">{description}</p>}
      </div>
      <div className={cn('rounded-lg border border-border p-6', tone === 'surface' ? 'bg-surface' : 'bg-background', className)}>{children}</div>
    </div>
  );
}

export function StateLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-caption font-semibold text-text-muted">{children}</span>;
}
