import { flushSync } from 'react-dom';
import { create } from 'zustand';
import { localStore } from '@/utils/local-store';
import { DomTranslator } from './dom';
import { Translator, type Dictionary } from './translate';

/**
 * Язык интерфейса: русский (основной) и английский. Интерфейс написан по-русски; английский – слой перевода
 * поверх отрисованной страницы по словарю src/i18n/en.json (scripts/i18n-extract.mjs собирает новые строки).
 * Выбор запоминается в браузере; theme-init.js выставляет lang до загрузки приложения.
 */
export type Lang = 'ru' | 'en';
export const LANG_KEY = 'el.lang';
export const LANGS: { id: Lang; label: string; native: string }[] = [
  { id: 'ru', label: 'Русский', native: 'Русский' },
  { id: 'en', label: 'Английский', native: 'English' },
];

const readLang = (): Lang => (localStore.get(LANG_KEY) === 'en' ? 'en' : 'ru');

let dom: DomTranslator | null = null;
/** Словарь – отдельный чанк: русскоязычный пользователь его не загружает. */
async function translator(): Promise<DomTranslator> {
  if (!dom) {
    const dict = (await import('./en.json')).default as Dictionary;
    dom = new DomTranslator(new Translator(dict));
  }
  return dom;
}

/**
 * Селектор с русской подписью ([aria-label="Закрыть"]) для текущего языка: в английском режиме подписи переведены
 * на странице, поэтому и в селекторе подставляется перевод. Туры обучения ищут элементы через эту функцию.
 */
export function localizeSelector(selector: string): string {
  if (!dom?.active) return selector;
  return selector.replace(/aria-label(\^?)="([^"]+)"/g, (m, op: string, value: string) => {
    const en = dom!.translate(value);
    return en === null ? m : `aria-label${op}="${en.replace(/"/g, '\\"')}"`;
  });
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Плавная смена: новый вид проявляется поверх старого (View Transitions). Без поддержки – мгновенно:
 * затухание всей страницы выглядело бы миганием. Переходы элементов на время смены отключены, чтобы
 * ничего не доезжало после кроссфейда.
 */
function transition(change: () => void) {
  const root = document.documentElement;
  const start = (document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }).startViewTransition;
  if (reducedMotion() || !start) return change();
  root.classList.add('lang-switching');
  const vt = start.call(document, change);
  void vt.finished.finally(() => root.classList.remove('lang-switching'));
}

function applyLang(lang: Lang, t: DomTranslator) {
  document.documentElement.lang = lang;
  if (lang === 'en') t.start();
  else t.stop();
}

interface LangState {
  lang: Lang;
  setLang(lang: Lang): Promise<void>;
}

export const useLang = create<LangState>()((set, get) => ({
  lang: readLang(),
  setLang: async (lang) => {
    if (lang === get().lang && (lang === 'ru' || dom?.active)) return;
    localStore.set(LANG_KEY, lang);
    const t = await translator();
    if (typeof document === 'undefined') return set({ lang });
    // Перевод и перерисовка подписей – внутри перехода: снимок нового вида уже готовый, ничего не доезжает после
    transition(() => {
      flushSync(() => set({ lang }));
      applyLang(lang, t);
    });
  },
}));

/** Старт приложения: английский включается до первой отрисовки React (страница скрыта, пока грузится словарь). */
export async function initI18n(): Promise<void> {
  const root = document.documentElement;
  if (useLang.getState().lang !== 'en') {
    root.lang = 'ru';
    root.classList.remove('i18n-loading');
    // Словарь – заранее, в простое: первое переключение на английский без задержки на загрузку
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2000));
    idle(() => void translator());
    return;
  }
  try {
    applyLang('en', await translator());
  } finally {
    root.classList.remove('i18n-loading');
  }
}
