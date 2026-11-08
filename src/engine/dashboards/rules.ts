import type { DashboardConfigRules, DashboardBlockId, LaunchInputs, ValidationResult } from '@/types';
import { makeResult, type ValidatorEnv } from '../validators/helpers';
import { BLOCK_CATALOG } from './catalog';
import { configShapeErrors, currentAcceptance } from './config';
import { bindingIssues, blockProblems, evaluateBlocks } from './evaluate';

const BLOCK_RULE: Record<DashboardBlockId, 'DB-011' | 'DB-012' | 'DB-013' | 'DB-014'> = {
  METER_HISTORY: 'DB-011',
  ASSETS: 'DB-012',
  CONTROL: 'DB-013',
  QUALITY_STATUS: 'DB-014',
};

/**
 * Этап 4 (фаза 09): привязка к объекту, корректность четырёх обязательных блоков опубликованной версии,
 * публикация и приёмка ответственным. Некорректный блок или отказ в приёмке блокирует этап.
 */
export function validateDashboardConfig(inputs: LaunchInputs, rules: DashboardConfigRules, env: ValidatorEnv): ValidationResult[] {
  const ws = inputs.dashboard;
  const pub = ws?.published;
  const objectId = inputs.object.id;

  const binding = bindingIssues(pub ?? ws?.draft, inputs);
  const db10 = makeResult(
    'DB-010',
    !!ws && binding.length === 0,
    {
      message: !ws ? 'Панель объекта не создана' : binding.length ? `Смешивание данных объектов: ${binding.join('; ')}` : `Панель и все источники данных привязаны к ${objectId}`,
      details: { objectId, issues: binding },
    },
    env,
  );

  const blocks = pub ? evaluateBlocks(pub, inputs, rules) : null;
  const blockResults = (Object.keys(BLOCK_RULE) as DashboardBlockId[]).map((id) => {
    if (!blocks) return makeResult(BLOCK_RULE[id], 'SKIPPED', { message: 'Конфигурация панели не опубликована – блок не проверялся' }, env);
    const e = blocks[id];
    const problems = blockProblems(e);
    return makeResult(
      BLOCK_RULE[id],
      e.ok,
      {
        message: problems.length
          ? `«${BLOCK_CATALOG[id].title}»: ${problems.join('; ')}`
          : `«${BLOCK_CATALOG[id].title}» корректен${e.notApplicable.length ? ` (не применимо: ${e.notApplicable.join(', ')} – нет актива в паспорте)` : ''}`,
        details: { blockId: id, fields: e.missingWidgets, dataIssues: e.dataIssues, notApplicable: e.notApplicable, configVersion: pub!.version },
      },
      env,
    );
  });

  const shape = pub ? configShapeErrors(pub) : [];
  const db15 = makeResult(
    'DB-015',
    !!pub && shape.length === 0,
    {
      message: !pub ? 'Панель ещё не опубликована: во вкладке «Конструктор» нажмите «Опубликовать» – после этого ответственный сможет её принять' : shape.length ? `Конфигурация v${pub.version} некорректна: ${shape.join('; ')}` : `Опубликована версия v${pub.version} (${pub.publishedBy})`,
      ...(pub ? { actual: pub.version } : {}),
    },
    env,
  );

  const acc = currentAcceptance(ws, objectId);
  const lastAny = ws?.acceptances.filter((a) => a.objectId === objectId).at(-1);
  const db16 = !rules.requireAcceptance
    ? makeResult('DB-016', true, { message: 'Приёмка не требуется набором правил' }, env)
    : makeResult(
        'DB-016',
        acc?.result === 'ACCEPTED',
        {
          message: !pub
            ? 'Принимать пока нечего: сначала опубликуйте панель во вкладке «Конструктор»'
            : acc?.result === 'ACCEPTED'
              ? `Принята v${acc.configVersion}: ${acc.author}`
              : acc?.result === 'REJECTED'
                ? `Отклонена v${acc.configVersion}: ${acc.blocks.filter((b) => !b.correct).map((b) => `«${BLOCK_CATALOG[b.blockId].title}»${b.comment ? ` – ${b.comment}` : ''}`).join(', ') || acc.comment}`
                : lastAny
                  ? `Принята версия v${lastAny.configVersion}, а опубликована v${pub.version} – нужна повторная приёмка`
                  : `Версия v${pub.version} ожидает приёмки ответственным`,
          details: { configVersion: pub?.version ?? null, acceptanceId: acc?.id ?? null, blocks: acc?.blocks.filter((b) => !b.correct).map((b) => b.blockId) ?? [] },
        },
        env,
      );

  return [db10, ...blockResults, db15, db16];
}
