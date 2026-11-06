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
  const normalized = s.replace(/[\s ]/g, '').replace(',', '.');
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(normalized)) return { kind: 'invalid', raw: s };
  const value = Number(normalized);
  return Number.isFinite(value) ? { kind: 'ok', value } : { kind: 'invalid', raw: s };
}

export type ParsedTimestamp =
  | { kind: 'invalid'; raw: string }
  | { kind: 'ok'; ms: number; utc: boolean; offsetMissing: boolean };

const ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** Строгий ISO 8601. Без смещения — неоднозначная зона; смещение ≠ 0 — не UTC. */
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

export const withCheckDigit = (body: string) => `${body}${gs1CheckDigit(body)}`;
