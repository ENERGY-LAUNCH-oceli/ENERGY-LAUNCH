import { Download, Printer, Share2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { STAGE_META, STAGE_STATUS_LABEL } from '@/config/stages';
import { CHECK_STATUS_LABEL } from '@/config/labels';
import { auditRecords, BLOCK_CATALOG, currentAcceptance, getRulesForStage, inputRef, objectReadiness, ROLE_TITLE } from '@/engine';
import { findObject } from '@/data/objects';
import { stageStats } from '@/features/launch-card';
import { useLaunchStore } from '@/store';
import { STAGE_IDS, type EnergyObjectType, type InputKind } from '@/types';
import { renderProtocolPdf } from '@/services/protocol-pdf';
import { cn } from '@/utils/cn';
import { downloadFile, safeFileName } from '@/utils/download';

const dt = (iso?: string | null) => (iso ? `${iso.slice(0, 10).split('-').reverse().join('.')} ${iso.slice(11, 16)} UTC` : '–');
const OBJECT_TYPE_LABEL: Record<EnergyObjectType, string> = {
  SOLAR_PV: 'Солнечная электростанция',
  WIND: 'Ветровая электростанция',
  BESS: 'Система накопления энергии',
  HYBRID: 'Гибридный энергетический объект',
  GAS_TURBINE: 'Газотурбинная электростанция',
  HYDRO: 'Гидроэлектростанция',
  SUBSTATION: 'Подстанция',
};

function H2({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mt-8 flex items-baseline gap-3 border-b border-border pb-2 text-h2 [break-after:avoid]">
      <span className="font-mono text-caption text-text-muted">{String(n).padStart(2, '0')}</span>
      {children}
    </h2>
  );
}

const T = ({ head, rows, mono }: { head: string[]; rows: React.ReactNode[][]; mono?: number[] }) => (
  <table className="protocol-table mt-3 w-full border-collapse text-caption">
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

/** Протокол готовности энергетического объекта формируется из текущего состояния приложения. */
export function ProtocolPage() {
  const session = useLaunchStore((s) => s.session);
  const inputs = useLaunchStore((s) => s.inputs);
  const ruleset = useLaunchStore((s) => s.ruleset);
  const audit = useLaunchStore((s) => s.auditLog);
  const manifest = useLaunchStore((s) => s.dataManifest);
  const [generatedAt] = React.useState(() => new Date().toISOString());
  const [busyAction, setBusyAction] = React.useState<'download' | 'share' | null>(null);
  const [feedback, setFeedback] = React.useState<{ message: string; type: 'error' | 'success' } | null>(null);
  if (!session || !inputs) return null;
  const p = inputs.passport;
  const entry = findObject(session.objectId);
  const sha = (_oid: string, file: string) => (entry?.folder ? manifest?.files.find((f) => f.path === `${entry.folder}/${file}`)?.sha256 : undefined);
  const readiness = objectReadiness(session, inputs, ruleset);
  const acc = currentAcceptance(inputs.dashboard, session.objectId);
  const records = auditRecords(audit, inputs.validationHistory ?? []);
  const confirmations = STAGE_IDS.flatMap((id) => session.stages[id].confirmations.map((confirmation) => [STAGE_META[id].titleRu, confirmation.requirementId, confirmation.role, confirmation.confirmedBy, dt(confirmation.confirmedAt), confirmation.staleSince ? `устарело ${dt(confirmation.staleSince)}` : 'актуально']));
  const passport = inputs.object.passport;
  const address = p?.address || passport.location.address || null;
  const stageSummaries = STAGE_IDS.map((id) => {
    const stage = session.stages[id];
    const stats = stageStats(session, id);
    return { id, stage, stats };
  });
  const checkTotals = stageSummaries.reduce(
    (total, { stats }) => ({ passed: total.passed + stats.passed, applicable: total.applicable + stats.applicable, failed: total.failed + stats.failed, warnings: total.warnings + stats.warnings }),
    { passed: 0, applicable: 0, failed: 0, warnings: 0 },
  );
  const reportSections = [
    'Общие сведения',
    'Основание и методика',
    'Итоговый статус',
    'Паспорт объекта и исходные данные',
    'Результаты этапов',
    'Результаты проверок',
    'Подтверждения и материалы',
    'Приёмка дашбордов',
    'История изменений',
    'Заключение',
  ];
  const fileName = `protocol-${safeFileName(inputs.object.name, 'object')}-${generatedAt.slice(0, 10)}.pdf`;

  const printProtocol = () => {
    const title = document.title;
    document.title = `Протокол готовности – ${inputs.object.name} – ${generatedAt.slice(0, 10)}`;
    window.print();
    document.title = title;
  };

  const createPdf = () => {
    const element = document.getElementById('protocol-document');
    if (!element) throw new Error('Не удалось найти документ протокола.');
    return renderProtocolPdf(element, fileName);
  };

  const downloadPdf = async () => {
    setBusyAction('download');
    setFeedback(null);
    try {
      downloadFile(fileName, await createPdf());
      setFeedback({ message: 'PDF скачан.', type: 'success' });
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : 'Не удалось скачать PDF.', type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const shareProtocol = async () => {
    setBusyAction('share');
    setFeedback(null);
    try {
      const title = `Протокол готовности – ${inputs.object.name}`;
      const text = `Протокол готовности энергетического объекта: ${inputs.object.name}`;
      if (navigator.share && navigator.canShare) {
        const blob = await createPdf();
        const file = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title, text });
          setFeedback({ message: 'PDF передан в меню «Поделиться».', type: 'success' });
          return;
        }
        await navigator.share({ title, text, url: window.location.href });
        setFeedback({ message: 'Отправлена ссылка на страницу протокола. PDF можно скачать отдельно.', type: 'success' });
      } else if (navigator.share) {
        await navigator.share({ title, text, url: window.location.href });
        setFeedback({ message: 'Отправлена ссылка на страницу протокола. PDF можно скачать отдельно.', type: 'success' });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        setFeedback({ message: 'Ссылка на страницу протокола скопирована. Скачайте PDF, чтобы прикрепить его к сообщению.', type: 'success' });
      } else {
        throw new Error('Этот браузер не поддерживает отправку или копирование ссылки. Скачайте PDF и прикрепите его к сообщению.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFeedback({ message: error instanceof Error ? error.message : 'Не удалось поделиться протоколом.', type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="max-w-2xl text-body-sm text-text-muted">Документ сформирован из текущего состояния объекта. Скачайте PDF, отправьте его или распечатайте.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={printProtocol} disabled={busyAction !== null}>
            <Printer aria-hidden />
            Печать
          </Button>
          <Button variant="secondary" onClick={() => void shareProtocol()} loading={busyAction === 'share'} disabled={busyAction !== null}>
            <Share2 aria-hidden />
            Поделиться
          </Button>
          <Button variant="accent" onClick={() => void downloadPdf()} loading={busyAction === 'download'} disabled={busyAction !== null}>
            <Download aria-hidden />
            Скачать PDF
          </Button>
        </div>
      </div>
      {feedback && (
        <p role={feedback.type === 'error' ? 'alert' : 'status'} className={cn('text-body-sm', feedback.type === 'error' ? 'text-error' : 'text-status-completed')}>
          {feedback.message}
        </p>
      )}

      <article id="protocol-document" className="protocol relative rounded-lg border border-border bg-surface px-6 py-8 shadow-xs sm:px-10 print:border-0 print:p-0 print:shadow-none" data-testid="protocol" data-ready={readiness.ready}>
        <section className="protocol-cover" aria-label="Титульный лист">
          <div>
            <p className="text-label text-text-muted">Energy Launch</p>
            <div className="mt-16 border-y-2 border-primary py-8">
              <p className="text-label text-text-muted">Технический отчёт</p>
              <h1 className="mt-4 text-h1 text-balance">Протокол готовности энергетического объекта</h1>
              <p className="mt-8 text-h2">{inputs.object.name}</p>
              <p className="mt-2 font-mono text-body-sm text-text-secondary">Идентификатор объекта: {session.objectId}</p>
            </div>
            {!readiness.ready && <p className="protocol-draft mt-6 border border-warning-border px-3 py-2 text-body-sm text-warning">Черновик. Готовность объекта не подтверждена.</p>}
            <T
              head={['Реквизит документа', 'Значение']}
              rows={[
                ['Номер протокола', session.id],
                ['Дата формирования', dt(generatedAt)],
                ['Дата завершения запуска', dt(session.completedAt)],
                ['Версия набора правил', `v${session.rulesetVersion}`],
                ['Адрес объекта', address ?? 'не указан'],
              ]}
            />
          </div>
          <div className="protocol-cover-bottom">
            <p className="text-body-sm font-medium">Содержание отчёта</p>
            <ol className="protocol-contents mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
              {reportSections.map((section, index) => (
                <li key={section} className="flex gap-2 text-caption">
                  <span className="font-mono text-text-muted">{String(index + 1).padStart(2, '0')}</span>
                  <span>{section}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 border-t border-border pt-2 text-caption text-text-muted">Сформирован автоматически из сохранённых данных объекта. Отчёт не содержит электронной подписи.</p>
          </div>
        </section>
        <div className="html2pdf__page-break" aria-hidden="true" />

        <header className="protocol-header border-b border-border pb-3 text-caption text-text-muted">
          <span>Технический отчёт · протокол {session.id}</span>
          <span className="float-right font-mono">v{session.rulesetVersion}</span>
        </header>

        {!readiness.ready && (
          <p className="protocol-draft mt-5 border border-warning-border px-3 py-2 text-body-sm text-warning">
            Черновик: запуск не завершён – готовность объекта не подтверждена. Результаты отражают состояние на дату формирования отчёта.
          </p>
        )}

        <H2 n={1}>Общие сведения</H2>
        <T
          head={['Показатель', 'Значение']}
          rows={[
            ['Объект', inputs.object.name],
            ['Идентификатор объекта', session.objectId],
            ['Тип объекта', OBJECT_TYPE_LABEL[inputs.object.type]],
            ['Владелец', passport.owner || 'не указан'],
            ['Оператор', passport.operator || 'не указан'],
            ['Местоположение', [passport.location.region, address].filter(Boolean).join(', ') || 'не указано'],
            ['Установленная мощность', `${passport.installedCapacityMw} МВт`],
            ['Сетевая организация', inputs.object.gridConnection.gridOperator || 'не указана'],
            ['Точка присоединения', inputs.object.gridConnection.pointOfConnection || 'не указана'],
            ['Номер протокола / сессии', session.id],
            ['Дата формирования', dt(generatedAt)],
            ['Версия правил оценки', `v${session.rulesetVersion}`],
          ]}
        />

        <H2 n={2}>Основание и методика</H2>
        <div className="protocol-prose mt-3 space-y-2 text-body-sm">
          <p>
            Цель отчёта – зафиксировать результаты оценки готовности объекта к эксплуатации по четырём этапам запуска. Основание оценки – паспорт объекта, сохранённые входные данные, результаты проверок, подтверждения участников, приёмка дашборда и журнал событий, перечисленные в настоящем отчёте.
          </p>
          <p>
            Проверки и итоговый статус рассчитаны конечным автоматом ENERGY LAUNCH по набору правил v{session.rulesetVersion}. Результаты воспроизводятся по сохранённым входным данным и версии правил; время событий указано в UTC.
          </p>
          <p>Оценка отражает правила данной системы; соответствие отдельному ГОСТу или внешнему нормативному документу не заявляется.</p>
          <p>
            Этап управления проверяется в имитационном контуре. Команды промышленному оборудованию не отправлялись; этот отчёт не подтверждает проведение испытаний на реальном оборудовании.
          </p>
        </div>
        <T
          head={['Сводный показатель проверок', 'Значение']}
          rows={[
            ['Пройдено', `${checkTotals.passed} из ${checkTotals.applicable}`],
            ['Ошибки', checkTotals.failed],
            ['Предупреждения', checkTotals.warnings],
            ['Период данных по паспорту', passport.declaredHistory ? `${passport.declaredHistory.from} – ${passport.declaredHistory.to}` : 'не указан'],
            ['Часовой пояс объекта', passport.timezone || 'не указан'],
          ]}
        />

        <H2 n={3}>Итоговый статус</H2>
        <div className="protocol-verdict mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-y border-border py-3">
          <span className="text-label text-text-muted">Заключение</span>
          <p className={cn('text-h3', readiness.ready ? 'text-status-completed' : 'text-status-blocked')}>{readiness.ready ? 'Объект готов к эксплуатации' : 'Готовность не присвоена'}</p>
        </div>
        <T head={['Условие', 'Выполнено']} rows={readiness.conditions.map((c) => [c.label, c.met ? 'да' : 'нет'])} />

        <H2 n={4}>Паспорт объекта и исходные данные</H2>
        {p ? (
          <>
            <T
              head={['Поле', 'Значение']}
              mono={[1]}
              rows={[
                ['Идентификатор объекта', p.objectId],
                ['Наименование', p.name],
                ['Адрес', p.address || 'не указан'],
                ['Координаты, широта / долгота', p.coordinates ? `${p.coordinates.lat}, ${p.coordinates.lon}` : 'не указаны'],
                ['Часовой пояс', p.timezone || 'не указан'],
                ['Файл паспорта', p.fileName],
                ['Источник паспорта', p.source === 'UPLOAD' ? 'Загружен' : 'Демонстрационные данные'],
                ['Паспорт загружен', dt(p.loadedAt)],
                ['Номер паспорта', passport.passportNumber || 'не указан'],
                ['Регион', passport.location.region || 'не указан'],
                ['Сетевая организация', inputs.object.gridConnection.gridOperator || 'не указана'],
                ['Точка присоединения', inputs.object.gridConnection.pointOfConnection || 'не указана'],
                ['Уровень напряжения, кВ', inputs.object.gridConnection.voltageLevelKv || 'не указан'],
                ['Установленная мощность, МВт', passport.installedCapacityMw || 'не указана'],
                ['Максимальная мощность присоединения, МВт', inputs.object.gridConnection.maxCapacityMw || 'не указана'],
                ['Файл расчётных данных', p.dataFiles.invoice || 'не указан'],
                ['Файл телеметрии', p.dataFiles.telemetry || 'не указан'],
                ['Формат CSV', `Разделитель «${p.csvFormat.delimiter}» · десятичный знак «${p.csvFormat.decimal}» · ${p.csvFormat.encoding} · шаг ${p.csvFormat.stepMinutes} мин`],
                ['Сигналы объекта', p.siteSignals.join(', ') || 'не указаны'],
                ['EAN потребления / генерации', `${p.ean.offtake || 'не указан'} / ${p.ean.injection || 'не указан'}`],
                ['Оборудование', p.assets.map((a) => `${a.assetId} (${a.type}, ${a.signals.length} сигналов)`).join(', ') || 'не указано'],
              ]}
            />
            <T head={['Входные данные', 'Версия', 'SHA-256']} mono={[0, 2]} rows={(['passport', 'invoice', 'telemetry'] as InputKind[]).map((k) => inputRef(k, inputs, sha)).map((r) => [r.label, `v${r.version}`, r.sha256 ?? '–'])} />
            {passport.documents.length > 0 && <T head={['Документ объекта', 'Реквизиты', 'Дата']} rows={passport.documents.map((document) => [document.title, document.reference, document.issuedAt ?? 'не указана'])} />}
          </>
        ) : (
          <p className="mt-3 text-body-sm">object.json не загружен.</p>
        )}

        <H2 n={5}>Результаты этапов</H2>
        <T
          head={['Этап', 'Статус', 'Пройдено / применимо', 'Ошибки / предупреждения', 'Временные отметки (UTC)']}
          rows={stageSummaries.map(({ id, stage, stats }) => [
            STAGE_META[id].titleRu,
            STAGE_STATUS_LABEL[stage.status],
            `${stats.passed} / ${stats.applicable}`,
            `${stats.failed} / ${stats.warnings}`,
            <span>
              Начат: {dt(stage.startedAt)}
              <br />
              Завершён: {dt(stage.completedAt)}
              <br />
              Проверка: {dt(stage.lastValidatedAt)}
            </span>,
          ])}
        />

        <H2 n={6}>Результаты проверок</H2>
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

        <H2 n={7}>Подтверждения и материалы</H2>
        {confirmations.length > 0 ? <T head={['Этап', 'Требование', 'Роль', 'Кто', 'Когда (UTC)', 'Актуальность']} mono={[1, 4]} rows={confirmations} /> : <p className="mt-3 text-body-sm">Подтверждения не зарегистрированы.</p>}
        {session.evidence.length > 0 ? (
          <T head={['Материал', 'Тип', 'Этап', 'Автор', 'Когда (UTC)']} mono={[4]} rows={session.evidence.map((e) => [e.title, e.type, STAGE_META[e.stageId].titleRu, e.createdBy, dt(e.createdAt)])} />
        ) : (
          <p className="mt-3 text-body-sm">Материалы к этапам не приложены.</p>
        )}
        {(inputs.controlCommands?.length ?? 0) > 0 ? (
          <T head={['Команда', 'Актив', 'Значение', 'Результат', 'Время (UTC)', 'Транспорт']} mono={[0, 4]} rows={inputs.controlCommands!.map((c) => [c.commandId, c.assetId, `${c.input.valueKw} кВт`, c.state, dt(c.createdAt), c.transport])} />
        ) : (
          <p className="mt-3 text-body-sm">Тестовые команды управления не выполнялись.</p>
        )}

        <H2 n={8}>Приёмка дашбордов</H2>
        {inputs.dashboard?.acceptances.length ? (
          <T
            head={['Версия', 'Результат', 'Автор', 'Роль', 'Время (UTC)', 'Объект', 'Блоки']}
            mono={[0, 4, 5]}
            rows={inputs.dashboard.acceptances.map((a) => [`v${a.configVersion}${a === acc ? ' (действующая)' : ''}`, a.result === 'ACCEPTED' ? 'принята' : 'отклонена', a.author, ROLE_TITLE[a.role], dt(a.at), a.objectId, a.blocks.map((b) => `${BLOCK_CATALOG[b.blockId].title}: ${b.correct ? 'корректен' : 'некорректен'}`).join('; ')])}
          />
        ) : (
          <p className="mt-3 text-body-sm">Приёмок не было.</p>
        )}

        <H2 n={9}>История изменений</H2>
        {records.length > 0 ? (
          <T head={['Время (UTC)', 'Кто', 'Действие / сущность', 'Изменение', 'Результат / правила']} mono={[0, 3, 4]} rows={records.map((r) => [r.timestamp.slice(0, 19).replace('T', ' '), r.actor, `${r.action} / ${r.entity}`, `${r.previousValue ?? '–'} → ${r.newValue ?? '–'}`, `${r.result} / v${r.ruleVersion}`])} />
        ) : (
          <p className="mt-3 text-body-sm">Записи аудита отсутствуют.</p>
        )}

        <H2 n={10}>Заключение</H2>
        <div className="protocol-prose mt-3 space-y-2 text-body-sm">
          <p>
            {readiness.ready
              ? `По результатам автоматических проверок и сохранённых подтверждений объект ${inputs.object.name} соответствует условиям готовности, установленным набором правил v${session.rulesetVersion}.`
              : `На дату формирования отчёта объект ${inputs.object.name} не подтверждён как готовый к эксплуатации. Не выполнены одно или несколько условий готовности; подробности приведены в разделах 3–9.`}
          </p>
          <p>
            Заключение распространяется только на перечисленные в отчёте данные и результаты системы. Испытания промышленного оборудования и его фактическая готовность данным протоколом не удостоверяются.
          </p>
        </div>
        <footer className="mt-8 border-t border-border pt-3 text-caption text-text-muted">
          Документ сформирован {dt(generatedAt)} · Протокол {session.id} · Версия правил v{session.rulesetVersion}. Электронная подпись отсутствует.
        </footer>
      </article>
    </div>
  );
}
