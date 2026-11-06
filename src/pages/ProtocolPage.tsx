import { Download } from 'lucide-react';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { STAGE_META, STAGE_STATUS_LABEL } from '@/config/stages';
import { CHECK_STATUS_LABEL } from '@/config/labels';
import { auditRecords, BLOCK_CATALOG, currentAcceptance, getRulesForStage, inputRef, objectReadiness, ROLE_TITLE } from '@/engine';
import { findObject } from '@/data/objects';
import { stageStats } from '@/features/launch-card';
import { useLaunchStore } from '@/store';
import { STAGE_IDS, type InputKind } from '@/types';
import { cn } from '@/utils/cn';

const dt = (iso?: string | null) => (iso ? `${iso.slice(0, 10).split('-').reverse().join('.')} ${iso.slice(11, 16)} UTC` : '–');

function H2({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mt-8 flex items-baseline gap-3 border-b border-border pb-2 text-h2 [break-after:avoid]">
      <span className="font-mono text-caption text-text-muted">{String(n).padStart(2, '0')}</span>
      {children}
    </h2>
  );
}

const T = ({ head, rows, mono }: { head: string[]; rows: React.ReactNode[][]; mono?: number[] }) => (
  <table className="mt-3 w-full border-collapse text-caption">
    <thead>
      <tr className="border-b border-border text-left">
        {head.map((h) => (
          <th key={h} className="py-1.5 pr-3 font-mono text-[10px] font-normal uppercase tracking-[0.06em] text-text-muted">
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={i} className="border-b border-border align-top [break-inside:avoid]">
          {r.map((c, j) => (
            <td key={j} className={cn('py-1.5 pr-3', mono?.includes(j) && 'font-mono text-[11px]')}>
              {c}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

/** Протокол готовности энергетического объекта: формируется из состояния приложения, экспорт в PDF – печать браузера. */
export function ProtocolPage() {
  const session = useLaunchStore((s) => s.session);
  const inputs = useLaunchStore((s) => s.inputs);
  const ruleset = useLaunchStore((s) => s.ruleset);
  const audit = useLaunchStore((s) => s.auditLog);
  const manifest = useLaunchStore((s) => s.dataManifest);
  if (!session || !inputs) return null;
  const p = inputs.passport;
  const entry = findObject(session.objectId);
  const sha = (_oid: string, file: string) => (entry?.folder ? manifest?.files.find((f) => f.path === `${entry.folder}/${file}`)?.sha256 : undefined);
  const readiness = objectReadiness(session, inputs, ruleset);
  const acc = currentAcceptance(inputs.dashboard, session.objectId);
  const records = auditRecords(audit, inputs.validationHistory ?? []);
  const generatedAt = new Date().toISOString();

  const exportPdf = () => {
    const title = document.title;
    document.title = `Протокол готовности – ${inputs.object.name} – ${generatedAt.slice(0, 10)}`;
    window.print();
    document.title = title;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-body-sm text-text-muted">Документ формируется из текущего состояния объекта. Экспорт – печать в PDF (в диалоге выберите «Сохранить как PDF»).</p>
        <Button variant="accent" onClick={exportPdf}>
          <Download aria-hidden />
          Экспорт в PDF
        </Button>
      </div>

      <article className="protocol relative rounded-lg border border-border bg-surface px-6 py-8 sm:px-10 print:border-0 print:p-0" data-testid="protocol" data-ready={readiness.ready}>
        {!readiness.ready && (
          <p className="mb-6 rounded-md border border-warning-border bg-warning-subtle px-4 py-3 text-body-sm text-warning">
            Черновик: запуск не завершён – готовность объекта не объявлена. Протокол отражает текущее состояние.
          </p>
        )}
        <header className="flex flex-col gap-1">
          <span className="text-label text-text-muted">Energy Launch · протокол</span>
          <h1 className="text-h1">Протокол готовности энергетического объекта</h1>
          <p className="text-body-lg">
            {inputs.object.name} · <span className="font-mono">{session.objectId}</span>
          </p>
          <dl className="mt-3 grid gap-x-8 gap-y-1 text-caption sm:grid-cols-2">
            <div>
              <dt className="inline text-text-muted">Сформирован: </dt>
              <dd className="inline font-mono">{dt(generatedAt)}</dd>
            </div>
            <div>
              <dt className="inline text-text-muted">Версия правил: </dt>
              <dd className="inline font-mono">v{session.rulesetVersion}</dd>
            </div>
            <div>
              <dt className="inline text-text-muted">Сессия запуска: </dt>
              <dd className="inline font-mono">{session.id}</dd>
            </div>
            <div>
              <dt className="inline text-text-muted">Дата завершения: </dt>
              <dd className="inline font-mono">{dt(session.completedAt)}</dd>
            </div>
          </dl>
        </header>

        <H2 n={1}>Итоговый статус</H2>
        <p className={cn('mt-3 text-h3', readiness.ready ? 'text-status-completed' : 'text-status-blocked')}>{readiness.ready ? 'Объект готов к эксплуатации' : 'Готовность не присвоена'}</p>
        <T head={['Условие', 'Выполнено']} rows={readiness.conditions.map((c) => [c.label, c.met ? 'да' : 'нет'])} />

        <H2 n={2}>Паспорт объекта</H2>
        {p ? (
          <>
            <T
              head={['Поле', 'Значение']}
              mono={[1]}
              rows={[
                ['object_id', p.objectId],
                ['name', p.name],
                ['address', p.address ?? 'null'],
                ['coordinates', p.coordinates ? `${p.coordinates.lat}, ${p.coordinates.lon}` : 'null'],
                ['timezone', p.timezone],
                ['EAN offtake / injection', `${p.ean.offtake ?? 'null'} / ${p.ean.injection ?? 'null'}`],
                ['assets', p.assets.map((a) => `${a.assetId} (${a.type}, ${a.signals.length} сигн.)`).join(', ') || 'нет'],
              ]}
            />
            <T head={['Входные данные', 'Версия', 'SHA-256']} mono={[0, 2]} rows={(['passport', 'invoice', 'telemetry'] as InputKind[]).map((k) => inputRef(k, inputs, sha)).map((r) => [r.label, `v${r.version}`, r.sha256 ?? '–'])} />
          </>
        ) : (
          <p className="mt-3 text-body-sm">object.json не загружен.</p>
        )}

        <H2 n={3}>Результаты четырёх этапов</H2>
        <T
          head={['Этап', 'Статус', 'Начат', 'Завершён', 'Последняя проверка', 'Пройдено', 'Ошибки', 'Предупр.']}
          mono={[2, 3, 4]}
          rows={STAGE_IDS.map((id) => {
            const st = session.stages[id];
            const s = stageStats(session, id);
            return [STAGE_META[id].titleRu, STAGE_STATUS_LABEL[st.status], dt(st.startedAt), dt(st.completedAt), dt(st.lastValidatedAt), `${s.passed}/${s.applicable}`, s.failed, s.warnings];
          })}
        />

        <H2 n={4}>Список проверок</H2>
        {STAGE_IDS.map((id) => {
          const results = session.stages[id].validationResults;
          return (
            <section key={id} className="mt-4 [break-inside:avoid-page]">
              <h3 className="text-h3">{STAGE_META[id].titleRu}</h3>
              <T
                head={['Правило', 'Проверка', 'Результат', 'Сообщение', 'Время', 'Версия']}
                mono={[0, 4, 5]}
                rows={getRulesForStage(id, session.rulesetVersion).map((rule) => {
                  const r = results.find((x) => x.ruleId === rule.id);
                  return [rule.id, rule.title, r ? CHECK_STATUS_LABEL[r.status] : 'не выполнялась', r?.message ?? '–', dt(r?.evaluatedAt), r ? `v${r.rulesetVersion}` : '–'];
                })}
              />
            </section>
          );
        })}

        <H2 n={5}>Подтверждения</H2>
        <T
          head={['Этап', 'Требование', 'Роль', 'Кто', 'Когда', 'Актуальность']}
          mono={[1, 4]}
          rows={STAGE_IDS.flatMap((id) => session.stages[id].confirmations.map((c) => [STAGE_META[id].titleRu, c.requirementId, c.role, c.confirmedBy, dt(c.confirmedAt), c.staleSince ? `устарело ${dt(c.staleSince)}` : 'актуально']))}
        />
        <T head={['Материал', 'Тип', 'Этап', 'Автор', 'Когда']} mono={[4]} rows={session.evidence.map((e) => [e.title, e.type, STAGE_META[e.stageId].titleRu, e.createdBy, dt(e.createdAt)])} />
        {(inputs.controlCommands?.length ?? 0) > 0 && (
          <T head={['Команда', 'Актив', 'Значение', 'Результат', 'Время', 'Транспорт']} mono={[0, 4]} rows={inputs.controlCommands!.map((c) => [c.commandId, c.assetId, `${c.input.valueKw} кВт`, c.state, dt(c.createdAt), c.transport])} />
        )}

        <H2 n={6}>Приёмка дашбордов</H2>
        {inputs.dashboard?.acceptances.length ? (
          <T
            head={['Версия', 'Результат', 'Автор', 'Роль', 'Время', 'object_id', 'Блоки']}
            mono={[0, 4, 5]}
            rows={inputs.dashboard.acceptances.map((a) => [`v${a.configVersion}${a === acc ? ' (действующая)' : ''}`, a.result === 'ACCEPTED' ? 'принята' : 'отклонена', a.author, ROLE_TITLE[a.role], dt(a.at), a.objectId, a.blocks.map((b) => `${BLOCK_CATALOG[b.blockId].title}: ${b.correct ? 'корректен' : 'некорректен'}`).join('; ')])}
          />
        ) : (
          <p className="mt-3 text-body-sm">Приёмок не было.</p>
        )}

        <H2 n={7}>История изменений</H2>
        <T head={['Время (UTC)', 'Кто', 'Действие', 'Сущность', 'Было', 'Стало', 'Результат', 'Правила']} mono={[0, 2, 4, 5, 6, 7]} rows={records.map((r) => [r.timestamp.slice(0, 19).replace('T', ' '), r.actor, r.action, r.entity, r.previousValue ?? '–', r.newValue ?? '–', r.result, `v${r.ruleVersion}`])} />

        <footer className="mt-10 border-t border-border pt-4 text-caption text-text-muted">
          Статусы вычислены конечным автоматом по сохранённым входам и набору правил v{session.rulesetVersion}; каждое решение воспроизводится по журналу аудита и снимкам проверок. Управление выполнялось только через локальный имитатор.
        </footer>
      </article>
    </div>
  );
}
