import type { InvoiceIssueType } from '@/types';

export const ISSUE_LABEL: Record<InvoiceIssueType, string> = {
  MISSING_INTERVAL: 'Пропуск интервалов',
  DUPLICATE_TIMESTAMP: 'Дубль метки времени',
  INVALID_TIMESTAMP: 'Некорректный timestamp',
  NON_UTC_TIMESTAMP: 'Время не в UTC',
  MISALIGNED_TIMESTAMP: 'Метка вне сетки',
  EMPTY_VALUE: 'Пустое значение',
  INVALID_NUMBER: 'Некорректное число',
  NEGATIVE_VALUE: 'Отрицательное значение',
  POSITIVE_VALUE: 'Положительное значение',
  SIGN_ERROR: 'Ошибка знака',
  UNIT_MISMATCH: 'Неверная единица',
  MIXED_UNITS: 'Смешанные единицы',
  MISSING_FIELD: 'Нет колонки',
  VALIDATED_DEVIATION: 'Расхождение с validated',
};

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1]} ${y!.slice(2)}`;
};

export const utc = (iso: string | null | undefined) =>
  iso ? `${iso.slice(0, 10).split('-').reverse().join('.')} ${iso.slice(11, 16)}` : '—';

export const bytes = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} КБ` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`);
