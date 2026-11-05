import { PageHeader } from '@/components/common/PageHeader';
import { ComponentsSection } from './design-system/ComponentsSection';
import { FoundationsSection } from './design-system/FoundationsSection';
import { ProductSection } from './design-system/ProductSection';

const TOC = [
  { group: 'Основа', items: [['colors', 'Цвета'], ['typography', 'Типографика']] },
  {
    group: 'UI Kit',
    items: [
      ['button', 'Button'],
      ['input', 'Input · Select'],
      ['checkbox', 'Checkbox · Radio'],
      ['tabs', 'Tabs'],
      ['card', 'Card'],
      ['badge', 'Badge · Status'],
      ['progress', 'Progress · Tooltip'],
      ['modal', 'Modal · Drawer'],
      ['alert', 'Alert'],
      ['datatable', 'DataTable'],
      ['states', 'Состояния'],
      ['kpi', 'KPI'],
      ['timeline', 'Timeline · Stepper'],
      ['fileupload', 'FileUpload'],
    ],
  },
  {
    group: 'Продукт',
    items: [
      ['launch-progress', 'LaunchProgress'],
      ['next-action', 'NextActionCard'],
      ['stage-card', 'LaunchStageCard'],
      ['validation-status', 'ValidationStatus'],
      ['validation-result', 'ValidationResult'],
      ['blockers', 'Blocker'],
      ['evidence', 'Evidence'],
      ['data-quality', 'DataQuality'],
      ['audit', 'AuditTimeline'],
    ],
  },
] as const;

/** /design-system — витрина токенов и всех компонентов с их состояниями. */
export function DesignSystemPage() {
  return (
    <div className="flex gap-10">
      <div className="flex min-w-0 flex-1 flex-col gap-12">
        <PageHeader
          eyebrow="Дизайн-система"
          title="ENERGY LAUNCH Design System"
          description="Визуальный язык Oceli Energy, перенесённый в инженерный SaaS: Manrope, тёмно-синий и бирюзовый, кнопки-«пилюли», чистые светлые поверхности."
        />
        <FoundationsSection />
        <ComponentsSection />
        <ProductSection />
      </div>
      <nav aria-label="Содержание" className="sticky top-24 hidden h-[calc(100vh-8rem)] w-48 shrink-0 overflow-y-auto 2xl:block">
        {TOC.map((g) => (
          <div key={g.group} className="mb-5 flex flex-col gap-1">
            <span className="mb-1 text-label uppercase text-accent-strong">{g.group}</span>
            {g.items.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="rounded-xs px-2 py-1 text-caption text-text-secondary hover:bg-surface-sunken hover:text-text-primary">
                {label}
              </a>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
}
