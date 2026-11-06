import { STAGE_IDS, type LaunchInputs, type LaunchSession, type RulesConfig, type StageId } from '@/types';
import { currentAcceptance } from './config';

const STAGE_TITLE: Record<StageId, string> = {
  METER_HISTORY: 'Этап 1 «История счётчиков» завершён',
  REALTIME_TELEMETRY: 'Этап 2 «Данные в реальном времени» завершён',
  ASSET_CONTROL: 'Этап 3 «Управление» завершён',
  FINAL_DASHBOARDS: 'Этап 4 «Финальные дашборды» завершён',
};

export interface ReadinessCondition {
  id: StageId | 'ACCEPTANCE' | 'CONFIRMATIONS';
  label: string;
  met: boolean;
}

export interface ObjectReadiness {
  ready: boolean;
  conditions: ReadinessCondition[];
  acceptedAt?: string;
  acceptedBy?: string;
  configVersion?: number;
}

/**
 * Итоговая готовность объекта: все четыре этапа завершены И рабочая панель принята ответственным
 * (действующая приёмка по опубликованной версии). Никаких других путей к статусу «готов».
 */
export function objectReadiness(session: LaunchSession | null | undefined, inputs: LaunchInputs | null | undefined, ruleset: Pick<RulesConfig, 'dashboardConfig'>): ObjectReadiness {
  const stages: ReadinessCondition[] = STAGE_IDS.map((id) => ({ id, label: STAGE_TITLE[id], met: session?.stages[id].status === 'COMPLETED' }));
  const legacy = !ruleset.dashboardConfig || !inputs?.dashboard;
  const acc = !legacy && session ? currentAcceptance(inputs!.dashboard, session.objectId) : undefined;
  const accepted = legacy ? session?.stages.FINAL_DASHBOARDS.status === 'COMPLETED' : acc?.result === 'ACCEPTED';
  // Подтверждения, устаревшие после изменения входов, снимают готовность до повторного подтверждения
  const stale = session ? STAGE_IDS.flatMap((id) => session.stages[id].confirmations.filter((c) => c.staleSince)) : [];
  const conditions = [
    ...stages,
    { id: 'ACCEPTANCE' as const, label: 'Дашборды приняты ответственным', met: !!accepted },
    { id: 'CONFIRMATIONS' as const, label: stale.length ? `Подтверждения актуальны (устарело: ${stale.length})` : 'Подтверждения актуальны', met: stale.length === 0 },
  ];
  return {
    ready: !!session && session.status === 'COMPLETED' && conditions.every((c) => c.met),
    conditions,
    ...(acc ? { acceptedAt: acc.at, acceptedBy: acc.author, configVersion: acc.configVersion } : {}),
  };
}
