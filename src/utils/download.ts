/**
 * Сохранить файл в браузере. Blob-URL разрешён CSP (`img-src blob:`, скачивание – через ссылку);
 * ссылка освобождается после того, как браузер начал загрузку.
 */
export function downloadFile(name: string, content: BlobPart | Blob, type = 'application/octet-stream'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Имя файла из произвольного названия: без запрещённых и управляющих символов, пробелы – дефисы. */
export function safeFileName(name: string, fallback = 'file'): string {
  return (
    name
      .normalize('NFKC')
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .split('')
      .filter((ch) => ch.charCodeAt(0) >= 32)
      .join('')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || fallback
  );
}
