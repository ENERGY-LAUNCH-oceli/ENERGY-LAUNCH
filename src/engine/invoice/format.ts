/** Разбор формата invoice.csv (ТЗ 5): «;», десятичная запятая, UTF-8 BOM, ISO 8601 UTC. */

export const BOM = '﻿';

/** «Grid.energy_kWh.offtake_invoice (kWh)» → { field, unit }. */
export function parseHeaderCell(cell: string): { field: string; unit: string | null } {
  const clean = cell.replace(BOM, '').trim();
  const m = /^(.+?)\s*\(([^)]*)\)\s*$/.exec(clean);
  return m ? { field: m[1]!.trim(), unit: m[2]!.trim() } : { field: clean, unit: null };
}

export type ParsedNumber = { kind: 'empty' } | { kind: 'invalid'; raw: string } | { kind: 'ok'; value: number };

/** Число с десятичной запятой; точка допускается только без запятой; пробелы-разделители тысяч удаляются. */
export function parseDecimal(raw: string | undefined): ParsedNumber {
  // Быстрый путь: число с запятой или точкой без пробелов и экспоненты
  if (raw) {
    const c = raw.charCodeAt(0);
    if ((c >= 48 && c <= 57) || c === 45) {
      const v = +raw.replace(',', '.');
      if (Number.isFinite(v) && raw.indexOf('x') < 0) return { kind: 'ok', value: v };
    }
  }
  const s = (raw ?? '').trim();
  if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'nan') return { kind: 'empty' };
  const normalized = s.replace(/[\s\u00A0]/g, '').replace(',', '.');
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(normalized)) return { kind: 'invalid', raw: s };
  const value = Number(normalized);
  return Number.isFinite(value) ? { kind: 'ok', value } : { kind: 'invalid', raw: s };
}

export type ParsedTimestamp =
  | { kind: 'invalid'; raw: string }
  | { kind: 'ok'; ms: number; utc: boolean; offsetMissing: boolean };

const ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** Строгий ISO 8601. Без смещения – неоднозначная зона; смещение ≠ 0 – не UTC. */
export function parseTimestamp(raw: string | undefined): ParsedTimestamp {
  // Быстрый путь: канонический вид YYYY-MM-DDTHH:MM:SSZ
  if (raw && raw.length === 20 && raw[10] === 'T' && raw[19] === 'Z' && raw[4] === '-' && raw[13] === ':') {
    const ms = Date.UTC(+raw.slice(0, 4), +raw.slice(5, 7) - 1, +raw.slice(8, 10), +raw.slice(11, 13), +raw.slice(14, 16), +raw.slice(17, 19));
    if (!Number.isNaN(ms)) return { kind: 'ok', ms, utc: true, offsetMissing: false };
  }
  const s = (raw ?? '').replace(BOM, '').trim();
  const m = ISO.exec(s);
  if (!m) return { kind: 'invalid', raw: s };
  const tz = m[7];
  const ms = Date.parse(tz ? s.replace(' ', 'T') : `${s.replace(' ', 'T')}Z`);
  if (Number.isNaN(ms)) return { kind: 'invalid', raw: s };
  const zero = !tz || tz === 'Z' || /^[+-]00:?00$/.test(tz);
  return { kind: 'ok', ms, utc: zero && !!tz, offsetMissing: !tz };
}

export const monthKey = (ms: number) => {
  const d = new Date(ms);
  const m = d.getUTCMonth() + 1;
  return `${d.getUTCFullYear()}-${m < 10 ? '0' : ''}${m}`;
};

export function monthStart(key: string): number {
  const [y, m] = key.split('-').map(Number) as [number, number];
  return Date.UTC(y, m - 1, 1);
}

export function addMonths(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Контрольная цифра GS1 (EAN-13/18): вес 3 и 1 справа налево. */
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += Number(body[body.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan(code: string | null | undefined, length: number): boolean {
  if (!code || !new RegExp(`^\\d{${length}}$`).test(code)) return false;
  return gs1CheckDigit(code.slice(0, -1)) === Number(code.at(-1));
}

/** Точная причина некорректного EAN (null – код корректен). */
export function eanProblem(code: string | null | undefined, length: number): string | null {
  if (!code) return 'не указан (null)';
  if (!/^\d+$/.test(code)) return `«${code}» содержит не только цифры`;
  if (code.length !== length) return `${code}: ${code.length} цифр вместо ${length}`;
  const expected = gs1CheckDigit(code.slice(0, -1));
  if (expected !== Number(code.at(-1))) return `${code}: контрольная цифра GS1 ${code.at(-1)}, ожидается ${expected}`;
  return null;
}

export const withCheckDigit = (body: string) => `${body}${gs1CheckDigit(body)}`;

/** Смещение часового пояса (местное − UTC), мс, в момент utcMs. */
export function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - utcMs;
}

/** UTC-момент местной полуночи даты (месяц 1–12; переполнение месяца допускается). */
export function localMidnightUtc(y: number, m: number, d: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - tzOffsetMs(guess, tz);
  return guess - tzOffsetMs(first, tz);
}

export interface HistorySegment {
  /** Местный календарный месяц `YYYY-MM`. */
  key: string;
  from: number;
  to: number;
}

export interface AnchoredWindow {
  from: number;
  to: number;
  segments: HistorySegment[];
}

/**
 * Окно истории, привязанное к точке проверки: N месяцев до местной полуночи дня точки проверки
 * (Europe/Brussels). Части календарных месяцев на краях окна – отдельные сегменты.
 */
export function anchoredWindow(checkPoint: string, periodMonths: number, tz: string): AnchoredWindow {
  const cp = Date.parse(checkPoint);
  const local = new Date(cp + tzOffsetMs(cp, tz));
  const [y, m, d] = [local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate()];
  const to = localMidnightUtc(y, m, d, tz);
  const from = localMidnightUtc(y, m - periodMonths, d, tz);
  const segments: HistorySegment[] = [];
  const startLocal = new Date(from + tzOffsetMs(from, tz));
  let [sy, sm] = [startLocal.getUTCFullYear(), startLocal.getUTCMonth() + 1];
  for (;;) {
    const ms = localMidnightUtc(sy, sm, 1, tz);
    const me = localMidnightUtc(sy, sm + 1, 1, tz);
    if (ms >= to) break;
    segments.push({ key: `${sy}-${String(sm).padStart(2, '0')}`, from: Math.max(ms, from), to: Math.min(me, to) });
    sm++;
    if (sm > 12) [sy, sm] = [sy + 1, 1];
  }
  return { from, to, segments };
}
