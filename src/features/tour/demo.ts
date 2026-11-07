/**
 * Действия, которые тур выполняет «за пользователя»: найти элемент, нажать, напечатать текст.
 * Всё прерывается сигналом шага: перешли на другой шаг или закрыли тур – печать и ожидание останавливаются.
 */

export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = window.setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
  });

const visible = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

/** Первый видимый элемент по селектору (кнопки для телефона и компьютера могут дублироваться). */
export function findVisible(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) if (!el.closest('[data-tour-ui]') && visible(el)) return el;
  return null;
}

/** Дождаться видимого элемента: страница грузится лениво, окно открывается с анимацией. */
export function waitFor(selector: string, signal: AbortSignal, timeout = 5000): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const deadline = performance.now() + timeout;
    const tick = () => {
      if (signal.aborted) return resolve(null);
      const el = findVisible(selector);
      if (el) return resolve(el);
      if (performance.now() > deadline) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/** Значение поля так, как будто его ввёл человек: React получает обычное событие input. */
export function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Печать по буквам (при «уменьшении движения» – сразу). */
export async function typeInto(selector: string, text: string, signal: AbortSignal) {
  const el = (await waitFor(selector, signal, 3000)) as HTMLInputElement | null;
  if (!el || signal.aborted) return;
  if (reducedMotion()) return setValue(el, text);
  setValue(el, '');
  const step = Math.max(14, Math.min(45, 900 / text.length));
  for (let i = 1; i <= text.length; i++) {
    if (signal.aborted) return setValue(el, text);
    setValue(el, text.slice(0, i));
    await sleep(step, signal);
  }
}

/** Заполнить поле без анимации, если оно пустое (шаг открыли не по порядку). */
export function fillIfEmpty(selector: string, text: string) {
  const el = findVisible(selector) as HTMLInputElement | null;
  if (el && !el.value) setValue(el, text);
}

/** Нажатие: события указателя и мыши (вкладки Radix реагируют на mousedown) и click. */
export function press(el: Element | null) {
  if (!el) return;
  const opts = { bubbles: true, cancelable: true, button: 0, view: window };
  el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType: 'mouse', isPrimary: true }));
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerType: 'mouse', isPrimary: true }));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  (el as HTMLElement).click();
}

/** Закрыть открытые окна приложения (не карточку тура). */
export function closeDialogs() {
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[role="dialog"][data-state="open"]:not([data-tour-ui]) button[aria-label="Закрыть"]')) btn.click();
}
