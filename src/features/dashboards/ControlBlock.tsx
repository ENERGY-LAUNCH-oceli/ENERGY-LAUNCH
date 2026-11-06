import { StatusBadge } from '@/components/ui/status-badge';
import { CommandStateBadge, ControlChart, KIND_LABEL, kw } from '@/features/control-testing';
import type { DashboardBlockConfig } from '@/types';
import { formatDateTime } from '@/utils/format';
import { Widget } from './BlockFrame';
import type { DashboardData } from './data';

const LIMIT: Record<string, number> = { LAST_5: 5, LAST_10: 10, ALL: Infinity };

/** Блок 3. Управление: активы, последние команды, результаты тестов, подтверждения, состояние контура. */
export function ControlBlock({ block, data }: { block: DashboardBlockConfig; data: DashboardData }) {
  const w = block.widgets;
  const stage = data.session.stages.ASSET_CONTROL;
  const supported = data.assets.filter((a) => a.supported);
  const commands = [...data.commands]
    .reverse()
    .filter((c) => (block.filter === 'PASSED' ? c.state === 'PASSED' : block.filter === 'NOT_PASSED' ? c.state !== 'PASSED' : true))
    .slice(0, LIMIT[block.period] ?? 5);
  const evidence = data.session.evidence.filter((e) => e.stageId === 'ASSET_CONTROL' && e.type === 'COMMAND_LOG');
  const confirmed = stage.status === 'COMPLETED';
  const last = data.commands.at(-1);

  return (
    <>
      {w.loop_state && (
        <Widget title="Состояние контура управления" aside={<StatusBadge status={stage.status} size="sm" />}>
          <p className={confirmed ? 'text-body-sm font-medium text-status-completed' : 'text-body-sm text-text-secondary'}>
            {confirmed
              ? `Контур подтверждён: ${supported.length} активов приняли команды и откликнулись в ожидаемом интервале`
              : `Контур не подтверждён: пройдено ${supported.filter((a) => data.latest.get(a.assetId)?.state === 'PASSED').length} из ${supported.length} обязательных тестов`}
          </p>
          <p className="text-caption text-text-muted">Тестовый контур: локальный имитатор. Реальные команды не отправлялись.</p>
        </Widget>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {w.control_assets && (
          <Widget title="Управляемые активы">
            {data.assets.length === 0 ? (
              <p className="text-caption text-text-muted">Активы управления не указаны в паспорте объекта.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-body-sm">
                {data.assets.map((a) => (
                  <li key={a.assetId} className="flex items-baseline justify-between gap-2">
                    <span>
                      {a.assetId} <span className="text-caption text-text-muted">· {KIND_LABEL[a.kind]}</span>
                    </span>
                    {!a.supported && <span className="text-caption text-text-muted">н/п</span>}
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        )}
        {w.test_results && (
          <Widget title="Результаты тестов">
            {supported.length === 0 ? (
              <p className="text-caption text-text-muted">Нет активов для проверки.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {supported.map((a) => {
                  const c = data.latest.get(a.assetId);
                  return (
                    <li key={a.assetId} className="flex items-center justify-between gap-2 text-body-sm">
                      <span>{a.assetId}</span>
                      {c ? <CommandStateBadge state={c.state} /> : <span className="text-caption text-text-muted">не проводился</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Widget>
        )}
      </div>
      {w.last_commands && (
        <Widget title="Последние команды">
          {!commands.length ? (
            <p className="text-caption text-text-muted">Команд по выбранному фильтру нет.</p>
          ) : (
            <ul className="divide-y divide-border">
              {commands.map((c) => (
                <li key={c.commandId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1.5 text-caption">
                  <span className="font-mono">{c.commandId}</span>
                  <span className="text-text-secondary">
                    {c.assetId} · {kw(c.input.valueKw, 0)} · {formatDateTime(c.createdAt)}
                  </span>
                  <CommandStateBadge state={c.state} />
                </li>
              ))}
            </ul>
          )}
        </Widget>
      )}
      {w.confirmations && (
        <Widget title="Подтверждения">
          {stage.confirmations.length ? (
            <ul className="flex flex-col gap-1 text-caption">
              {stage.confirmations.map((c) => (
                <li key={c.id}>
                  <span className="font-mono">{c.requirementId}</span> · {c.confirmedBy} · {formatDateTime(c.confirmedAt)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-caption text-text-muted">Подтверждений этапа 3 нет.</p>
          )}
          <p className="text-caption text-text-muted">Журналов команд (COMMAND_LOG): {evidence.length}</p>
        </Widget>
      )}
      {w.response_chart && last && (block.metrics.includes('setpoint') || block.metrics.includes('actual')) && (
        <Widget title={`Отклик · ${last.commandId}`}>
          <ControlChart command={last} />
        </Widget>
      )}
    </>
  );
}
