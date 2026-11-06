import type { HeatState, SignalDiagnosis, TelemetryIssueType } from '@/types';

/** Причины проблем: ТЗ требует различать отсутствие сигнала, связи, привязки и неисправность. */
export const DIAGNOSIS: Record<SignalDiagnosis, { label: string; tone: 'success' | 'error' | 'warning' | 'neutral' | 'info'; hint: string }> = {
  OK: { label: 'Подключён', tone: 'success', hint: 'Сигнал есть, свежий, полный и правдоподобный.' },
  NOT_IN_MAP: { label: 'Нет в карте', tone: 'warning', hint: 'Обязательный сигнал не указан в карте сигналов object.json – исправьте паспорт.' },
  NOT_IN_DATA: { label: 'Нет сигнала', tone: 'error', hint: 'Колонки нет в выгрузке: сигнал не передаётся. Это не неисправность оборудования.' },
  NO_COMMUNICATION: { label: 'Нет связи', tone: 'error', hint: 'Колонка есть, значений нет: связь с активом отсутствует. Это не доказательство неисправности.' },
  STALE: { label: 'Устарел', tone: 'error', hint: 'Последнее значение старше порога актуальности: поток прервался.' },
  INCOMPLETE: { label: 'Неполный', tone: 'warning', hint: 'Полнота за 48 ч ниже порога.' },
  WRONG_BINDING: { label: 'Ошибка привязки', tone: 'error', hint: 'В выгрузке похожий сигнал другого актива или объекта – проверьте привязку.' },
  INVALID_DATA: { label: 'Некорректные данные', tone: 'error', hint: 'Нарушены единицы, знаки или диапазоны.' },
  SUSPICIOUS: { label: 'Подозрительно', tone: 'warning', hint: 'Значения неправдоподобны – требуется проверка измерения, не вывод о неисправности.' },
};

export const HEAT: Record<HeatState, { label: string; color: string; text: string }> = {
  G: { label: 'Good', color: 'rgb(var(--el-status-completed-solid))', text: 'Значение получено и прошло проверки' },
  M: { label: 'Missing', color: 'rgb(var(--el-status-blocked-solid))', text: 'Значение отсутствует' },
  D: { label: 'Delayed', color: 'rgb(var(--el-info))', text: 'Значение ещё не поступило: поток остановился после последнего значения' },
  I: { label: 'Invalid', color: 'rgb(var(--el-text-primary))', text: 'Значение нарушает единицы, знак или диапазон' },
  S: { label: 'Suspicious', color: 'rgb(var(--el-warning))', text: 'Значение неправдоподобно (скачок SoC, расхождение уставок)' },
};

export const TM_ISSUE_LABEL: Record<TelemetryIssueType, string> = {
  SIGNAL_NOT_IN_MAP: 'Нет в карте сигналов',
  SIGNAL_NOT_IN_DATA: 'Нет сигнала в данных',
  NO_COMMUNICATION: 'Нет связи',
  STALE_SIGNAL: 'Устаревшее значение',
  INCOMPLETE_SIGNAL: 'Неполный поток',
  FOREIGN_SIGNAL: 'Сигнал вне паспорта',
  FOREIGN_OBJECT: 'Другой объект',
  UNIT_MISMATCH: 'Неверная единица',
  OUT_OF_RANGE: 'Вне диапазона',
  NEGATIVE_PV: 'Отрицательная PV',
  SOC_OUT_OF_RANGE: 'SoC вне 0–100 %',
  SIGN_ERROR: 'Ошибка знака',
  INVALID_NUMBER: 'Некорректное число',
  INVALID_TIMESTAMP: 'Некорректный timestamp',
  NON_UTC_TIMESTAMP: 'Неоднозначная зона',
  DUPLICATE_TIMESTAMP: 'Дубль метки',
  SETPOINT_MISMATCH: 'Расхождение уставок',
  SOC_JUMP: 'Скачок SoC',
};

/** Порядок групп: Grid, затем активы паспорта. */
export const ownerLabel = (owner: string, type: string) => (owner === 'GRID' ? 'Grid · точка подключения' : `${owner} · ${type === 'PV' ? 'PV' : type === 'BATTERY' ? 'Battery' : type}`);
