import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /** Надзаголовок в стиле Oceli: 12px / 800 / 0.16em, бирюзовый. */
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-3xl flex-col gap-2">
        {eyebrow && <span className="text-label text-text-muted">{eyebrow}</span>}
        <h1 className="text-h1">{title}</h1>
        {description && <p className="text-body-lg text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Заголовок секции внутри страницы. */
export function SectionHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        {eyebrow && <span className="text-label text-text-muted">{eyebrow}</span>}
        <h2 className="text-h2">{title}</h2>
        {description && <p className="text-body-sm text-text-secondary">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
