import { CONTROL_TESTING_TZ } from '@/config/rules/control';
import { controlAssets, executeControlTest, nextCommandId, suggestedValue } from '@/engine/control';
import { createSimulatorTransport } from '@/simulator/control';
import type { ControlTestCommand, SimScenario, SitePassport, TelemetryReport } from '@/types';

/** Шаг демо-программы тестов управления. */
export interface ControlPlanStep {
  assetId: string;
  scenario: SimScenario;
  valueKw?: number;
}

/**
 * Демо-журнал тестов управления: команды проходят тот же конвейер, что и из интерфейса
 * (проверка значения → имитатор → оценка). Время фиксировано – результат воспроизводим.
 */
export function buildControlCommands(o: { passport: SitePassport; report?: TelemetryReport; objectCode: string; plan: ControlPlanStep[]; startAt: string; actor: string; rulesetVersion?: string }): ControlTestCommand[] {
  const transport = createSimulatorTransport();
  const assets = controlAssets(o.passport, o.report, transport.describe);
  const out: ControlTestCommand[] = [];
  o.plan.forEach((step, i) => {
    const asset = assets.find((a) => a.assetId === step.assetId);
    if (!asset) return;
    out.push(
      executeControlTest(
        {
          objectId: o.passport.objectId,
          asset,
          valueKw: step.valueKw ?? suggestedValue(asset, step.scenario),
          scenario: step.scenario,
          commandId: nextCommandId(o.objectCode, out),
          createdAt: new Date(Date.parse(o.startAt) + i * 180_000).toISOString(),
          actor: o.actor,
          rulesetVersion: o.rulesetVersion ?? '1.3.0',
        },
        CONTROL_TESTING_TZ,
        transport,
      ),
    );
  });
  return out;
}
