const BOM = '\uFEFF';

/** Ячейка CSV: всегда в кавычках, кавычки удваиваются (RFC 4180). */
export const csvCell = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`;

/**
 * CSV в формате данных кейса (ТЗ 9): разделитель «;», UTF-8 с BOM – файл открывается в Excel без настройки кодировки.
 * Пустая строка массива – пустая строка файла.
 */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return `${BOM}${rows.map((r) => r.map(csvCell).join(';')).join('\n')}\n`;
}
