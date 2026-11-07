import { describe, expect, it } from 'vitest';
import type { ObjectCatalogEntry } from '@/data/objects';
import { draftFromPassport, planDrop, sniff, type ObjectKey } from '@/services/file-route';

/** «Брось файл куда угодно»: тип файла, объект и причина выбора – без загрузки. */
const entry = (id: string, code: string, ean: [string, string], folder?: string) => ({ id, code, name: `Объект ${code}`, ean: { offtake: ean[0], injection: ean[1] }, ...(folder ? { folder } : {}) }) as unknown as ObjectCatalogEntry;
const KEYS: ObjectKey[] = [
  { entry: entry('obj-001', 'OBJ-001', ['541448800000001018', '541448800000001025']), passportObjectId: 'OBJ-001', ean: ['541448800000001018', '541448800000001025'] },
  { entry: entry('obj-002', 'OBJ-002', ['541448800000002015', '541448800000002022']), ean: ['541448800000002015', '541448800000002022'] },
  { entry: entry('b1', 'B-1', ['541448800000003012', '541448800000003029'], 'Building1'), ean: ['541448800000003012'] },
  { entry: entry('b10', 'B-10', ['541448800000004019', '541448800000004026'], 'Building10'), ean: ['541448800000004019'] },
];

const INVOICE_HEAD = 'timestamp (UTC);Grid.energy_kWh.offtake_invoice (kWh);Grid.energy_kWh.injection_invoice (kWh)';
const csv = (name: string, lines: string[]) => new File([`\uFEFF${lines.join('\n')}`], name, { type: 'text/csv' });
const json = (name: string, v: unknown) => new File([JSON.stringify(v)], name, { type: 'application/json' });
const plan = async (file: File, path = file.name, current: string | null = 'obj-001') => (await planDrop([{ file, path }], KEYS, current, 'Инженер запуска'))[0]!;

describe('распознавание файлов', () => {
  it('тип по колонкам и структуре', async () => {
    expect((await sniff(csv('a.csv', [INVOICE_HEAD, '2025-01-01T00:00:00Z;1;0']))).kind).toBe('invoice');
    expect((await sniff(csv('b.csv', ['timestamp (UTC);object_id;Grid.power_kW (kW);PV1.power_kW (kW)', '2026-11-05T10:00:00Z;OBJ-001;5;3']))).kind).toBe('telemetry');
    expect((await sniff(json('object.json', { object_id: 'X', name: 'X', timezone: 'Europe/Brussels', grid_connection: { ean_offtake: null, ean_injection: null }, data_files: { invoice: null, telemetry: null }, assets: [] }))).kind).toBe('passport');
    expect(await sniff(json('object.json', { object_id: 'X', assets: [] }))).toMatchObject({ kind: 'unknown', error: expect.stringContaining('object.json не соответствует формату') });
    expect(await sniff(csv('c.csv', ['a;b;c', '1;2;3']))).toMatchObject({ kind: 'unknown' });
    expect(await sniff(new File(['{'], 'broken.json'))).toMatchObject({ kind: 'unknown', error: 'Некорректный JSON' });
    expect(await sniff(new File(['x'], 'photo.png'))).toMatchObject({ kind: 'unknown' });
  });

  it('объект по object_id в телеметрии', async () => {
    const p = await plan(csv('telemetry.csv', ['timestamp (UTC);object_id;Grid.power_kW (kW)', '2026-11-05T10:00:00Z;OBJ-001;5']), 'telemetry.csv', 'obj-002');
    expect(p).toMatchObject({ kind: 'telemetry', objectId: 'obj-001', match: 'object_id' });
  });

  it('объект по EAN в истории счётчиков', async () => {
    const p = await plan(csv('invoice.csv', [`${INVOICE_HEAD};EAN_offtake;EAN_injection`, '2025-01-01T00:00:00Z;1;0;541448800000002015;541448800000002022']));
    expect(p).toMatchObject({ kind: 'invoice', objectId: 'obj-002', match: 'ean' });
  });

  it('объект по имени файла и папки – самое длинное совпадение (Building10, а не Building1)', async () => {
    const file = csv('invoice.csv', [INVOICE_HEAD, '2025-01-01T00:00:00Z;1;0']);
    expect(await plan(file, 'Building10/invoice.csv')).toMatchObject({ objectId: 'b10', match: 'name' });
    expect(await plan(file, 'Building1/invoice.csv')).toMatchObject({ objectId: 'b1', match: 'name' });
    expect(await plan(csv('OBJ-002_invoice.csv', [INVOICE_HEAD]))).toMatchObject({ objectId: 'obj-002', match: 'name' });
  });

  it('нет подсказок в файле – предлагается текущий объект; без текущего – не выбран', async () => {
    const file = csv('invoice.csv', [INVOICE_HEAD, '2025-01-01T00:00:00Z;1;0']);
    expect(await plan(file, 'invoice.csv', 'obj-002')).toMatchObject({ objectId: 'obj-002', match: 'current' });
    expect(await plan(file, 'invoice.csv', null)).toMatchObject({ objectId: null, match: 'none' });
  });

  it('файл объекта, которого нет в портфеле, по умолчанию никуда не загружается', async () => {
    const p = await plan(csv('telemetry.csv', ['timestamp (UTC);object_id;Grid.power_kW (kW)', '2026-11-05T10:00:00Z;FOREIGN-7;5']));
    expect(p).toMatchObject({ objectId: null, match: 'none' });
    expect(p.reason).toContain('FOREIGN-7');
  });

  it('паспорт нового объекта – черновик объекта из object.json', async () => {
    const passport = { object_id: 'SUN-1', name: 'Солнечный парк', timezone: 'Europe/Brussels', data_files: { invoice: 'invoice.csv', telemetry: 'telemetry.csv' }, address: { street: 'Rue 1', postal_code: '9000', city: 'Гент', country: 'BE' }, grid_connection: { ean_offtake: '541430000000000081', ean_injection: '541445687468568586' }, assets: [{ asset_id: 'pv-1', type: 'pv' }, { asset_id: 'pv-2', type: 'pv' }, { asset_id: 'battery-1', type: 'battery' }] };
    const p = await plan(json('object.json', passport));
    expect(p).toMatchObject({ kind: 'passport', objectId: null, match: 'none' });
    expect(p.draft).toMatchObject({ name: 'Солнечный парк', city: 'Гент', street: 'Rue 1', postalCode: '9000', eanOfftake: '541430000000000081', eanInjection: '541445687468568586', pvCount: 2, batteryCount: 1, responsible: 'Инженер запуска' });
    // Паспорт известного объекта – по object_id, без черновика
    expect(await plan(json('object.json', { ...passport, object_id: 'OBJ-001' }))).toMatchObject({ objectId: 'obj-001', match: 'object_id' });
  });

  it('код нового объекта не совпадает с занятыми', () => {
    const d = draftFromPassport({ object_id: 'x', name: 'OBJ 001' }, 'а', KEYS.map((k) => k.entry));
    expect(d.code).not.toBe('OBJ-001');
  });
});
