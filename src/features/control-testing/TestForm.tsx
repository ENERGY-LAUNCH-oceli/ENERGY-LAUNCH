import { FlaskConical, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { checkCommandValue, expectedBand, nextCommandAllowedAt, suggestedValue } from '@/engine/control';
import { SIM_SCENARIOS, type ControlAsset, type ControlTestCommand, type ControlTestingRules, type SimScenario } from '@/types';
import { cn } from '@/utils/cn';
import { KIND_LABEL, SCENARIO_LABEL } from './labels';

export interface TestFormProps {
  assets: ControlAsset[];
  rules: ControlTestingRules;
  disabledReason: string | null;
  /** Журнал команд – для паузы между командами одному активу (CT-017). */
  commands?: readonly ControlTestCommand[];
  onRun: (input: { assetId: string; valueKw: number; scenario: SimScenario }) => void;
}

/** Тестовая команда: актив, значение мощности, сценарий имитатора. */
export function TestForm({ assets, rules, disabledReason, commands = [], onRun }: TestFormProps) {
  const testable = assets.filter((a) => a.supported);
  const [assetId, setAssetId] = React.useState(testable[0]?.assetId ?? '');
  const [scenario, setScenario] = React.useState<SimScenario>('NOMINAL');
  const asset = testable.find((a) => a.assetId === assetId) ?? testable[0];
  const [value, setValue] = React.useState(() => (asset ? String(suggestedValue(asset, 'NOMINAL')) : ''));
  const allowedAt = asset ? nextCommandAllowedAt(commands, asset.assetId, rules) : null;
  const waitMs = allowedAt ? Date.parse(allowedAt) - Date.now() : 0;
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);
  // Пауза истекла – убрать подсказку
  React.useEffect(() => {
    if (waitMs <= 0) return;
    const t = setTimeout(rerender, waitMs + 50);
    return () => clearTimeout(t);
  }, [waitMs]);

  const pick = (nextAsset: ControlAsset | undefined, nextScenario: SimScenario) => {
    if (nextAsset) setValue(String(suggestedValue(nextAsset, nextScenario)));
  };

  if (!asset) {
    return (
      <section className="flex items-start gap-3 rounded-lg border border-border bg-surface-secondary p-4" aria-label="Тестирование недоступно">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 className="text-body-sm font-medium">Проверка управления недоступна</h2>
          <p className="text-caption text-text-secondary">В паспорте объекта нет активов с поддержкой управления. Добавьте оборудование в object.json, чтобы отправлять тестовые команды.</p>
        </div>
      </section>
    );
  }

  const valueKw = Number(value.replace(',', '.'));
  const invalid = value.trim() === '' ? 'Введите значение мощности' : checkCommandValue(asset, valueKw, rules);
  const band = Number.isFinite(valueKw) ? expectedBand(asset, valueKw, rules) : null;
  const range = asset.type === 'BATTERY' ? `−${asset.bench.ratedPowerKw} … +${asset.bench.ratedPowerKw} кВт` : `0 … ${Math.floor(asset.bench.currentPowerKw - rules.minStepKw)} кВт (ниже текущей выработки)`;

  return (
    <section aria-labelledby="test-form-title" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 id="test-form-title" className="text-h3">
          Тестовая команда
        </h2>
        <p className="flex items-start gap-1.5 text-caption text-text-muted">
          <ShieldCheck className="mt-px size-3.5 shrink-0 text-status-completed" aria-hidden />
          Команда уходит только в локальный имитатор контроллера. Реальное оборудование не управляется.
        </p>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (disabledReason || value.trim() === '') return;
          onRun({ assetId: asset.assetId, valueKw, scenario });
        }}
      >
        <Field label="Актив" htmlFor="ct-asset">
          <Select
            id="ct-asset"
            aria-label="Актив"
            value={asset.assetId}
            onValueChange={(v) => {
              setAssetId(v);
              pick(testable.find((a) => a.assetId === v), scenario);
            }}
            options={testable.map((a) => ({ value: a.assetId, label: `${a.assetId} · ${KIND_LABEL[a.kind]}`, description: `текущая ${a.bench.currentPowerKw} кВт · номинал ${a.bench.ratedPowerKw} кВт` }))}
          />
        </Field>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-body-sm font-medium">Сценарий имитатора</legend>
          <div className="grid gap-1.5" role="radiogroup" aria-label="Сценарий имитатора">
            {SIM_SCENARIOS.map((s) => (
              <label
                key={s}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 transition-colors',
                  scenario === s ? 'border-accent bg-accent-subtle' : 'border-border hover:border-border-strong',
                )}
              >
                <input
                  type="radio"
                  name="ct-scenario"
                  value={s}
                  checked={scenario === s}
                  onChange={() => {
                    setScenario(s);
                    pick(asset, s);
                  }}
                  className="mt-1 accent-[rgb(var(--el-accent))]"
                />
                <span className="flex flex-col">
                  <span className="text-body-sm font-medium">{SCENARIO_LABEL[s].title}</span>
                  <span className="text-caption text-text-muted">{SCENARIO_LABEL[s].hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={asset.type === 'BATTERY' ? 'Setpoint мощности' : 'Ограничение выработки'} htmlFor="ct-value" hint={`Допустимо: ${range}.${asset.type === 'BATTERY' ? ' Знак (ТЗ 4.2): + заряд, − разряд.' : ''}`}>
          <Input id="ct-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} trailing="кВт" aria-invalid={!!invalid || undefined} />
        </Field>

        {invalid ? (
          <p className="rounded-md border border-warning-border bg-warning-subtle px-3 py-2 text-caption text-warning" role="status">
            {invalid}. Команда будет отклонена до отправки и сохранится в журнале как Failed.
          </p>
        ) : (
          band && (
            <p className="text-caption text-text-muted">
              Ожидание: приём ≤ {rules.ackTimeoutSec} с, фактическая мощность {asset.type === 'PV' ? `≤ ${band.upperKw}` : `${band.lowerKw} … ${band.upperKw}`} кВт не позже {rules.responseWindowSec} с после приёма.
            </p>
          )
        )}

        {waitMs > 0 && (
          <p className="text-caption text-text-muted" role="status" data-testid="ct-interval-hint">
            Пауза между командами {asset.assetId}: следующую – не раньше {new Date(allowedAt!).toLocaleTimeString('ru-RU')} ({rules.minCommandIntervalSec} с после результата предыдущей). Раньше – предупреждение CT-017: отклик нельзя однозначно отнести к команде.
          </p>
        )}

        <Button type="submit" variant="accent" disabled={!!disabledReason || value.trim() === ''} title={disabledReason ?? undefined}>
          <FlaskConical aria-hidden />
          Отправить тестовую команду
        </Button>
        {disabledReason && <p className="text-caption text-text-muted">{disabledReason}</p>}
      </form>
    </section>
  );
}
