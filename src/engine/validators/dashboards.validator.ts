import type { AssetSignal, Dashboard, DashboardRules, ValidationResult } from '@/types';
import { makeResult, type ValidatorEnv } from './helpers';

/** Этап 4: приёмка итоговых панелей мониторинга. */
export function validateDashboards(
  dashboards: readonly Dashboard[],
  signals: readonly AssetSignal[],
  rules: DashboardRules,
  env: ValidatorEnv,
): ValidationResult[] {
  const blocks = dashboards.flatMap((d) => d.blocks);
  const signalById = new Map(signals.map((s) => [s.id, s]));

  const presentTypes = new Set(blocks.map((b) => b.type));
  const missingTypes = rules.requiredBlockTypes.filter((t) => !presentTypes.has(t));
  const blockTypes = makeResult(
    'DB-001',
    dashboards.length > 0 && missingTypes.length === 0,
    {
      message:
        dashboards.length === 0
          ? 'Панели не созданы'
          : missingTypes.length
            ? `Отсутствуют блоки: ${missingTypes.join(', ')}`
            : 'Все обязательные блоки присутствуют',
      details: { missingTypes },
    },
    env,
  );

  // Покрытие учитывает только реально привязанные существующие сигналы
  const boundKinds = new Set(
    blocks.flatMap((b) => b.signalIds.map((id) => signalById.get(id)?.kind)).filter((k) => k !== undefined),
  );
  const missingSignals = rules.requiredSignals.filter((k) => !boundKinds.has(k));
  const signalCoverage = makeResult(
    'DB-002',
    missingSignals.length === 0,
    {
      message: missingSignals.length ? `Не выведены сигналы: ${missingSignals.join(', ')}` : 'Все обязательные сигналы выведены',
      actual: rules.requiredSignals.length - missingSignals.length,
      expected: rules.requiredSignals.length,
      details: { missingSignals },
    },
    env,
  );

  const broken = blocks.flatMap((b) => b.signalIds.filter((id) => !signalById.has(id)).map((signalId) => ({ blockId: b.id, signalId })));
  const integrity = makeResult(
    'DB-003',
    broken.length === 0,
    {
      message: broken.length ? `Битых привязок: ${broken.length}` : 'Все привязки корректны',
      actual: broken.length,
      expected: 0,
      details: { broken },
    },
    env,
  );

  const unpublished = dashboards.filter((d) => !d.publishedAt).map((d) => d.id);
  const published = rules.requirePublished
    ? makeResult(
        'DB-004',
        dashboards.length > 0 && unpublished.length === 0,
        {
          message: unpublished.length ? `Не опубликовано панелей: ${unpublished.length}` : 'Все панели опубликованы',
          details: { unpublished },
        },
        env,
      )
    : makeResult('DB-004', true, { message: 'Публикация не требуется конфигурацией' }, env);

  return [blockTypes, signalCoverage, integrity, published];
}
