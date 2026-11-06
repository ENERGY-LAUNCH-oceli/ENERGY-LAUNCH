import { CheckStatusLabel } from '@/components/launch';
import type { CheckStatus } from '@/config/labels';
import type { ValidationResult } from '@/types';
import { cn } from '@/utils/cn';

const BLOCKS: { id: string; title: string; rules: string[] }[] = [
  { id: 'coverage', title: 'Coverage', rules: ['MH-001', 'MH-002'] },
  { id: 'completeness', title: 'Completeness', rules: ['MH-003', 'MH-004'] },
  { id: 'duplicates', title: 'Duplicates', rules: ['MH-005'] },
  { id: 'quality', title: 'Data Quality', rules: ['MH-006', 'MH-008', 'MH-009', 'MH-010'] },
  { id: 'units', title: 'Units', rules: ['MH-007'] },
  { id: 'ean', title: 'EAN Matching', rules: ['MH-011', 'MH-012'] },
];

function summarize(results: ValidationResult[], rules: string[], stale: boolean): CheckStatus {
  const rs = results.filter((r) => rules.includes(r.ruleId));
  if (!rs.length) return 'PENDING';
  if (stale) return 'STALE';
  if (rs.some((r) => r.status === 'FAILED')) return 'FAILED';
  if (rs.some((r) => r.status === 'SKIPPED')) return 'SKIPPED';
  if (rs.some((r) => r.status === 'WARNING')) return 'WARNING';
  return 'PASSED';
}

/** Шесть блоков результата: одна строка — одно решение. */
export function CheckBlocks({ results, stale, metrics }: { results: ValidationResult[]; stale: boolean; metrics: Record<string, string> }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      {BLOCKS.map((b) => {
        const status = summarize(results, b.rules, stale);
        return (
          <a
            key={b.id}
            href={`#${b.id}`}
            data-block={b.id}
            data-block-status={status}
            className={cn('flex flex-col gap-2 rounded-lg border bg-surface p-4 transition-colors hover:border-border-strong', status === 'FAILED' ? 'border-status-blocked-border' : 'border-border')}
          >
            <span className="text-label uppercase text-text-secondary">{b.title}</span>
            <span className="tabular text-numeric-sm text-body font-bold">{metrics[b.id] ?? '—'}</span>
            <CheckStatusLabel status={status} />
          </a>
        );
      })}
    </div>
  );
}
