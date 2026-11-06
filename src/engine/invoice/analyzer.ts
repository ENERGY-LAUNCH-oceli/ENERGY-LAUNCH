import type {
  FieldReport,
  InvoiceFileMeta,
  InvoiceIssue,
  InvoiceIssueType,
  InvoiceReport,
  MeterHistoryRules,
  MonthCoverage,
  Severity,
} from '@/types';
import { addMonths, anchoredWindow, monthKey, monthStart, parseDecimal, parseHeaderCell, parseTimestamp, type AnchoredWindow } from './format';

const MAX_ISSUES = 5000;
const MIN = 60_000;

export const ISSUE_RULE: Record<InvoiceIssueType, { ruleId: string; severity: Severity }> = {
  MISSING_FIELD: { ruleId: 'MH-001', severity: 'CRITICAL' },
  MISSING_INTERVAL: { ruleId: 'MH-004', severity: 'CRITICAL' },
  DUPLICATE_TIMESTAMP: { ruleId: 'MH-005', severity: 'CRITICAL' },
  INVALID_TIMESTAMP: { ruleId: 'MH-006', severity: 'CRITICAL' },
  NON_UTC_TIMESTAMP: { ruleId: 'MH-006', severity: 'CRITICAL' },
  MISALIGNED_TIMESTAMP: { ruleId: 'MH-006', severity: 'CRITICAL' },
  UNIT_MISMATCH: { ruleId: 'MH-007', severity: 'CRITICAL' },
  MIXED_UNITS: { ruleId: 'MH-007', severity: 'CRITICAL' },
  NEGATIVE_VALUE: { ruleId: 'MH-008', severity: 'CRITICAL' },
  POSITIVE_VALUE: { ruleId: 'MH-008', severity: 'CRITICAL' },
  SIGN_ERROR: { ruleId: 'MH-008', severity: 'CRITICAL' },
  EMPTY_VALUE: { ruleId: 'MH-009', severity: 'CRITICAL' },
  INVALID_NUMBER: { ruleId: 'MH-009', severity: 'CRITICAL' },
  VALIDATED_DEVIATION: { ruleId: 'MH-010', severity: 'WARNING' },
};


interface Column {
  index: number;
  unit: string | null;
}

const OFF = 'Grid.energy_kWh.offtake_invoice';
const INJ = 'Grid.energy_kWh.injection_invoice';
const PWR = 'Grid.power_kW.invoice';

/**
 * Потоковый анализатор invoice.csv: получает строки по одной, хранит только агрегаты,
 * отметки времени (для пропусков) и ограниченный список проблем. Детерминирован.
 */
export class InvoiceAnalyzer {
  private columns = new Map<string, Column[]>();
  private tsIndex = 0;
  private eanCols: { offtake: number[]; injection: number[] } = { offtake: [], injection: [] };
  private times: number[] = [];
  private seen = new Set<number>();
  private monthPresent = new Map<string, number>();
  private monthDup = new Map<string, number>();
  private monthIssues = new Map<string, number>();
  /** Энергия по месяцам, kWh: потребление и выдача (для рабочей панели). */
  private monthEnergy = new Map<string, { off: number; inj: number }>();
  private fieldStats = new Map<string, FieldReport>();
  private issues: InvoiceIssue[] = [];
  private truncated = 0;
  private counts: Partial<Record<InvoiceIssueType, number>> = {};
  private eanValues = { offtake: new Set<string>(), injection: new Set<string>() };
  private rows = 0;
  private duplicates = 0;
  private invalidTs = 0;
  private headerSeen = false;
  private plan: { rule: MeterHistoryRules['fields'][number]; col: Column; stats: FieldReport }[] = [];

  /** Окно, привязанное к точке проверки (набор правил 1.5+); иначе – по месяцу последней метки. */
  private readonly anchor: AnchoredWindow | null;
  private outside = 0;
  private lagFrom: string | null = null;
  /** Согласованное правило обработки пустых значений (набор 1.5+). */
  private policy = { lagEmpty: 0, fallbackUsed: 0, infoEmpty: {} as Record<string, number> };
  private segIdx = 0;

  constructor(private readonly rules: MeterHistoryRules) {
    this.anchor = rules.checkPoint ? anchoredWindow(rules.checkPoint, rules.periodMonths, rules.timezone ?? 'UTC') : null;
  }

  /**
   * Согласованное правило (ТЗ 2.3 «обработаны по заранее согласованному правилу», набор 1.5+):
   * - энергия за интервал присутствует, если есть исходное ИЛИ валидированное значение;
   * - пустые значения в последние publicationLagDays до конца окна – задержка публикации, не пробел;
   * - пустые значения в полях infoOnlyEmptyFields (мощность, CA) – информация, не блокер.
   * Возвращает true, если пустое значение обработано правилом и не является проблемой.
   */
  private handleEmpty(field: string, cells: string[], ms: number): boolean {
    const r = this.rules;
    if (r.infoOnlyEmptyFields?.includes(field)) {
      this.policy.infoEmpty[field] = (this.policy.infoEmpty[field] ?? 0) + 1;
      return true;
    }
    const pair = r.valuePairs?.find((p) => p.includes(field));
    if (pair) {
      const other = pair[0] === field ? pair[1] : pair[0];
      const col = this.columns.get(other)?.[0];
      if (col && parseDecimal(cells[col.index]).kind === 'ok') {
        if (field === pair[1]) this.policy.fallbackUsed++;
        return true;
      }
    }
    if (this.anchor && r.publicationLagDays && ms >= this.anchor.to - r.publicationLagDays * 86_400_000) {
      this.policy.lagEmpty++;
      return true;
    }
    return false;
  }

  /** Ключ месяца для агрегатов: местный месяц сегмента окна или календарный месяц UTC. */
  private monthOf(ms: number): string {
    const a = this.anchor;
    if (!a) return monthKey(ms);
    const segs = a.segments;
    const cur = segs[this.segIdx];
    if (cur && ms >= cur.from && ms < cur.to) return cur.key;
    const i = segs.findIndex((s) => ms >= s.from && ms < s.to);
    if (i < 0) return `out:${monthKey(ms)}`;
    this.segIdx = i;
    return segs[i]!.key;
  }

  private issue(type: InvoiceIssueType, i: Omit<InvoiceIssue, 'type' | 'ruleId' | 'severity'>) {
    this.counts[type] = (this.counts[type] ?? 0) + 1;
    if (i.timestamp) {
      const k = this.monthOf(Date.parse(i.timestamp));
      this.monthIssues.set(k, (this.monthIssues.get(k) ?? 0) + 1);
    }
    if (this.issues.length >= MAX_ISSUES) {
      this.truncated++;
      return;
    }
    this.issues.push({ type, ...ISSUE_RULE[type], ...i });
  }

  header(cells: string[]): void {
    this.headerSeen = true;
    cells.forEach((cell, index) => {
      const { field, unit } = parseHeaderCell(cell);
      if (/^timestamp$/i.test(field)) this.tsIndex = index;
      else if (/ean/i.test(field)) (/inject/i.test(field) ? this.eanCols.injection : this.eanCols.offtake).push(index);
      else this.columns.set(field, [...(this.columns.get(field) ?? []), { index, unit }]);
    });
    for (const rule of this.rules.fields) {
      const cols = this.columns.get(rule.field) ?? [];
      this.fieldStats.set(rule.field, { field: rule.field, unit: cols[0]?.unit ?? null, expectedUnit: rule.unit, present: cols.length > 0, values: 0, empty: 0, invalid: 0, signViolations: 0, unitSuspect: 0, min: null, max: null });
      if (cols.length === 0 && rule.required) {
        this.issue('MISSING_FIELD', { timestamp: null, line: 1, field: rule.field, value: '–', expected: `Колонка «${rule.field} (${rule.unit})»`, explanation: 'Обязательное поле отсутствует в заголовке файла.', action: 'Запросить выгрузку с полным набором колонок invoice.csv' });
      }
      if (cols[0]) this.plan.push({ rule, col: cols[0], stats: this.fieldStats.get(rule.field)! });
      const units = new Set(cols.map((c) => c.unit ?? ''));
      if (units.size > 1) {
        this.issue('MIXED_UNITS', { timestamp: null, line: 1, field: rule.field, value: [...units].join(' / '), expected: rule.unit, explanation: 'Поле представлено несколькими колонками в разных единицах.', action: `Оставить одну колонку в ${rule.unit}` });
      } else if (cols.length && cols[0]!.unit !== rule.unit) {
        this.issue('UNIT_MISMATCH', { timestamp: null, line: 1, field: rule.field, value: cols[0]!.unit ?? 'не указана', expected: rule.unit, explanation: 'Единица в заголовке колонки не соответствует правилу.', action: `Запросить выгрузку поля в ${rule.unit}` });
      }
    }
  }

  row(cells: string[], line: number): void {
    if (!this.headerSeen) throw new Error('header() должен быть вызван до row()');
    if (cells.length === 1 && cells[0]!.trim() === '') return;
    this.rows++;
    const rawTs = cells[this.tsIndex];
    const ts = parseTimestamp(rawTs);
    if (ts.kind === 'invalid') {
      this.invalidTs++;
      this.issue('INVALID_TIMESTAMP', { timestamp: null, line, field: 'timestamp', value: ts.raw || '(пусто)', expected: 'ISO 8601 UTC, например 2025-01-31T23:45:00Z', explanation: 'Отметку времени невозможно разобрать – строка исключена из расчёта полноты.', action: 'Исправить формат времени в выгрузке' });
      return;
    }
    let isoCache: string | null = null;
    const isoOf = () => (isoCache ??= new Date(ts.ms).toISOString());
    if (!ts.utc) {
      this.invalidTs++;
      this.issue('NON_UTC_TIMESTAMP', { timestamp: isoOf(), line, field: 'timestamp', value: rawTs ?? '', expected: 'Смещение Z или +00:00', explanation: ts.offsetMissing ? 'Часовой пояс не указан – время неоднозначно.' : 'Время указано не в UTC; Europe/Brussels используется только для отображения.', action: 'Запросить выгрузку с временем в UTC' });
    }
    const step = this.rules.intervalMinutes * MIN;
    if (ts.ms % step !== 0) {
      this.issue('MISALIGNED_TIMESTAMP', { timestamp: isoOf(), line, field: 'timestamp', value: rawTs ?? '', expected: `Начало ${this.rules.intervalMinutes}-минутного интервала`, explanation: 'Метка не совпадает с началом интервала учёта.', action: 'Проверить настройку выгрузки интервалов' });
    }
    // Окно проверки: строки вне окна не анализируются (учитывается только их число)
    if (this.anchor && (ts.ms < this.anchor.from || ts.ms >= this.anchor.to)) {
      this.outside++;
      return;
    }
    const month = this.monthOf(ts.ms);
    if (this.seen.has(ts.ms)) {
      this.duplicates++;
      this.monthDup.set(month, (this.monthDup.get(month) ?? 0) + 1);
      this.issue('DUPLICATE_TIMESTAMP', { timestamp: isoOf(), line, field: 'timestamp', value: rawTs ?? '', expected: 'Одна запись на интервал', explanation: 'Повторная запись того же интервала: дубль не учитывается в полноте.', action: 'Удалить дубли или запросить исправленную выгрузку' });
      return;
    }
    this.seen.add(ts.ms);
    this.times.push(ts.ms);
    this.monthPresent.set(month, (this.monthPresent.get(month) ?? 0) + 1);

    const values: Record<string, number> = {};
    for (const { rule, col, stats } of this.plan) {
      const parsed = parseDecimal(cells[col.index]);
      if (parsed.kind === 'empty') {
        stats.empty++;
        if (this.handleEmpty(rule.field, cells, ts.ms)) continue;
        if (rule.required) this.issue('EMPTY_VALUE', { timestamp: isoOf(), line, field: rule.field, value: '(пусто)', expected: 'Числовое значение', explanation: 'Пустое значение в обязательном поле.', action: 'Получить значение за интервал или обработать пробел по согласованному правилу' });
        continue;
      }
      if (parsed.kind === 'invalid') {
        stats.invalid++;
        this.issue('INVALID_NUMBER', { timestamp: isoOf(), line, field: rule.field, value: parsed.raw, expected: 'Число с десятичной запятой', explanation: 'Значение не является числом.', action: 'Исправить значение в выгрузке' });
        continue;
      }
      const v = parsed.value;
      stats.values++;
      stats.min = stats.min === null ? v : Math.min(stats.min, v);
      stats.max = stats.max === null ? v : Math.max(stats.max, v);
      values[rule.field] = v;
      if (rule.sign === 'NON_NEGATIVE' && v < 0) {
        stats.signViolations++;
        this.issue('NEGATIVE_VALUE', { timestamp: isoOf(), line, field: rule.field, value: String(v), expected: '≥ 0', explanation: 'Энергия потребления и выдачи – отдельные неотрицательные величины (ТЗ 4.2).', action: 'Исправить знак значения в выгрузке' });
      }
      if (rule.sign === 'NON_POSITIVE' && v > 0) {
        stats.signViolations++;
        this.issue('POSITIVE_VALUE', { timestamp: isoOf(), line, field: rule.field, value: String(v), expected: '≤ 0', explanation: 'Ограничение выдачи в сеть записывается со знаком «−» (ТЗ 9).', action: 'Исправить знак договорного ограничения' });
      }
    }

    const me = this.monthEnergy.get(month) ?? { off: 0, inj: 0 };
    if (values[OFF] !== undefined) me.off += values[OFF];
    if (values[INJ] !== undefined) me.inj += values[INJ];
    this.monthEnergy.set(month, me);

    // Знак мощности: положительна при потреблении, отрицательна при выдаче (ТЗ 4.2)
    const p = values[PWR];
    const off = values[OFF];
    const inj = values[INJ];
    const eps = 0.5;
    if (p !== undefined && off !== undefined && inj !== undefined) {
      if ((p > eps && off <= 0 && inj > eps) || (p < -eps && inj <= 0 && off > eps)) {
        this.fieldStats.get(PWR)!.signViolations++;
        this.issue('SIGN_ERROR', { timestamp: isoOf(), line, field: PWR, value: String(p), expected: p > 0 ? '< 0 при выдаче в сеть' : '> 0 при потреблении', explanation: 'Знак мощности противоречит направлению энергии за интервал.', action: 'Проверить знак Grid.power_kW.invoice в выгрузке' });
      }
      // Смешанные единицы: E должна быть ≈ |P|·Δt/60; на порядки больше – вероятно Wh вместо kWh
      const hours = this.rules.intervalMinutes / 60;
      const [energyField, energy] = p > 1 ? [OFF, off] : p < -1 ? [INJ, inj] : [null, 0];
      if (energyField && Math.abs(p) * hours > 0.01 && energy / (Math.abs(p) * hours) > this.rules.unitRatioThreshold) {
        this.fieldStats.get(energyField)!.unitSuspect++;
        this.issue('MIXED_UNITS', { timestamp: isoOf(), line, field: energyField, value: String(energy), expected: `≈ ${(Math.abs(p) * hours).toFixed(2)} kWh (|P|·${this.rules.intervalMinutes}/60)`, explanation: 'Значение на порядки больше ожидаемого по мощности – вероятно, записано в Wh.', action: 'Запросить выгрузку в kWh за этот период' });
      }
    }
    for (const [raw, validated] of [
      [OFF, `${OFF}_validated`],
      [INJ, `${INJ}_validated`],
    ] as const) {
      const a = values[raw];
      const b = values[validated];
      if (a !== undefined && b !== undefined && Math.abs(a - b) / Math.max(Math.abs(a), 1) * 100 > this.rules.validatedTolerancePct) {
        this.issue('VALIDATED_DEVIATION', { timestamp: isoOf(), line, field: validated, value: `${a} → ${b}`, expected: `Расхождение ≤ ${this.rules.validatedTolerancePct} %`, explanation: 'Валидированное значение отличается от исходного: проверьте причину корректировки.', action: 'Сверить корректировку с поставщиком данных' });
      }
    }
    for (const k of ['offtake', 'injection'] as const) for (const i of this.eanCols[k]) if (cells[i]?.trim()) this.eanValues[k].add(cells[i]!.trim());
  }

  finish(meta: InvoiceFileMeta): InvoiceReport {
    const step = this.rules.intervalMinutes * MIN;
    const sorted = [...this.times].sort((a, b) => a - b);
    const deltas: number[] = [];
    for (let i = 1; i < sorted.length && deltas.length < 20_000; i++) deltas.push(sorted[i]! - sorted[i - 1]!);
    deltas.sort((a, b) => a - b);
    const detectedStepMinutes = deltas.length ? deltas[Math.floor(deltas.length / 2)]! / MIN : null;

    let window: InvoiceReport['window'] = null;
    let completeness = { expected: 0, present: 0, missing: 0, pct: 0 };
    const missingMonths: string[] = [];
    if (sorted.length || this.anchor) {
      const lastMonth = sorted.length ? monthKey(sorted.at(-1)!) : '1970-01';
      const firstMonth = addMonths(lastMonth, -(this.rules.periodMonths - 1));
      const segs = this.anchor?.segments ?? Array.from({ length: this.rules.periodMonths }, (_, i) => {
        const key = addMonths(firstMonth, i);
        return { key, from: monthStart(key), to: monthStart(addMonths(key, 1)) };
      });
      const from = this.anchor?.from ?? monthStart(firstMonth);
      const to = this.anchor?.to ?? monthStart(addMonths(lastMonth, 1));
      // Зона задержки публикации: последние N суток окна не считаются пробелом (согласованное правило)
      const lagStart = this.anchor && this.rules.publicationLagDays ? to - this.rules.publicationLagDays * 86_400_000 : to;
      const months: MonthCoverage[] = [];
      for (const seg of segs) {
        const key = seg.key;
        const expected = Math.max(0, (Math.min(seg.to, lagStart) - seg.from) / step);
        const present = this.monthPresent.get(key) ?? 0;
        const state = expected === 0 ? 'FULL' : present === 0 ? 'MISSING' : present >= expected ? 'FULL' : 'PARTIAL';
        if (state === 'MISSING') missingMonths.push(key);
        const e = this.monthEnergy.get(key);
        months.push({ month: key, expected, present: Math.min(present, expected), duplicates: this.monthDup.get(key) ?? 0, issues: this.monthIssues.get(key) ?? 0, state, offtakeKwh: e ? Math.round(e.off * 10) / 10 : 0, injectionKwh: e ? Math.round(e.inj * 10) / 10 : 0 });
      }
      window = { from: new Date(from).toISOString(), to: new Date(to).toISOString(), months, ...(this.rules.checkPoint ? { checkPoint: this.rules.checkPoint, timezone: this.rules.timezone ?? 'UTC' } : {}) };

      // Пропуски на сетке шага правил; исходная детализация не дополняется искусственно
      const expected = (lagStart - from) / step;
      const present = new Set(sorted.filter((t) => t >= from && t < lagStart && t % step === 0)).size;
      this.lagFrom = lagStart < to ? new Date(lagStart).toISOString() : null;
      completeness = { expected, present, missing: expected - present, pct: expected ? Math.floor((present / expected) * 10_000) / 100 : 0 };
      let cursor = from;
      const inWindow = sorted.filter((t) => t >= from && t < lagStart);
      const gaps: InvoiceIssue[] = [];
      const flushGap = (a: number, b: number) => {
        if (b <= a) return;
        const n = Math.round((b - a) / step);
        this.counts.MISSING_INTERVAL = (this.counts.MISSING_INTERVAL ?? 0) + 1;
        if (gaps.length >= 2000) return;
        gaps.push({
          type: 'MISSING_INTERVAL',
          ...ISSUE_RULE.MISSING_INTERVAL,
          timestamp: new Date(a).toISOString(),
          timestampTo: new Date(b).toISOString(),
          field: 'все поля',
          value: `${n} интервалов`,
          expected: `Непрерывный ряд с шагом ${this.rules.intervalMinutes} мин`,
          explanation: n >= 2000 ? 'Нет данных за длительный период – не хватает целых месяцев истории.' : 'Пропуск интервалов в официальных данных.',
          action: n >= 2000 ? 'Получить полную выгрузку за недостающие месяцы' : 'Получить выгрузку за интервал или обработать пробел по согласованному правилу',
        });
      };
      for (const t of inWindow) {
        if (t % step !== 0) continue;
        if (t > cursor) flushGap(cursor, t);
        cursor = t + step;
      }
      flushGap(cursor, lagStart);
      // Пропуски хранятся всегда: они важнее отдельных строковых ошибок
      this.issues = [...gaps, ...this.issues];
    }

    return {
      outsideWindow: this.outside,
      ...(this.rules.valuePairs || this.rules.publicationLagDays || this.rules.infoOnlyEmptyFields ? { valuePolicy: { ...this.policy, publicationLagDays: this.rules.publicationLagDays ?? 0, lagFrom: this.lagFrom } } : {}),
      meta: { ...meta, rows: this.rows },
      period: { first: sorted.length ? new Date(sorted[0]!).toISOString() : null, last: sorted.length ? new Date(sorted.at(-1)!).toISOString() : null },
      detectedStepMinutes,
      window,
      missingMonths,
      completeness,
      duplicates: this.duplicates,
      invalidTimestamps: this.invalidTs,
      fields: [...this.fieldStats.values()],
      fileEan: { offtake: [...this.eanValues.offtake], injection: [...this.eanValues.injection] },
      issueCounts: this.counts,
      issues: this.issues.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? '') || (a.line ?? 0) - (b.line ?? 0)),
      issuesTruncated: this.truncated,
    };
  }
}
