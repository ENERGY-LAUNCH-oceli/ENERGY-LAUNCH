import { ACTIVE_RULESET } from '@/config/rules';
import { buildInvoiceDataset, buildTelemetryDataset, DEMO_OBJECT, demoPassport, type InvoiceGenOptions, type TelemetryGenOptions } from '@/data/mock';
import type { ObjectCatalogEntry } from '@/data/objects';
import { createDashboardWorkspace } from '@/engine/dashboards';
import { withCheckDigit } from '@/engine/invoice/format';
import type { LaunchInputs } from '@/types';

/** Параметры набора данных сценария. Каждый сценарий получает собственный объект и набор – без общих изменяемых данных. */
export interface SandboxSpec {
  n: number;
  name?: string;
  /** Текст адреса / описания объекта (например, внедрённая инструкция – сценарий 10). */
  street?: string;
  invoice?: Omit<InvoiceGenOptions, 'objectId'>;
  telemetry?: TelemetryGenOptions;
  /** object_id, которым помечен набор телеметрии (ошибка привязки к другому объекту – сценарий 8). */
  telemetryObjectId?: string;
  /** Имя файла выгрузки истории (может содержать текст – сценарий 10). */
  invoiceFileName?: string;
}

export const SANDBOX_AT = '2026-11-05T09:00:00.000Z';
export const sandboxId = (n: number) => `scenario-${String(n).padStart(2, '0')}`;

/** Песочница сценария: синтетический объект (PV1 + Battery1) с детерминированными данными (seed по умолчанию). */
export function sandboxEntry(spec: SandboxSpec): ObjectCatalogEntry {
  const id = sandboxId(spec.n);
  const ean = { offtake: withCheckDigit(`5414488000090${String(spec.n).padStart(2, '0')}01`), injection: withCheckDigit(`5414488000090${String(spec.n).padStart(2, '0')}02`) };
  const equipment = [
    { id: 'pv-1', type: 'pv' as const, prefix: 'PV1' },
    { id: 'battery-1', type: 'battery' as const, prefix: 'Battery1' },
  ];
  const name = spec.name ?? `Сценарий ${spec.n}`;
  const base = demoPassport({ objectId: id, name, street: spec.street ?? 'Rue Synthétique 1', postalCode: '1000', city: 'Брюссель', ean, assets: equipment });
  // Паспорт регистрирует фактическое имя файла выгрузки (data_files.invoice)
  const invoiceFile = spec.invoiceFileName ?? 'invoice.csv';
  const passport = { ...base, dataFiles: { ...base.dataFiles, invoice: invoiceFile } };
  const invoice = buildInvoiceDataset({ objectId: id, ...spec.invoice, ...(spec.invoiceFileName ? { fileName: spec.invoiceFileName } : {}) });
  const tel = buildTelemetryDataset(passport, spec.telemetry ?? {});
  const telemetry = spec.telemetryObjectId ? { ...tel, objectId: spec.telemetryObjectId } : tel;
  const inputs: LaunchInputs = {
    object: {
      ...DEMO_OBJECT,
      id,
      code: `SCN-${String(spec.n).padStart(2, '0')}`,
      name,
      passport: {
        ...DEMO_OBJECT.passport,
        objectId: id,
        dataFiles: { invoice: invoiceFile, telemetry: 'telemetry.csv' },
        timezone: 'Europe/Brussels',
        location: { region: 'Брюссель', address: `${spec.street ?? 'Rue Synthétique 1'}, 1000 Брюссель` },
      },
      gridConnection: { ...DEMO_OBJECT.gridConnection, objectId: id, eanOfftake: ean.offtake, eanInjection: ean.injection },
    },
    invoice: { ...invoice, objectId: id, id: `invoice-${id}-v1` },
    passport,
    telemetry,
    controlTests: [],
    controlCommands: [],
    dashboards: [],
    dashboard: createDashboardWorkspace(id, SANDBOX_AT, 'Инженер запуска'),
  };
  return {
    id,
    code: inputs.object.code,
    name,
    city: 'Брюссель',
    address: inputs.object.passport.location.address!,
    kind: 'Песочница сценария',
    assets: 'PV1 · Battery1',
    assetCount: 2,
    responsible: 'Инженер запуска',
    ean,
    scenarioId: id,
    equipment,
    seedUntil: 'METER_HISTORY',
    seedAt: SANDBOX_AT,
    source: 'SCENARIO',
    inputs,
  };
}

/** Набор правил сценариев – действующий; эталонных ответов здесь нет. */
export const SCENARIO_RULESET = ACTIVE_RULESET;
