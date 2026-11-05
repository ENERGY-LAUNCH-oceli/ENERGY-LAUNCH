import type { ValidationResultView } from '@/components/launch';
import { getRule, isKnownRule } from '@/engine';
import type { ValidationResult } from '@/types';

const LOCATION_KEYS = ['missing', 'missingTypes', 'missingSignals', 'missingSeries', 'commandIds', 'unpublished'] as const;

/** Доменный ValidationResult → модель отображения ValidationResult. */
export function toValidationView(r: ValidationResult, source?: string): ValidationResultView {
  const rule = isKnownRule(r.ruleId) ? getRule(r.ruleId) : undefined;
  const location = LOCATION_KEYS.flatMap((k) => {
    const v = r.details?.[k];
    return Array.isArray(v) ? v.map(String) : [];
  });
  return {
    ruleId: r.ruleId,
    title: rule?.title ?? r.ruleId,
    status: r.status,
    dimension: rule?.dimension ?? 'QUALITY',
    message: r.message,
    blocking: r.blocking,
    ...(r.actual !== undefined ? { actual: typeof r.actual === 'boolean' ? String(r.actual) : r.actual } : {}),
    ...(r.expected !== undefined ? { expected: typeof r.expected === 'boolean' ? String(r.expected) : r.expected } : {}),
    ...(location.length ? { location: location.slice(0, 12) } : {}),
    ...(source ? { source } : {}),
    evaluatedAt: r.evaluatedAt,
    rulesetVersion: r.rulesetVersion,
  };
}
