import { Check, Copy, Download, LifeBuoy, PlayCircle, Wand2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/dialog';
import { passportToObjectJson } from '@/data/test-files';
import { startTour } from '@/features/tour/TourHost';
import { TOURS } from '@/features/tour/tours';
import { importPassport } from '@/services/telemetry-import';
import { notify, useLaunchStore } from '@/store';
import type { StageId } from '@/types';
import { cn } from '@/utils/cn';
import { downloadFile } from '@/utils/download';
import { controlAssets } from '@/engine/control';
import { createSimulatorTransport } from '@/simulator/control';
import { buildFixPlan, type FixOption } from './fix-plans';

/** Стенд имитатора – только описание активов (мощность, номинал) для подсказки значений команд. */
const bench = createSimulatorTransport();

/**
 * Кнопка «Помочь исправить» у следующего действия: данные объекта, вызвавшие проверку, варианты исправления
 * (паспорт – новой версией, данные – запросом источнику) и тур «Показать на сайте», как в «Как это работает».
 */
export function FixAssistant({ stageId, ruleId, variant = 'accent', size = 'md' }: { stageId: StageId; ruleId: string | undefined; variant?: 'accent' | 'secondary'; size?: 'md' | 'lg' }) {
  const session = useLaunchStore((s) => s.session);
  const passport = useLaunchStore((s) => s.inputs?.passport);
  const telemetry = useLaunchStore((s) => s.inputs?.telemetry?.report);
  const runControlTest = useLaunchStore((s) => s.runControlTest);
  const validateStage = useLaunchStore((s) => s.validateStage);
  const importToStore = useLaunchStore((s) => s.importPassport);
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const result = ruleId ? session?.stages[stageId].validationResults.find((r) => r.ruleId === ruleId) : undefined;
  const assets = stageId === 'ASSET_CONTROL' ? controlAssets(passport, telemetry, bench.describe) : [];
  const plan = buildFixPlan(result, passport, assets);
  const stage = session?.stages[stageId];
  const controlBlocked = stageId === 'ASSET_CONTROL' && stage?.status !== 'IN_PROGRESS' && stage?.status !== 'BLOCKED' ? 'Начните этап, чтобы отправлять тестовые команды' : null;
  if (!plan || !ruleId) return null;

  const corrected = (o: FixOption) => (passport && o.passport ? JSON.stringify(passportToObjectJson(o.passport(passport)), null, 2) : null);

  const apply = async (o: FixOption) => {
    if (o.control) {
      let ok = 0;
      for (const t of o.control) if (runControlTest({ assetId: t.assetId, valueKw: t.valueKw, scenario: 'NOMINAL' })?.state === 'PASSED') ok++;
      validateStage(stageId);
      notify({ tone: ok === o.control.length ? 'success' : 'warning', title: `Тесты управления: ${ok} из ${o.control.length} пройдены`, description: 'Команды отправлены в имитатор, проверки этапа повторены' });
      setOpen(false);
      return;
    }
    const text = corrected(o);
    if (!text) return;
    const next = await importPassport(text, { fileName: 'object.json' });
    importToStore(next);
    notify({ tone: 'success', title: 'Паспорт исправлен', description: `${o.title}. Прежняя версия – в истории, проверки этапа запущены заново.` });
    setOpen(false);
  };

  const download = (o: FixOption) => {
    const text = corrected(o);
    if (text) downloadFile('object.json', text, 'application/json');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plan.request ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify({ tone: 'warning', title: 'Не удалось скопировать', description: 'Выделите текст запроса и скопируйте вручную' });
    }
  };

  const showOnSite = () => {
    const id = `fix-${ruleId}`;
    TOURS[id] = { id, title: `Как исправить: ${plan.title}`, steps: plan.tour };
    setOpen(false);
    // Дать панели закрыться, затем тур
    setTimeout(() => startTour(id), 150);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={`Как исправить: ${plan.title}`}
      description={`${ruleId} · ${plan.summary}`}
      trigger={
        <Button variant={variant} size={size} data-testid="fix-assistant">
          <LifeBuoy aria-hidden />
          Помочь исправить
        </Button>
      }
      footer={
        <Button variant="secondary" onClick={showOnSite}>
          <PlayCircle aria-hidden />
          Показать на сайте
        </Button>
      }
    >
      <div className="flex flex-col gap-6" data-testid="fix-plan">
        <section className="flex flex-col gap-2">
          <h3 className="text-label text-text-muted">Данные объекта</h3>
          <dl className="flex flex-col divide-y divide-border rounded-md border border-border">
            {plan.facts.map((f, i) => (
              <div key={i} className="flex flex-col gap-0.5 px-3 py-2">
                <dt className="text-caption text-text-muted">{f.label}</dt>
                <dd className={cn('break-words font-mono text-body-sm', f.tone === 'bad' ? 'text-error' : f.tone === 'ok' ? 'text-success' : 'text-text-primary')}>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {plan.options.length > 0 && (
          <section className="flex flex-col gap-3">
            <h3 className="text-label text-text-muted">{plan.options.some((o) => o.control) ? 'Исправить' : 'Исправить в паспорте'}</h3>
            {plan.options.map((o) => (
              <div key={o.id} className="flex flex-col gap-2 rounded-md border border-border p-3" data-testid={`fix-option-${o.id}`}>
                <p className="text-body-sm font-medium">{o.title}</p>
                {o.change && (
                  <p className="flex flex-wrap items-center gap-2 font-mono text-caption">
                    <span className="rounded-sm bg-error-subtle px-1.5 py-0.5 text-error line-through">{o.change.from}</span>→<span className="rounded-sm bg-success-subtle px-1.5 py-0.5 text-success">{o.change.to}</span>
                  </p>
                )}
                <p className="text-caption text-text-secondary">{o.text}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="accent" onClick={() => void apply(o)} data-testid="fix-apply" disabled={!!(o.control && controlBlocked)}>
                    <Wand2 aria-hidden />
                    {o.control ? 'Отправить тесты' : 'Применить'}
                  </Button>
                  {!o.control && (
                    <Button size="sm" variant="secondary" onClick={() => download(o)}>
                      <Download aria-hidden />
                      Скачать object.json
                    </Button>
                  )}
                </div>
                {o.control && controlBlocked && <p className="text-caption text-warning">{controlBlocked}</p>}
              </div>
            ))}
            {!plan.options.some((o) => o.control) && <p className="text-caption text-text-muted">Применение создаёт новую версию паспорта: прежняя остаётся в истории, изменение записывается в журнал от вашего имени.</p>}
          </section>
        )}

        {plan.request && (
          <section className="flex flex-col gap-2">
            <h3 className="text-label text-text-muted">Запрос поставщику данных</h3>
            <p className="text-caption text-text-secondary">Данные счётчиков и телеметрии приложение не правит: исправленный файл присылает источник. Текст запроса уже содержит найденные интервалы и значения.</p>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface-secondary p-3 font-mono text-caption text-text-secondary">{plan.request}</pre>
            <Button size="sm" variant="secondary" className="self-start" onClick={() => void copy()}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? 'Скопировано' : 'Скопировать запрос'}
            </Button>
          </section>
        )}
      </div>
    </Drawer>
  );
}
