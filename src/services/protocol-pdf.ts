/**
 * PDF протокола готовности из уже отрисованного документа (html2pdf: html2canvas + jsPDF).
 * Библиотека загружается только при первом запросе PDF – в основной бандл она не входит.
 */

/** Методы jsPDF, которые нужны для нумерации страниц (библиотека типов не экспортирует). */
interface PdfPages {
  internal: { getNumberOfPages: () => number };
  setPage: (page: number) => void;
  setFontSize: (size: number) => void;
  setTextColor: (red: number, green: number, blue: number) => void;
  text: (value: string, x: number, y: number, options?: { align?: 'left' | 'center' | 'right' }) => void;
}

function isPdfPages(value: unknown): value is PdfPages {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const internal = candidate.internal;
  if (typeof internal !== 'object' || internal === null) return false;
  const internals = internal as Record<string, unknown>;
  return typeof internals.getNumberOfPages === 'function' && typeof candidate.setPage === 'function' && typeof candidate.setFontSize === 'function' && typeof candidate.setTextColor === 'function' && typeof candidate.text === 'function';
}

/**
 * A4, светлая тема независимо от темы интерфейса, номер страницы внизу. Оверлеи, которые html2pdf оставляет
 * в документе, удаляются и при ошибке. Ошибки – с текстом для пользователя.
 */
export async function renderProtocolPdf(element: HTMLElement, fileName: string): Promise<Blob> {
  const existingOverlays = new Set(document.querySelectorAll<HTMLElement>('.html2pdf__overlay'));
  const html2pdf = (await import('html2pdf.js')).default;
  try {
    const worker = html2pdf()
      .set({
        filename: fileName,
        margin: [10, 10, 12, 10],
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          windowWidth: element.clientWidth,
          onclone: (clonedDocument: Document) => {
            clonedDocument.documentElement.setAttribute('data-theme', 'light');
            clonedDocument.querySelectorAll<HTMLElement>(`#${element.id}`).forEach((documentElement) => documentElement.classList.add('protocol-pdf-layout'));
          },
        },
        jsPDF: { format: 'a4', orientation: 'portrait', unit: 'mm' },
      })
      .from(element);
    await worker.toPdf();
    const pdfDocument: unknown = await worker.get('pdf');
    if (!isPdfPages(pdfDocument)) throw new Error('Не удалось подготовить страницы PDF.');
    const pageCount = pdfDocument.internal.getNumberOfPages();
    pdfDocument.setFontSize(8);
    pdfDocument.setTextColor(95, 105, 115);
    for (let page = 1; page <= pageCount; page += 1) {
      pdfDocument.setPage(page);
      pdfDocument.text(`${page} / ${pageCount}`, 105, 289, { align: 'center' });
    }
    const result = await worker.outputPdf('blob');
    if (!(result instanceof Blob)) throw new Error('Не удалось сформировать PDF-файл.');
    return result;
  } finally {
    document.querySelectorAll<HTMLElement>('.html2pdf__overlay').forEach((overlay) => {
      if (!existingOverlays.has(overlay)) overlay.remove();
    });
  }
}
