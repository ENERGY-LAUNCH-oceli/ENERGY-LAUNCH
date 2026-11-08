import { afterEach, describe, expect, it, vi } from 'vitest';
import { csvCell, toCsv } from '@/utils/csv';
import { safeFileName } from '@/utils/download';
import { localStore } from '@/utils/local-store';

describe('CSV', () => {
  it('ячейка всегда в кавычках, кавычки удваиваются, пусто для null', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('он сказал "да"')).toBe('"он сказал ""да"""');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(42)).toBe('"42"');
  });

  it('файл: BOM, разделитель «;», перевод строки в конце', () => {
    expect(toCsv([['a', 1], [], ['b']])).toBe('\uFEFF"a";"1"\n\n"b"\n');
  });
});

describe('имя файла', () => {
  it('без запрещённых и управляющих символов, пробелы – дефисы', () => {
    expect(safeFileName('Объект: «Север» / A\u0007')).toBe('Объект-«Север»-A');
    expect(safeFileName('  ')).toBe('file');
    expect(safeFileName('???', 'object')).toBe('object');
  });
});

describe('localStore', () => {
  afterEach(() => vi.unstubAllGlobals());

  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };

  it('чтение и запись строк и JSON', () => {
    vi.stubGlobal('localStorage', memory());
    localStore.set('k', 'v');
    expect(localStore.get('k')).toBe('v');
    localStore.setJson('j', { a: 1 });
    expect(localStore.getJson('j', {})).toEqual({ a: 1 });
    localStore.remove('k');
    expect(localStore.get('k')).toBeNull();
  });

  it('повреждённый JSON или значение не того вида – значение по умолчанию', () => {
    vi.stubGlobal('localStorage', memory());
    localStore.set('j', '{oops');
    expect(localStore.getJson('j', [1])).toEqual([1]);
    localStore.setJson('j', { a: 1 });
    expect(localStore.getJson<unknown[]>('j', [], Array.isArray)).toEqual([]);
  });

  it('хранилище недоступно (приватный режим) – чтение даёт значение по умолчанию, запись не бросает', () => {
    const boom = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom });
    expect(localStore.get('k')).toBeNull();
    expect(localStore.getJson('k', 'x')).toBe('x');
    expect(() => localStore.set('k', 'v')).not.toThrow();
    expect(() => localStore.remove('k')).not.toThrow();
  });
});
