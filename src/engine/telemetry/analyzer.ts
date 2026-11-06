import type {
  HeatState,
  SignalDiagnosis,
  SignalReport,
  SitePassport,
  TelemetryIssue,
  TelemetryIssueType,
  TelemetryReport,
  TelemetryRules,
  Severity,
} from '@/types';
import { parseDecimal, parseHeaderCell, parseTimestamp } from '../invoice/format';
import { expectedUnit, isTotalSignal, requiredSignals } from './passport';

const MAX_ISSUES = 3000;
const MIN = 60_000;

export const TM_ISSUE: Record<TelemetryIssueType, { ruleId: string; severity: Severity; diagnosis: SignalDiagnosis }> = {
  SIGNAL_NOT_IN_MAP: { ruleId: 'TM-002', severity: 'CRITICAL', diagnosis: 'NOT_IN_MAP' },
  SIGNAL_NOT_IN_DATA: { ruleId: 'TM-003', severity: 'CRITICAL', diagnosis: 'NOT_IN_DATA' },
  NO_COMMUNICATION: { ruleId: 'TM-003', severity: 'CRITICAL', diagnosis: 'NO_COMMUNICATION' },
  FOREIGN_SIGNAL: { ruleId: 'TM-004', severity: 'CRITICAL', diagnosis: 'WRONG_BINDING' },
  FOREIGN_OBJECT: { ruleId: 'TM-004', severity: 'CRITICAL', diagnosis: 'WRONG_BINDING' },
  STALE_SIGNAL: { ruleId: 'TM-005', severity: 'CRITICAL', diagnosis: 'STALE' },
  INCOMPLETE_SIGNAL: { ruleId: 'TM-006', severity: 'CRITICAL', diagnosis: 'INCOMPLETE' },
  UNIT_MISMATCH: { ruleId: 'TM-007', severity: 'CRITICAL', diagnosis: 'INVALID_DATA' },
  OUT_OF_RANGE: { ruleId: 'TM-008', severity: 'CRITICAL', diagnosis: 'INVALID_DATA' },
  NEGATIVE_PV: { ruleId: 'TM-008', severity: 'CRITICAL', diagnosis: 'INVALID_DATA' },
  SOC_OUT_OF_RANGE: { ruleId: 'TM-008', severity: 'CRITICAL', diagnosis: 'INVALID_DATA' },
  SIGN_ERROR: { ruleId: 'TM-008', severity: 'CRITICAL', diagnosis: 'INVALID_DATA' },
  INVALID_NUMBER: { ruleId: 'TM-008', severity: 'CRITICAL', diagnosis: 'INVALID_DATA' },
  INVALID_TIMESTAMP: { ruleId: 'TM-009', severity: 'CRITICAL', diagnosis: 'INVALID_DATA' },
  NON_UTC_TIMESTAMP: { ruleId: 'TM-009', severity: 'CRITICAL', diagnosis: 'INVALID_DATA' },
  DUPLICATE_TIMESTAMP: { ruleId: 'TM-009', severity: 'CRITICAL', diagnosis: 'INVALID_DATA' },
  SOC_JUMP: { ruleId: 'TM-010', severity: 'WARNING', diagnosis: 'SUSPICIOUS' },
  SETPOINT_MISMATCH: { ruleId: 'TM-010', severity: 'WARNING', diagnosis: 'SUSPICIOUS' },
};

/** Значение интервала: 0 – нет, 1 – норма, 2 – некорректно, 3 – подозрительно. */
const NONE = 0, GOOD = 1, INVALID = 2, SUSP = 3;

interface Tracked {
  signal: string;
  owner: string;
  assetType: SignalReport['assetType'];
  scope: SignalReport['scope'];
  required: boolean;
  inPassport: boolean;
  col: number;
  unit: string | null;
  slots: Uint8Array;
  last: number | null;
  /** Значение в последней достоверной точке. */
  lastValue: number | null;
  invalid: number;
  suspicious: number;
  prevSoc: number | null;
  /** Событийный сигнал управления: значения только при командах – полнота и актуальность не применяются. */
  event: boolean;
}

/**
 * Потоковый анализатор telemetry.csv относительно паспорта object.json и точки проверки.
 * Полнота и тепловая карта – по окну [точка − 48 ч, точка) с шагом 15 мин; отдельно по каждому сигналу.
 */
export class TelemetryAnalyzer {
  private tracked: Tracked[] = [];
  private byName = new Map<string, Tracked>();
  private tsIndex = 0;
  private objectCol = -1;
  private foreign: string[] = [];
  private objectIds = new Set<string>();
  private seen = new Set<number>();
  private issues: TelemetryIssue[] = [];
  private truncated = 0;
  private counts: Partial<Record<TelemetryIssueType, number>> = {};
  private rows = 0;
  private first: number | null = null;
  private lastTs: number | null = null;
  private readonly from: number;
  private readonly to: number;
  private readonly step: number;
  private readonly slotsN: number;

  constructor(
    private readonly rules: TelemetryRules,
    private readonly passport: SitePassport,
    checkPoint: string = rules.checkPoint,
  ) {
    this.step = rules.intervalMinutes * MIN;
    this.to = Date.parse(checkPoint);
    this.from = this.to - rules.windowHours * 3_600_000;
    this.slotsN = Math.round((this.to - this.from) / this.step);
  }

  private issue(type: TelemetryIssueType, owner: string, signal: string, i: Omit<TelemetryIssue, 'type' | 'ruleId' | 'severity' | 'diagnosis' | 'owner' | 'signal'>, diagnosis?: SignalDiagnosis) {
    this.counts[type] = (this.counts[type] ?? 0) + 1;
    if (this.issues.length >= MAX_ISSUES) return void this.truncated++;
    this.issues.push({ type, ...TM_ISSUE[type], ...(diagnosis ? { diagnosis } : {}), owner, signal, ...i });
  }

  header(cells: string[]): void {
    const req = requiredSignals(this.passport, this.rules);
    const declared = new Map<string, { owner: string; assetType: SignalReport['assetType'] }>();
    for (const s of this.passport.siteSignals) declared.set(s, { owner: s.startsWith('Grid') ? 'GRID' : 'SITE', assetType: 'GRID' });
    for (const a of this.passport.assets) for (const s of a.signals) declared.set(s, { owner: a.assetId, assetType: a.type });
    const cols = new Map<string, { index: number; unit: string | null }>();
    cells.forEach((cell, index) => {
      const { field, unit } = parseHeaderCell(cell);
      if (/^timestamp$/i.test(field)) this.tsIndex = index;
      else if (/^object_?id$/i.test(field)) this.objectCol = index;
      else cols.set(field, { index, unit });
    });
    const eventSuffixes = new Set((this.rules.eventSignals ?? []).map((t) => t.replace('{asset}.', '')));
    const add = (signal: string, owner: string, assetType: SignalReport['assetType'], scope: SignalReport['scope'], required: boolean, inPassport: boolean) => {
      if (this.byName.has(signal)) return;
      const c = cols.get(signal);
      const t: Tracked = { signal, owner, assetType, scope, required, inPassport, col: c?.index ?? -1, unit: c?.unit ?? null, slots: new Uint8Array(this.slotsN), last: null, lastValue: null, invalid: 0, suspicious: 0, prevSoc: null, event: assetType !== 'GRID' && scope === 'ASSET' && eventSuffixes.has(signal.split('.').slice(1).join('.')) };
      this.tracked.push(t);
      this.byName.set(signal, t);
      if (c && c.unit !== expectedUnit(signal) && expectedUnit(signal) !== 'code') {
        this.issue('UNIT_MISMATCH', owner, signal, { timestamp: null, line: 1, value: c.unit ?? 'не указана', expected: expectedUnit(signal), explanation: 'Единица в заголовке колонки не соответствует правилу (kW / kWh / %).', action: `Исправить единицу сигнала ${signal} в выгрузке` });
      }
    };
    for (const r of req) add(r.signal, r.owner, r.assetType, r.scope, true, r.inPassport);
    for (const [s, d] of declared) add(s, d.owner, d.assetType, isTotalSignal(s) ? 'TOTAL' : s.startsWith('Grid') ? 'GRID' : d.owner === 'SITE' ? 'SITE' : 'ASSET', false, true);
    for (const name of cols.keys()) {
      if (!this.byName.has(name)) {
        this.foreign.push(name);
        this.issue('FOREIGN_SIGNAL', name.split('.')[0]!, name, { timestamp: null, line: 1, value: name, expected: 'Сигнал из карты сигналов object.json', explanation: 'Колонка не принадлежит ни одному активу паспорта: телеметрия другого актива или объекта либо ошибка карты сигналов. Оборудование не добавляется автоматически.', action: 'Проверить привязку сигнала: исправить карту сигналов или источник выгрузки' });
      }
    }
  }

  row(cells: string[], line: number): void {
    if (cells.length === 1 && cells[0]!.trim() === '') return;
    this.rows++;
    const raw = cells[this.tsIndex];
    const ts = parseTimestamp(raw);
    if (ts.kind === 'invalid') return void this.issue('INVALID_TIMESTAMP', 'GRID', 'timestamp', { timestamp: null, line, value: ts.raw || '(пусто)', expected: 'ISO 8601 UTC', explanation: 'Отметку времени невозможно разобрать – строка исключена.', action: 'Исправить формат времени в выгрузке' });
    const iso = () => new Date(ts.ms).toISOString();
    if (!ts.utc) this.issue('NON_UTC_TIMESTAMP', 'GRID', 'timestamp', { timestamp: iso(), line, value: raw ?? '', expected: 'Смещение Z или +00:00', explanation: ts.offsetMissing ? 'Часовой пояс не указан – время неоднозначно, интервалы нельзя сопоставить.' : 'Время не в UTC.', action: 'Запросить выгрузку телеметрии с временем в UTC' });
    if (this.seen.has(ts.ms)) return void this.issue('DUPLICATE_TIMESTAMP', 'GRID', 'timestamp', { timestamp: iso(), line, value: raw ?? '', expected: 'Одна запись на интервал', explanation: 'Повторная запись интервала не учитывается.', action: 'Удалить дубли в выгрузке' });
    this.seen.add(ts.ms);
    this.first = this.first === null ? ts.ms : Math.min(this.first, ts.ms);
    this.lastTs = this.lastTs === null ? ts.ms : Math.max(this.lastTs, ts.ms);
    if (this.objectCol >= 0) {
      const id = cells[this.objectCol]?.trim();
      if (id && !this.objectIds.has(id)) {
        this.objectIds.add(id);
        if (id !== this.passport.objectId) this.issue('FOREIGN_OBJECT', 'GRID', 'object_id', { timestamp: iso(), line, value: id, expected: this.passport.objectId, explanation: 'В выгрузке телеметрия другого объекта.', action: 'Заменить выгрузку на телеметрию этого объекта' });
      }
    }
    const inWindow = ts.ms >= this.from && ts.ms < this.to && ts.utc;
    const slot = inWindow ? Math.floor((ts.ms - this.from) / this.step) : -1;
    const hours = this.rules.intervalMinutes / 60;
    const vals: Record<string, number> = {};

    for (const t of this.tracked) {
      if (t.col < 0) continue;
      const p = parseDecimal(cells[t.col]);
      if (p.kind === 'empty') continue;
      if (p.kind === 'invalid') {
        t.invalid++;
        if (slot >= 0) t.slots[slot] = INVALID;
        this.issue('INVALID_NUMBER', t.owner, t.signal, { timestamp: iso(), line, value: p.raw, expected: 'Число', explanation: 'Значение не является числом.', action: 'Исправить значение в выгрузке' });
        continue;
      }
      const v = p.value;
      vals[t.signal] = v;
      let state = GOOD;
      const s = t.signal;
      const bad = (type: TelemetryIssueType, expected: string, explanation: string, action: string) => {
        state = INVALID;
        t.invalid++;
        this.issue(type, t.owner, s, { timestamp: iso(), line, value: String(v), expected, explanation, action });
      };
      if (/SOC_%/.test(s)) {
        if (v < 0 || v > 100) bad('SOC_OUT_OF_RANGE', '0 … 100 %', 'Уровень заряда вне физически допустимого диапазона.', 'Проверить масштаб и единицы SoC');
        else if (t.prevSoc !== null && Math.abs(v - t.prevSoc) > this.rules.maxSocJumpPct) {
          state = SUSP;
          t.suspicious++;
          this.issue('SOC_JUMP', t.owner, s, { timestamp: iso(), line, value: `${t.prevSoc} → ${v}`, expected: `Изменение ≤ ${this.rules.maxSocJumpPct} п. п. за ${this.rules.intervalMinutes} мин`, explanation: 'Скачок SoC за интервал физически маловероятен – требуется проверка измерения, это не доказательство неисправности батареи.', action: 'Сверить SoC с журналом BMS' });
        }
        t.prevSoc = v;
      } else if (/energy_kWh/.test(s)) {
        if (v < 0) bad('OUT_OF_RANGE', '≥ 0', 'Энергия за интервал – неотрицательная величина.', 'Исправить знак энергии в выгрузке');
        else if (v > this.rules.maxEnergyKwhPerInterval) bad('OUT_OF_RANGE', `≤ ${this.rules.maxEnergyKwhPerInterval} kWh`, 'Значение превышает физически допустимое за интервал – вероятно, другие единицы.', 'Проверить единицы сигнала');
      } else if (/power_kW/.test(s)) {
        if (/^PV/.test(s) && !/setpoint/.test(s) && v < -0.5) bad('NEGATIVE_PV', '≥ 0', 'Мощность PV не может быть отрицательной (ТЗ 4.2).', `Проверить знак ${s} в выгрузке`);
        else if (Math.abs(v) > this.rules.maxAbsPowerKw) bad('OUT_OF_RANGE', `|P| ≤ ${this.rules.maxAbsPowerKw} kW`, 'Мощность вне физически допустимого диапазона.', 'Проверить единицы и масштаб сигнала');
      }
      if (slot >= 0) t.slots[slot] = Math.max(t.slots[slot]!, state === GOOD ? GOOD : state);
      if (state !== INVALID && (t.last === null || ts.ms >= t.last)) {
        t.last = ts.ms;
        t.lastValue = v;
      }
    }

    // Знаки по направлению энергии: Grid (+ потребление), Battery (+ заряд)
    const eps = 0.5;
    const signCheck = (power: string, plusEnergy: string, minusEnergy: string, owner: string, rule: string) => {
      const p = vals[power];
      const plus = vals[plusEnergy];
      const minus = vals[minusEnergy];
      if (p === undefined || plus === undefined || minus === undefined) return;
      if ((p > eps && plus <= 0 && minus > eps * hours) || (p < -eps && minus <= 0 && plus > eps * hours)) {
        const t = this.byName.get(power)!;
        t.invalid++;
        if (slot >= 0) t.slots[slot] = INVALID;
        this.issue('SIGN_ERROR', owner, power, { timestamp: iso(), line, value: String(p), expected: rule, explanation: 'Знак мощности противоречит направлению энергии за интервал.', action: `Проверить знак ${power} в выгрузке` });
      }
    };
    signCheck('Grid.power_kW', 'Grid.energy_kWh.offtake', 'Grid.energy_kWh.injection', 'GRID', '+ потребление из сети / − выдача');
    for (const a of this.passport.assets) {
      if (a.type !== 'BATTERY') continue;
      signCheck(`${a.prefix}.power_kW`, `${a.prefix}.energy_kWh.charge`, `${a.prefix}.energy_kWh.discharge`, a.assetId, '+ заряд / − разряд');
      const sent = vals[`${a.prefix}.power_kW.setpoint_sent`];
      const rec = vals[`${a.prefix}.power_kW.setpoint_received`];
      if (sent !== undefined && rec !== undefined && Math.abs(sent - rec) > this.rules.setpointToleranceKw) {
        const t = this.byName.get(`${a.prefix}.power_kW.setpoint_received`)!;
        t.suspicious++;
        if (slot >= 0 && t.slots[slot] === GOOD) t.slots[slot] = SUSP;
        this.issue('SETPOINT_MISMATCH', a.assetId, t.signal, { timestamp: iso(), line, value: `${sent} → ${rec}`, expected: `|Δ| ≤ ${this.rules.setpointToleranceKw} kW`, explanation: 'Принятая уставка отличается от отправленной – проверяется на этапе «Управление».', action: 'Сверить журнал команд контроллера' });
      }
    }
  }

  finish(meta: TelemetryReport['meta']): TelemetryReport {
    const to = this.to;
    const signals: SignalReport[] = this.tracked.map((t) => {
      const inData = t.col >= 0;
      let received = 0;
      let heat = '';
      for (let i = 0; i < this.slotsN; i++) {
        const v = t.slots[i]!;
        if (v !== NONE) received++;
        const slotStart = this.from + i * this.step;
        const h: HeatState = v === GOOD ? 'G' : v === INVALID ? 'I' : v === SUSP ? 'S' : t.last !== null && slotStart > t.last ? 'D' : 'M';
        heat += h;
      }
      const completenessPct = Math.floor((received / this.slotsN) * 10_000) / 100;
      const ageMinutes = t.last === null ? null : Math.round((to - (t.last + this.step)) / MIN);
      let diagnosis: SignalDiagnosis = 'OK';
      if (!t.inPassport) diagnosis = 'NOT_IN_MAP';
      else if (!inData) diagnosis = this.foreign.some((f) => f.split('.').slice(1).join('.') === t.signal.split('.').slice(1).join('.')) ? 'WRONG_BINDING' : 'NOT_IN_DATA';
      else if (t.event) diagnosis = t.invalid > 0 ? 'INVALID_DATA' : 'OK';
      else if (t.last === null && t.invalid === 0) diagnosis = 'NO_COMMUNICATION';
      else if (t.invalid > 0) diagnosis = 'INVALID_DATA';
      else if (ageMinutes !== null && ageMinutes > this.rules.maxAgeMinutes) diagnosis = 'STALE';
      else if (completenessPct < this.rules.minCompletenessPct) diagnosis = 'INCOMPLETE';
      else if (t.suspicious > 0) diagnosis = 'SUSPICIOUS';
      return {
        signal: t.signal,
        owner: t.owner,
        assetType: t.assetType,
        scope: t.scope,
        required: t.required,
        ...(t.event ? { event: true } : {}),
        inPassport: t.inPassport,
        inData,
        unit: t.unit,
        expectedUnit: expectedUnit(t.signal),
        lastTimestamp: t.last === null ? null : new Date(t.last).toISOString(),
        lastValue: t.lastValue,
        ageMinutes,
        expected: this.slotsN,
        received,
        missing: this.slotsN - received,
        completenessPct,
        invalid: t.invalid,
        suspicious: t.suspicious,
        diagnosis,
        heat,
      };
    });

    const summary: TelemetryIssue[] = [];
    for (const s of signals.filter((x) => x.required)) {
      const add = (type: TelemetryIssueType, value: string, expected: string, explanation: string, action: string, diagnosis?: SignalDiagnosis) => {
        this.counts[type] = (this.counts[type] ?? 0) + 1;
        summary.push({ type, ...TM_ISSUE[type], ...(diagnosis ? { diagnosis } : {}), owner: s.owner, signal: s.signal, timestamp: s.lastTimestamp, value, expected, explanation, action });
      };
      if (!s.inPassport) add('SIGNAL_NOT_IN_MAP', 'нет в карте', `Сигнал ${s.signal} в assets[].signals`, 'Обязательный сигнал не указан в карте сигналов object.json.', `Добавить ${s.signal} в карту сигналов актива ${s.owner}`);
      if (s.diagnosis === 'NOT_IN_DATA') add('SIGNAL_NOT_IN_DATA', 'нет колонки', `Колонка «${s.signal} (${s.expectedUnit})»`, 'Сигнал отсутствует в выгрузке. Это отсутствие сигнала, а не неисправность оборудования.', `Подключить телеметрию сигнала ${s.signal}`);
      if (s.diagnosis === 'WRONG_BINDING') add('SIGNAL_NOT_IN_DATA', 'нет колонки', `Колонка «${s.signal}»`, 'Сигнал не найден, но в выгрузке есть похожий сигнал другого актива или объекта – вероятна ошибочная привязка.', `Проверить привязку сигнала ${s.signal}`, 'WRONG_BINDING');
      if (s.diagnosis === 'NO_COMMUNICATION') add('NO_COMMUNICATION', 'нет значений', 'Значения в окне 48 ч', 'Колонка есть, но значений нет: отсутствует связь с активом. Это не доказательство неисправности оборудования.', `Восстановить связь с ${s.owner} и повторить проверку`);
      if (s.inData && s.lastTimestamp && s.ageMinutes !== null && s.ageMinutes > this.rules.maxAgeMinutes) add('STALE_SIGNAL', `${s.ageMinutes} мин`, `≤ ${this.rules.maxAgeMinutes} мин`, 'Последнее значение старше порога актуальности относительно точки проверки: поток прервался.', `Проверить канал связи ${s.owner}`);
      if (s.inData && s.received > 0 && s.completenessPct < this.rules.minCompletenessPct) add('INCOMPLETE_SIGNAL', `${s.completenessPct} % (${s.received}/${s.expected})`, `≥ ${this.rules.minCompletenessPct} %`, `Полнота за ${this.rules.windowHours} ч ниже порога.`, `Восстановить полноту потока ${s.signal}`);
    }

    return {
      meta: { ...meta, rows: this.rows },
      checkPoint: new Date(this.to).toISOString(),
      window: { from: new Date(this.from).toISOString(), to: new Date(this.to).toISOString(), stepMinutes: this.rules.intervalMinutes, slots: this.slotsN },
      period: { first: this.first === null ? null : new Date(this.first).toISOString(), last: this.lastTs === null ? null : new Date(this.lastTs).toISOString() },
      signals,
      foreignColumns: this.foreign,
      objectIdsInFile: [...this.objectIds],
      issueCounts: this.counts,
      issues: [...summary, ...this.issues],
      issuesTruncated: this.truncated,
    };
  }
}
