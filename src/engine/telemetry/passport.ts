import { z } from 'zod';
import type { ObjectJson, PassportAsset, PassportAssetType, RequiredSignal, SitePassport, TelemetryRules } from '@/types';

const nullableStr = z.string().nullable().optional().transform((v) => v ?? null);

/** Схема object.json (ТЗ 5.1). Неизвестные поля сохраняются как данные и не исполняются. */
export const objectJsonSchema = z
  .object({
    object_id: z.string().min(1),
    name: z.string().min(1),
    address: z.object({ street: nullableStr, postal_code: nullableStr, city: nullableStr, country: nullableStr }).nullable().optional().transform((v) => v ?? null),
    coordinates: z.object({ lat: z.number().nullable().optional().transform((v) => v ?? null), lon: z.number().nullable().optional().transform((v) => v ?? null) }).nullable().optional().transform((v) => v ?? null),
    timezone: z.string().min(1),
    grid_connection: z.object({ ean_offtake: nullableStr, ean_injection: nullableStr }),
    assets: z.array(z.object({ asset_id: z.string().min(1), type: z.string().min(1), signals: z.array(z.string()).default([]) })).default([]),
    site_signals: z.array(z.string()).default([]),
    data_files: z.object({ invoice: nullableStr, telemetry: nullableStr }),
    csv_format: z
      .object({ delimiter: z.string().optional(), separator: z.string().optional(), decimal: z.string().optional(), encoding: z.string().optional(), timestamp_format: z.string().optional(), timestamp: z.string().optional(), step_minutes: z.number().optional(), interval_minutes: z.number().optional() })
      .nullable()
      .optional(),
  })
  .passthrough();

export class PassportFormatError extends Error {}

const TYPE: Record<string, PassportAssetType> = { pv: 'PV', battery: 'BATTERY', bess: 'BATTERY' };

/** «PV1.power_kW (kW)» → имя «PV1.power_kW» и единица «kW» (в наборе кейса имена в паспорте записаны с единицей). */
export function splitSignal(raw: string): { name: string; unit: string | null } {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(raw.trim());
  return m ? { name: m[1]!, unit: m[2]! } : { name: raw.trim(), unit: null };
}

/** Префикс сигналов актива: общий первый сегмент его сигналов; иначе по номеру в asset_id. */
function assetPrefix(asset: { asset_id: string; type: string; signals: string[] }, type: PassportAssetType): string {
  const heads = new Set(asset.signals.map((s) => s.split('.')[0]!).filter(Boolean));
  if (heads.size === 1) return [...heads][0]!;
  const n = /(\d+)$/.exec(asset.asset_id)?.[1];
  return `${type === 'PV' ? 'PV' : 'Battery'}${n ?? ''}`;
}

/** Разбор и нормализация object.json. Тип актива не угадывается: неизвестный тип – замечание, а не актив. */
export function parseObjectJson(input: unknown, meta: { version: number; source: 'UPLOAD' | 'DEMO'; fileName: string; loadedAt: string }): SitePassport {
  const parsed = objectJsonSchema.safeParse(input);
  if (!parsed.success) {
    throw new PassportFormatError(`object.json не соответствует формату: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'корень'} – ${i.message}`).join('; ')}`);
  }
  const j = parsed.data as unknown as ObjectJson;
  const warnings: string[] = [];
  const assets: PassportAsset[] = [];
  const signalUnits: Record<string, string> = {};
  const norm = (list: string[]) =>
    list.map((raw) => {
      const { name, unit } = splitSignal(raw);
      if (unit) signalUnits[name] = unit;
      return name;
    });
  for (const raw of j.assets) {
    const a = { ...raw, signals: norm(raw.signals) };
    const type = TYPE[a.type.toLowerCase()];
    if (!type) {
      warnings.push(`Актив ${a.asset_id}: тип «${a.type}» не поддерживается (pv / battery) – актив не учитывается`);
      continue;
    }
    if (!a.signals.length) warnings.push(`Актив ${a.asset_id}: карта сигналов пуста`);
    assets.push({ assetId: a.asset_id, type, prefix: assetPrefix(a, type), signals: a.signals });
  }
  const addr = j.address;
  const address = addr ? [addr.street, addr.postal_code, addr.city, addr.country].filter(Boolean).join(', ') || null : null;
  const lat = j.coordinates?.lat;
  const lon = j.coordinates?.lon;
  return {
    ...meta,
    objectId: j.object_id,
    name: j.name,
    address,
    coordinates: typeof lat === 'number' && typeof lon === 'number' ? { lat, lon } : null,
    timezone: j.timezone,
    ean: { offtake: j.grid_connection.ean_offtake, injection: j.grid_connection.ean_injection },
    assets,
    siteSignals: norm(j.site_signals),
    signalUnits,
    dataFiles: { invoice: j.data_files.invoice, telemetry: j.data_files.telemetry },
    csvFormat: {
      delimiter: j.csv_format?.delimiter ?? j.csv_format?.separator ?? ';',
      decimal: j.csv_format?.decimal ?? ',',
      encoding: j.csv_format?.encoding ?? 'UTF-8-BOM',
      stepMinutes: j.csv_format?.step_minutes ?? j.csv_format?.interval_minutes ?? 15,
    },
    warnings,
  };
}

/** Агрегированный сигнал по объекту: `PV.power_kW.total`, `Battery.energy_kWh.total_charge`. */
export const isTotalSignal = (signal: string) => /(^|\.)total(_|\b|$)/.test(signal.split('.').slice(1).join('.'));

export function expectedUnit(signal: string): string {
  if (/SOC_%/.test(signal)) return '%';
  if (/energy_kWh/.test(signal)) return 'kWh';
  if (/power_kW/.test(signal)) return 'kW';
  return 'code';
}

/**
 * Обязательные сигналы из паспорта: Grid – всегда; PV и Battery – по каждому активу
 * с его префиксом (PV1, Battery2). Агрегаты total не подменяют сигналы оборудования.
 */
export function requiredSignals(passport: SitePassport, rules: TelemetryRules): RequiredSignal[] {
  const declared = new Set([...passport.siteSignals, ...passport.assets.flatMap((a) => a.signals)]);
  const out: RequiredSignal[] = rules.requiredGrid.map((signal) => ({ signal, scope: 'GRID', owner: 'GRID', assetType: 'GRID', unit: expectedUnit(signal), inPassport: declared.has(signal) }));
  for (const a of passport.assets) {
    const templates = a.type === 'PV' ? rules.requiredPv : rules.requiredBattery;
    for (const t of templates) {
      const signal = t.replace('{asset}', a.prefix);
      out.push({ signal, scope: 'ASSET', owner: a.assetId, assetType: a.type, unit: expectedUnit(signal), inPassport: a.signals.includes(signal) });
    }
  }
  return out;
}
