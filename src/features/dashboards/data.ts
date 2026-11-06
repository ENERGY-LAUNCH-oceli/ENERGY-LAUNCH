import { useMemo } from 'react';
import { controlAssets, latestByAsset, openBlockers } from '@/engine';
import { stageStats, type StageStats } from '@/features/launch-card';
import { createSimulatorTransport } from '@/simulator/control';
import { useLaunchStore } from '@/store';
import { STAGE_IDS, type AuditEvent, type Blocker, type ControlAsset, type ControlTestCommand, type InvoiceReport, type LaunchInputs, type LaunchSession, type SitePassport, type StageId, type TelemetryReport } from '@/types';

const transport = createSimulatorTransport();

/** Данные рабочей панели – только текущего объекта приложения (без смешивания объектов). */
export interface DashboardData {
  objectId: string;
  objectCode: string;
  objectName: string;
  session: LaunchSession;
  invoice: InvoiceReport | undefined;
  telemetry: TelemetryReport | undefined;
  passport: SitePassport | undefined;
  assets: ControlAsset[];
  commands: ControlTestCommand[];
  latest: Map<string, ControlTestCommand>;
  blockers: Blocker[];
  stats: Record<StageId, StageStats>;
  audit: AuditEvent[];
}

export function buildDashboardData(session: LaunchSession, inputs: LaunchInputs, audit: AuditEvent[]): DashboardData {
  const objectId = session.objectId;
  // Источники другого объекта не попадают в панель (DB-010 фиксирует нарушение отдельно)
  const own = <T extends { objectId: string }>(x: T | undefined) => (x && x.objectId === objectId ? x : undefined);
  const commands = (inputs.controlCommands ?? []).filter((c) => c.objectId === objectId);
  const passport = own(inputs.passport);
  const telemetry = own(inputs.telemetry)?.report;
  return {
    objectId,
    objectCode: inputs.object.code,
    objectName: inputs.object.name,
    session,
    invoice: own(inputs.invoice)?.report,
    telemetry,
    passport,
    assets: controlAssets(passport, telemetry, transport.describe),
    commands,
    latest: latestByAsset(commands),
    blockers: STAGE_IDS.flatMap((id) => openBlockers(session, id)),
    stats: Object.fromEntries(STAGE_IDS.map((id) => [id, stageStats(session, id)])) as Record<StageId, StageStats>,
    audit: audit.filter((e) => !e.objectId || e.objectId === objectId),
  };
}

export function useDashboardData(): DashboardData | null {
  const session = useLaunchStore((s) => s.session);
  const inputs = useLaunchStore((s) => s.inputs);
  const audit = useLaunchStore((s) => s.auditLog);
  return useMemo(() => (session && inputs ? buildDashboardData(session, inputs, audit) : null), [session, inputs, audit]);
}

export const num = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? '–' : v.toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits }));
export const mwh = (kwh: number) => `${(kwh / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} МВт·ч`;
