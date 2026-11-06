import { ACTIVE_RULESET } from '@/config/rules';
import { addMonths, anchoredWindow, InvoiceAnalyzer, monthStart } from '@/engine/invoice';
import type { InvoiceDataset, InvoiceField } from '@/types';
import { createRng } from '@/utils/random';

/** Параметры синтетической выгрузки invoice.csv (формат ТЗ 5). Все дефекты детерминированы seed. */
export interface InvoiceGenOptions {
  objectId: string;
  /** Последний месяц истории `YYYY-MM`. */
  endMonth?: string;
  months?: number;
  stepMinutes?: number;
  seed?: number;
  /** Сколько первых месяцев окна отсутствует (короткая история). */
  missingFirstMonths?: number;
  /** Пропуски: [начало ISO, число интервалов]. */
  gaps?: [string, number][];
  duplicates?: number;
  /** Блок строк, где энергия записана в Wh. */
  mixedUnitRows?: number;
  /** Строки с перевёрнутым знаком мощности. */
  signErrors?: number;
  emptyCells?: number;
  invalidTimestamps?: number;
  /** Заголовок с неверной единицей для поля. */
  wrongUnit?: { field: InvoiceField; unit: string };
  /** Колонки EAN в файле (если нужны). */
  ean?: { offtake: string; injection: string };
  fileName?: string;
}

const HEADER: [InvoiceField, string][] = [
  ['Grid.energy_kWh.offtake_invoice', 'kWh'],
  ['Grid.energy_kWh.offtake_invoice_validated', 'kWh'],
  ['Grid.energy_kWh.injection_invoice', 'kWh'],
  ['Grid.energy_kWh.injection_invoice_validated', 'kWh'],
  ['Grid.power_kW.invoice', 'kW'],
  ['Grid.power_kW.CA_offtake', 'kW'],
  ['Grid.power_kW.CA_injection', 'kW'],
];

const num = (v: number) => {
  const r = Math.round(v * 1000) / 1000;
  return String(r).replace('.', ',');
};

/** Заголовок и строки выгрузки (ленивая генерация – без хранения всего файла). */
export function* invoiceRows(o: InvoiceGenOptions): Generator<string[]> {
  const rng = createRng(o.seed ?? 42);
  const months = o.months ?? 24;
  const end = o.endMonth ?? '2026-10';
  // Окно активных правил (от точки проверки) – синтетика покрывает ровно его; иначе – календарные месяцы
  const mh = ACTIVE_RULESET.meterHistory;
  const anchor = !o.endMonth && mh.checkPoint ? anchoredWindow(mh.checkPoint, months, mh.timezone ?? 'UTC') : null;
  const startMonth = addMonths(end, -(months - 1) + (o.missingFirstMonths ?? 0));
  const from = anchor ? (anchor.segments[o.missingFirstMonths ?? 0]?.from ?? anchor.from) : monthStart(startMonth);
  const to = anchor ? anchor.to : monthStart(addMonths(end, 1));
  const step = (o.stepMinutes ?? 15) * 60_000;
  const gapSet = new Set<number>();
  for (const [iso, n] of o.gaps ?? []) for (let i = 0; i < n; i++) gapSet.add(Date.parse(iso) + i * step);

  yield [
    'timestamp (UTC)',
    ...HEADER.map(([f, u]) => `${f} (${o.wrongUnit?.field === f ? o.wrongUnit.unit : u})`),
    ...(o.ean ? ['EAN_offtake', 'EAN_injection'] : []),
  ];
  const total = Math.floor((to - from) / step);
  const pick = (count: number | undefined) => {
    const s = new Set<number>();
    while (s.size < (count ?? 0)) s.add(Math.floor(rng() * total));
    return s;
  };
  const dupIdx = pick(o.duplicates);
  const signIdx = pick(o.signErrors);
  const emptyIdx = pick(o.emptyCells);
  const badTsIdx = pick(o.invalidTimestamps);
  const mixedStart = o.mixedUnitRows ? Math.floor(total * 0.4) : -1;

  for (let i = 0; i < total; i++) {
    const t = from + i * step;
    if (gapSet.has(t)) continue;
    const d = new Date(t);
    const h = d.getUTCHours() + d.getUTCMinutes() / 60;
    const demand = 60 + 40 * Math.sin(((h - 6) / 24) * 2 * Math.PI) + rng() * 10;
    const pv = Math.max(0, Math.sin(((h - 5) / 14) * Math.PI)) * 140 * (0.7 + rng() * 0.3);
    let p = Math.round((demand - pv) * 100) / 100;
    const hours = step / 3_600_000;
    let off = Math.max(p, 0) * hours;
    const inj = Math.max(-p, 0) * hours;
    if (i >= mixedStart && i < mixedStart + (o.mixedUnitRows ?? 0) && p > 1) off *= 1000;
    if (signIdx.has(i) && Math.abs(p) > 1) p = -p;
    const cells = [
      badTsIdx.has(i) ? d.toISOString().replace('T', ' ').slice(0, 16) + ' CET' : d.toISOString().replace('.000Z', 'Z'),
      num(off),
      num(off),
      num(inj),
      num(inj),
      num(p),
      num(250),
      num(-200),
      ...(o.ean ? [o.ean.offtake, o.ean.injection] : []),
    ];
    // Пробел: пусты и исходное, и валидированное значение потребления
    if (emptyIdx.has(i)) cells[1] = cells[2] = '';
    yield cells;
    if (dupIdx.has(i)) yield [...cells];
  }
}

/** Текст CSV в формате ТЗ: UTF-8 BOM, «;», десятичная запятая. */
export function invoiceCsvText(o: InvoiceGenOptions): string {
  const lines: string[] = [];
  for (const row of invoiceRows(o)) lines.push(row.join(';'));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

const cache = new Map<string, InvoiceDataset>();

/**
 * Синтетическая выгрузка → отчёт тем же анализатором, что и загруженный файл.
 * Результат детерминирован, поэтому кэшируется по параметрам (демо-портфель собирается быстро).
 */
export function buildInvoiceDataset(o: InvoiceGenOptions, version = 1, importedAt = '2026-11-01T06:00:00.000Z'): InvoiceDataset {
  const key = JSON.stringify([o, version, importedAt]);
  const hit = cache.get(key);
  if (hit) return structuredClone(hit);
  const ds = buildUncached(o, version, importedAt);
  cache.set(key, ds);
  return structuredClone(ds);
}

function buildUncached(o: InvoiceGenOptions, version: number, importedAt: string): InvoiceDataset {
  const analyzer = new InvoiceAnalyzer(ACTIVE_RULESET.meterHistory);
  let line = 0;
  let size = 1;
  for (const row of invoiceRows(o)) {
    line++;
    size += row.join(';').length + 2;
    if (line === 1) analyzer.header(row);
    else analyzer.row(row, line);
  }
  const report = analyzer.finish({
    fileName: o.fileName ?? 'invoice.csv',
    sizeBytes: size,
    uploadedAt: importedAt,
    source: 'DEMO',
    format: { bom: true, delimiter: ';', decimal: ',', encoding: 'UTF-8' },
    rows: 0,
  });
  return {
    kind: 'INVOICE',
    id: `invoice-${o.objectId}-v${version}`,
    objectId: o.objectId,
    source: 'DEMO',
    fileName: report.meta.fileName,
    importedAt,
    periodStart: report.period.first ?? importedAt,
    periodEnd: report.period.last ?? importedAt,
    version,
    report,
  };
}
