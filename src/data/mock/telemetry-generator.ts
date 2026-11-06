import { ACTIVE_RULESET } from '@/config/rules';
import { expectedUnit, parseObjectJson, TelemetryAnalyzer } from '@/engine/telemetry';
import type { ObjectJson, SitePassport, TelemetryDatasetV2 } from '@/types';
import { createRng } from '@/utils/random';

/** Описание демо-объекта для object.json. Оборудование задаётся явно — ничего не выдумывается. */
export interface DemoPassportSpec {
  objectId: string;
  name: string;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
  ean: { offtake: string | null; injection: string | null };
  assets: { id: string; type: 'pv' | 'battery'; prefix: string }[];
  /** Сигналы, «забытые» в карте паспорта (неполная карта). */
  omitFromMap?: string[];
}

const PV_SIGNALS = ['power_kW', 'energy_kWh.production', 'power_kW.setpoint_received'];
const BAT_SIGNALS = ['power_kW', 'power_kW.setpoint_sent', 'power_kW.setpoint_received', 'setpoint_sent', 'energy_kWh.charge', 'energy_kWh.discharge', 'SOC_%'];

/** object.json в формате кейса (snake_case). */
export function demoObjectJson(spec: DemoPassportSpec): ObjectJson {
  const omit = new Set(spec.omitFromMap ?? []);
  const hasPv = spec.assets.some((a) => a.type === 'pv');
  const hasBat = spec.assets.some((a) => a.type === 'battery');
  return {
    object_id: spec.objectId,
    name: spec.name,
    address: { street: spec.street ?? null, postal_code: spec.postalCode ?? null, city: spec.city ?? null, country: 'BE' },
    coordinates: { lat: spec.lat ?? null, lon: spec.lon ?? null },
    timezone: 'Europe/Brussels',
    grid_connection: { ean_offtake: spec.ean.offtake, ean_injection: spec.ean.injection },
    assets: spec.assets.map((a) => ({
      asset_id: a.id,
      type: a.type,
      signals: (a.type === 'pv' ? PV_SIGNALS : BAT_SIGNALS).map((s) => `${a.prefix}.${s}`).filter((s) => !omit.has(s)),
    })),
    site_signals: [
      'Grid.power_kW',
      'Grid.energy_kWh.offtake',
      'Grid.energy_kWh.injection',
      'Demand.power_kW',
      'Demand.energy_kWh',
      ...(hasPv ? ['PV.power_kW.total', 'PV.energy_kWh.total_production'] : []),
      ...(hasBat ? ['Battery.energy_kWh.total_charge', 'Battery.energy_kWh.total_discharge'] : []),
    ],
    data_files: { invoice: 'invoice.csv', telemetry: 'telemetry.csv' },
    csv_format: { delimiter: ';', decimal: ',', encoding: 'UTF-8-BOM', timestamp_format: 'ISO 8601 UTC', step_minutes: 15 },
  };
}

export function demoPassport(spec: DemoPassportSpec, version = 1): SitePassport {
  return parseObjectJson(demoObjectJson(spec), { version, source: 'DEMO', fileName: 'object.json', loadedAt: '2026-11-01T06:00:00.000Z' });
}

/** Параметры синтетической telemetry.csv. Дефекты детерминированы seed. */
export interface TelemetryGenOptions {
  seed?: number;
  checkPoint?: string;
  hours?: number;
  /** Колонки отсутствуют в выгрузке. */
  dropSignals?: string[];
  /** Префиксы активов, у которых колонки есть, но значения пустые (нет связи). */
  silentAssets?: string[];
  /** Поток прерывается за N минут до точки проверки (все сигналы или указанные префиксы). */
  staleMinutes?: number;
  stalePrefixes?: string[];
  /** Переименование префикса — телеметрия другого актива (ошибочная привязка). */
  renamePrefix?: { from: string; to: string };
  /** Колонка object_id с этим значением. */
  objectIdInFile?: string;
  naiveTimestamps?: number;
  negativePv?: number;
  socOutOfRange?: number;
  batterySignErrors?: number;
  wrongUnit?: { signal: string; unit: string };
}

const num = (v: number) => String(Math.round(v * 1000) / 1000).replace('.', ',');

export function* telemetryRows(passport: SitePassport, o: TelemetryGenOptions): Generator<string[]> {
  const rng = createRng(o.seed ?? 21);
  const rules = ACTIVE_RULESET.telemetry;
  const step = rules.intervalMinutes * 60_000;
  const end = Date.parse(o.checkPoint ?? rules.checkPoint);
  const start = end - (o.hours ?? 52) * 3_600_000;
  const signals = [...passport.siteSignals, ...passport.assets.flatMap((a) => a.signals)];
  const drop = new Set(o.dropSignals ?? []);
  const cols = signals.filter((s) => !drop.has(s));
  const name = (s: string) => (o.renamePrefix && s.startsWith(`${o.renamePrefix.from}.`) ? s.replace(o.renamePrefix.from, o.renamePrefix.to) : s);
  yield ['timestamp (UTC)', ...(o.objectIdInFile ? ['object_id'] : []), ...cols.map((s) => `${name(s)} (${o.wrongUnit?.signal === s ? o.wrongUnit.unit : expectedUnit(s)})`)];

  const total = Math.floor((end - start) / step);
  const pick = (n?: number) => {
    const set = new Set<number>();
    while (set.size < (n ?? 0)) set.add(Math.floor(total * 0.5 + rng() * total * 0.45));
    return set;
  };
  const naive = pick(o.naiveTimestamps);
  const negPv = pick(o.negativePv);
  const socBad = pick(o.socOutOfRange);
  const batSign = pick(o.batterySignErrors);
  const soc: Record<string, number> = {};
  const silent = new Set(o.silentAssets ?? []);
  const hours = step / 3_600_000;

  for (let i = 0; i < total; i++) {
    const t = start + i * step;
    const d = new Date(t);
    const h = d.getUTCHours() + d.getUTCMinutes() / 60;
    const v: Record<string, number> = {};
    let pvTotal = 0;
    let batTotal = 0;
    for (const a of passport.assets) {
      if (a.type === 'PV') {
        const p = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI)) * 60 * (0.85 + rng() * 0.15);
        v[`${a.prefix}.power_kW`] = negPv.has(i) ? -5 : p;
        v[`${a.prefix}.energy_kWh.production`] = p * hours;
        v[`${a.prefix}.power_kW.setpoint_received`] = 80;
        pvTotal += p;
      } else {
        const sp = h >= 10 && h < 14 ? 20 : h >= 17 && h < 21 ? -20 : 0;
        soc[a.prefix] = Math.min(95, Math.max(10, (soc[a.prefix] ?? 50) + (sp * hours) / 2));
        const p = batSign.has(i) && sp !== 0 ? -sp : sp;
        v[`${a.prefix}.power_kW`] = p;
        v[`${a.prefix}.power_kW.setpoint_sent`] = sp;
        v[`${a.prefix}.power_kW.setpoint_received`] = sp;
        v[`${a.prefix}.setpoint_sent`] = sp === 0 ? 0 : 1;
        v[`${a.prefix}.energy_kWh.charge`] = Math.max(sp, 0) * hours;
        v[`${a.prefix}.energy_kWh.discharge`] = Math.max(-sp, 0) * hours;
        v[`${a.prefix}.SOC_%`] = socBad.has(i) ? 140 : soc[a.prefix]!;
        batTotal += sp;
      }
    }
    const demand = 45 + 25 * Math.sin(((h - 7) / 24) * 2 * Math.PI) + rng() * 5;
    const grid = demand - pvTotal + batTotal;
    Object.assign(v, {
      'Grid.power_kW': grid,
      'Grid.energy_kWh.offtake': Math.max(grid, 0) * hours,
      'Grid.energy_kWh.injection': Math.max(-grid, 0) * hours,
      'Demand.power_kW': demand,
      'Demand.energy_kWh': demand * hours,
      'PV.power_kW.total': pvTotal,
      'PV.energy_kWh.total_production': pvTotal * hours,
      'Battery.energy_kWh.total_charge': Math.max(batTotal, 0) * hours,
      'Battery.energy_kWh.total_discharge': Math.max(-batTotal, 0) * hours,
    });
    const stale = o.staleMinutes !== undefined && t >= end - o.staleMinutes * 60_000;
    const iso = naive.has(i) ? d.toISOString().slice(0, 19) : d.toISOString().replace('.000Z', 'Z');
    yield [
      iso,
      ...(o.objectIdInFile ? [o.objectIdInFile] : []),
      ...cols.map((s) => {
        const prefix = s.split('.')[0]!;
        if (silent.has(prefix)) return '';
        if (stale && (!o.stalePrefixes || o.stalePrefixes.includes(prefix))) return '';
        return v[s] === undefined ? '' : num(v[s]!);
      }),
    ];
  }
}

export function telemetryCsvText(passport: SitePassport, o: TelemetryGenOptions = {}): string {
  const lines: string[] = [];
  for (const r of telemetryRows(passport, o)) lines.push(r.join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}

const cache = new Map<string, TelemetryDatasetV2>();

/** Синтетическая telemetry.csv → отчёт тем же анализатором, что и загруженный файл (детерминировано, кэшируется). */
export function buildTelemetryDataset(passport: SitePassport, o: TelemetryGenOptions = {}, version = 1): TelemetryDatasetV2 {
  const key = JSON.stringify([passport, o, version]);
  const hit = cache.get(key);
  if (hit) return structuredClone(hit);
  const analyzer = new TelemetryAnalyzer(ACTIVE_RULESET.telemetry, passport, o.checkPoint);
  let line = 0;
  let size = 1;
  for (const row of telemetryRows(passport, o)) {
    line++;
    size += row.join(';').length + 2;
    if (line === 1) analyzer.header(row);
    else analyzer.row(row, line);
  }
  const report = analyzer.finish({ fileName: 'telemetry.csv', sizeBytes: size, uploadedAt: '2026-11-05T09:55:00.000Z', source: 'DEMO', rows: 0, format: { bom: true, delimiter: ';', decimal: ',', encoding: 'UTF-8' } });
  const ds: TelemetryDatasetV2 = { kind: 'TELEMETRY', id: `telemetry-${passport.objectId}-v${version}`, objectId: passport.objectId, version, report };
  cache.set(key, ds);
  return structuredClone(ds);
}
