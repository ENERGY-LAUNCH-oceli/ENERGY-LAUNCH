import { describe, expect, it } from 'vitest';
import { parseInvoiceCsv, parseMeasurementsCsv } from '@/services/csv-import';

describe('импорт CSV', () => {
  it('разбирает измерения и помечает пустые значения как MISSING', () => {
    const csv = [
      'Timestamp,Signal ID,Value,Unit,Quality,Received At',
      '2026-11-01T00:00:00Z,sig-p,10.5,MW,GOOD,2026-11-01T00:00:02Z',
      '2026-11-01T00:01:00Z,sig-p,,MW,,',
    ].join('\n');
    const r = parseMeasurementsCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ signalId: 'sig-p', value: 10.5, receivedAt: '2026-11-01T00:00:02Z' });
    expect(r.rows[1]).toMatchObject({ value: null, quality: 'MISSING' });
  });

  it('возвращает ошибки с номером строки, не прерывая импорт', () => {
    const csv = 'timestamp,signal_id,value,unit\nnot-a-date,sig-p,1,MW\n2026-11-01T00:00:00Z,sig-p,1,parsec\n2026-11-01T00:00:00Z,sig-p,1,MW';
    const r = parseMeasurementsCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.errors.map((e) => e.row)).toEqual([2, 3]);
  });

  it('разбирает строки счёта и проверяет порядок дат', () => {
    const csv = 'metering_point_id,period_start,period_end,energy_kwh\nmp-1,2026-10-01T00:00:00Z,2026-11-01T00:00:00Z,1200.5\nmp-1,2026-11-01T00:00:00Z,2026-10-01T00:00:00Z,1';
    let n = 0;
    const r = parseInvoiceCsv(csv, () => `line-${++n}`);
    expect(r.rows).toEqual([{ id: 'line-1', meteringPointId: 'mp-1', periodStart: '2026-10-01T00:00:00Z', periodEnd: '2026-11-01T00:00:00Z', energyKwh: 1200.5 }]);
    expect(r.errors[0]).toMatchObject({ row: 3, field: 'period_end' });
  });
});
