import { describe, expect, it } from 'vitest';
import en from '@/i18n/en.json';
import { Translator, type Dictionary } from '@/i18n/translate';

const t = new Translator(en as Dictionary);
const tr = (s: string) => t.translate(s);

describe('перевод интерфейса на английский', () => {
  it('точные строки и пробелы по краям', () => {
    expect(tr('Обзор')).toBe('Overview');
    expect(tr('  Завершить этап ')).toBe('  Complete stage ');
    expect(tr('Hello')).toBeNull();
  });

  it('шаблоны с подстановками, в том числе пустыми', () => {
    expect(tr('Пройдено 5 из 7')).toBe('Passed 5 of 7');
    expect(tr('Интервалов 69 600 из 69 600 (100%); пропущено 0')).toBe('Intervals 69 600 of 69 600 (100%); missing 0');
    expect(tr('Паспорт building_1: активов 0 (нет)')).toBe('Passport building_1: 0 assets (no)');
  });

  it('русская подстановка внутри шаблона переводится рекурсивно', () => {
    expect(tr('Ожидает завершения этапа «История счётчиков»')).toBe('Waiting for stage “Meter history” to complete');
  });

  it('даты и относительное время', () => {
    expect(tr('ноя 24')).toBe('Nov 24');
    expect(tr('4 дня назад')).toBe('4 days ago');
    expect(tr('1 час назад')).toBe('1 hour ago');
    expect(tr('через 5 минут')).toBe('in 5 minutes');
    expect(tr('апр 25: потребление 17,0 МВт·ч, выдача 2,1 МВт·ч')).toBe('Apr 25: import 17,0 MWh, export 2,1 MWh');
  });

  it('составные строки – по частям', () => {
    expect(tr('TM-011: Сигналы батарей')).toBe('TM-011: Battery signals');
    expect(tr('· История счётчиков')).toBe('· Meter history');
    expect(tr('Батареи · 1')).toBe('Batteries · 1');
    expect(tr('Получить телеметрию с сигналами: Battery1.power_kW и ещё 4')).toBe('Get telemetry with the signals: Battery1.power_kW and 4 more');
  });

  it('короткий шаблон не переводит одно слово внутри длинной фразы', () => {
    const s = 'Знак Grid.power_kW обратный почти во всех интервалах (5 863 нарушений): по ТЗ 4.2 «+» – потребление из сети и заряд, «−» – выдача и разряд';
    const out = tr(s)!;
    expect(out).toMatch(/^The sign of Grid\.power_kW is inverted/);
    expect(out).not.toMatch(/[А-Яа-я]/);
  });

  it('нет перевода – строка остаётся как есть', () => {
    expect(tr('Совершенно новая фраза без перевода')).toBeNull();
  });
});

describe('перевод: соседние подстановки, длинные даты, перечисления', () => {
  it('«{0}{1}» не режет слово пополам', () => {
    expect(tr('проверки этапа REALTIME_TELEMETRY · object.json v1')).toBe('stage REALTIME_TELEMETRY checks · object.json v1');
  });
  it('длинная дата toLocaleString', () => {
    expect(tr('5 нояб. 2026 г., 10:00 UTC')).toBe('5 Nov 2026, 10:00 UTC');
  });
  it('перечисление через запятую и переход статуса', () => {
    expect(tr('Мощность сети, Энергия, полученная из сети, Энергия, переданная в сеть')).toBe('Grid power, Energy imported from the grid, Energy exported to the grid');
    expect(tr('IN_PROGRESS → пройдены (12)')).toBe('IN_PROGRESS → passed (12)');
    expect(tr('PV1 (PV, 3 сигналов), Battery1 (BATTERY, 7 сигналов)')).toBe('PV1 (PV, 3 signals), Battery1 (BATTERY, 7 signals)');
  });
});

describe('перевод: «голова + остаток»', () => {
  it('код правила и сообщение с шаблоном', () => {
    const cases = [
      'MH-002 · История покрывает 19 из 24 месяцев; нет данных: 2024-11, 2024-12, 2025-01',
      'CT-014: Батарея: тест setpoint',
      'MH-004 · Интервалов 69 312 из 69 600 (99.58%, округлено вниз); пропущено 288',
      'TM-003 · Нет данных по 7 обязательным сигналам (активы: battery-1)',
      'object.json v1 · telemetry.csv v1 · журнал тестовых команд: 2',
      'Пустые или некорректные значения в 3 360 интервалах (6 720 значений; поля: Grid.energy_kWh.injection_invoice)',
      'проверки этапа REALTIME_TELEMETRY · object.json v1, telemetry.csv – не загружен',
    ];
    for (const s of cases) {
      const out = tr(s);
      expect(out, s).not.toBeNull();
      expect(out, `${s} → ${out}`).not.toMatch(/[А-Яа-яЁё]/);
    }
  });
});
