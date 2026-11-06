import { ChartNoAxesCombined, FileCheck2 } from 'lucide-react';
import type { CommandState, ControlTestCommand } from '@/types';
import { cn } from '@/utils/cn';
import { CommandStateBadge } from './CommandStateBadge';
import { ControlChart } from './ControlChart';
import { KIND_LABEL, SCENARIO_LABEL, STATE_HINT, STATE_LABEL, kw, secBetween, utcTime } from './labels';

const TRACK: CommandState[] = ['CREATED', 'SENT', 'RECEIVED', 'RESPONDED'];

/** Цепочка состояний: Created → Sent → Received → Responded → итог. Непройденные шаги – пустые. */
function StateTrack({ c }: { c: ControlTestCommand }) {
  const reached = new Map(c.history.map((h) => [h.state, h.at]));
  const steps = [...TRACK, c.state];
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Состояния команды">
      {steps.map((s, i) => {
        const at = reached.get(s);
        const final = i === steps.length - 1;
        const tone = !at ? 'bg-surface-sunken' : final ? (c.state === 'PASSED' ? 'bg-status-completed-solid' : c.state === 'TIMEOUT' ? 'bg-warning' : 'bg-status-blocked-solid') : 'bg-status-in-progress-solid';
        const dt = at ? secBetween(c.createdAt, at) : null;
        return (
          <li key={`${s}-${i}`} className="flex min-w-0 flex-col gap-1" data-step={s} data-reached={!!at}>
            <span className={cn('h-1 rounded-pill', tone)} />
            <span className={cn('truncate text-caption font-medium', at ? 'text-text-primary' : 'text-text-muted')}>{STATE_LABEL[s]}</span>
            <span className="truncate font-mono text-[11px] text-text-muted" title={STATE_HINT[s]}>{at ? `+${dt} с` : 'нет'}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className={cn('text-body-sm', mono && 'font-mono text-caption')}>{children}</dd>
    </div>
  );
}

/** Результат тестовой команды: все поля подтверждения, цепочка состояний, график. */
export function CommandDetail({ command: c }: { command: ControlTestCommand | undefined }) {
  if (!c) {
    return (
      <section className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-secondary/50 p-6 text-center">
        <ChartNoAxesCombined className="size-5 text-text-muted" aria-hidden />
        <span className="text-body-sm font-medium">Результат теста появится здесь</span>
        <span className="max-w-sm text-caption text-text-muted">Выберите актив, задайте команду и отправьте её в имитатор – здесь отобразятся статус, отклик и график.</span>
      </section>
    );
  }
  const ackSec = secBetween(c.sentAt, c.receivedAt);
  return (
    <section aria-labelledby="cmd-title" className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5" data-testid="command-detail" data-command={c.commandId}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="cmd-title" className="font-mono text-h3">{c.commandId}</h2>
          <span className="text-caption text-text-muted">
            {KIND_LABEL[c.kind]} · сценарий «{SCENARIO_LABEL[c.scenario].title}» · seed {c.seed}
          </span>
        </div>
        <CommandStateBadge state={c.state} className="text-body-sm" />
      </header>

      <StateTrack c={c} />

      <p className={cn('rounded-md border px-3 py-2 text-body-sm', c.state === 'PASSED' ? 'border-success-border bg-success-subtle' : c.state === 'TIMEOUT' ? 'border-warning-border bg-warning-subtle' : 'border-error-border bg-error-subtle')}>
        {c.reason}
      </p>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Row label="command_id" mono>{c.commandId}</Row>
        <Row label="asset_id" mono>{c.assetId}</Row>
        <Row label="timestamp" mono>{utcTime(c.createdAt)}</Row>
        <Row label="Отправленное значение" mono>{c.sentAt ? kw(c.input.valueKw) : `${kw(c.input.valueKw)} · не отправлено`}</Row>
        <Row label="Подтверждение (setpoint_received)" mono>{c.receivedAt ? `${kw(c.receivedValueKw)} · +${ackSec} с` : 'нет'}</Row>
        <Row label="Фактическая мощность" mono>{kw(c.actualKw, 2)}<span className="block text-text-muted">исходная {kw(c.input.baselineKw, 2)}</span></Row>
        <Row label="Ожидаемый интервал отклика" mono>
          приём ≤ {c.expected.ackTimeoutSec} с, отклик ≤ {c.expected.responseWindowSec} с
          <span className="block text-text-muted">{c.assetType === 'PV' ? `≤ ${c.expected.upperKw}` : `${c.expected.lowerKw} … ${c.expected.upperKw}`} кВт</span>
        </Row>
        <Row label="Итоговый результат">
          <CommandStateBadge state={c.state} />
          {c.responseSec !== null && <span className="block font-mono text-caption text-text-muted">отклик {c.responseSec} с после приёма</span>}
        </Row>
      </dl>

      <ControlChart command={c} />

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-caption text-text-muted">
        <span className="inline-flex items-center gap-1.5"><FileCheck2 className="size-3.5 text-accent-strong" aria-hidden />Подтверждение сохранено</span>
        <span>Транспорт: <span className="font-mono">{c.transport}</span></span>
        <span>Сигналы: <span className="font-mono">{[c.signals.sent, c.signals.received, c.signals.actual].filter(Boolean).join(' → ')}</span></span>
        <span>Правило {c.ruleId} · v{c.rulesetVersion}</span>
        <span>{c.actor}</span>
      </footer>
    </section>
  );
}
