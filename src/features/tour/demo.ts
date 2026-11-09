import { localizeSelector } from '@/i18n';
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
  for (const el of document.querySelectorAll<HTMLElement>(localizeSelector(selector))) if (!el.closest('[data-tour-ui]') && visible(el)) return el;
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

/** Ближайший прокручиваемый предок (окно приложения, модальное окно); нет – прокручивается страница. */
function scrollParent(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Плавная прокрутка к элементу: по центру экрана (высокий блок – к верху), скорость с разгоном и торможением,
 * длительность растёт с расстоянием (дальний блок – не рывком). Завершается, когда прокрутка закончена.
 */
export function smoothScrollTo(el: HTMLElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const box = scrollParent(el);
    const page = box === document.scrollingElement || box === document.documentElement;
    const view = page ? { top: 0, height: window.innerHeight } : box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const headerGap = page ? 88 : 16;
    const offset = r.height > view.height - headerGap - 48 ? r.top - view.top - headerGap : r.top - view.top - (view.height - r.height) / 2;
    const from = box.scrollTop;
    const to = Math.max(0, Math.min(box.scrollHeight - box.clientHeight, from + offset));
    const dist = Math.abs(to - from);
    if (dist < 2 || reducedMotion()) {
      box.scrollTop = to;
      return resolve();
    }
    const duration = Math.min(1100, Math.max(380, 260 + dist * 0.45));
    const start = performance.now();
    const tick = (now: number) => {
      if (signal.aborted) return resolve();
      const k = Math.min(1, (now - start) / duration);
      box.scrollTop = from + (to - from) * easeInOut(k);
      if (k < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
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
  for (const btn of document.querySelectorAll<HTMLButtonElement>(localizeSelector('[role="dialog"][data-state="open"]:not([data-tour-ui]) button[aria-label="Закрыть"]'))) btn.click();
}
