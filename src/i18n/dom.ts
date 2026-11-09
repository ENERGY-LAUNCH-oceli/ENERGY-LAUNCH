import { hasCyrillic, type Translator } from './translate';

/**
 * Перевод отрисованной страницы на месте: текстовые узлы и подписи (title, placeholder, aria-label, alt) меняют
 * значение, но не пересоздаются – React продолжает управлять теми же узлами. Оригинал запоминается, поэтому
 * возврат к русскому восстанавливает исходный текст. Перевод выполняется в MutationObserver – до отрисовки кадра,
 * без мигания русского текста.
 */

const ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'aria-description', 'aria-roledescription'] as const;
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE']);

export class DomTranslator {
  private on = false;
  private observer: MutationObserver | null = null;
  /** Исходный русский текст и последнее записанное нами значение. */
  private textOrig = new WeakMap<Text, string>();
  private textOurs = new WeakMap<Text, string>();
  private attrOrig = new WeakMap<Element, Map<string, string>>();
  private attrOurs = new WeakMap<Element, Map<string, string>>();
  /** Узлы с переводом – для восстановления русского. */
  private touchedText = new Set<WeakRef<Text>>();
  private touchedEl = new Set<WeakRef<Element>>();

  constructor(private readonly t: Translator) {}

  get active() {
    return this.on;
  }

  /** Перевод строки тем же словарём (null – перевода нет). */
  translate(text: string): string | null {
    return this.t.translate(text);
  }

  private skipped(node: Node): boolean {
    for (let el = node.nodeType === 1 ? (node as Element) : node.parentElement; el; el = el.parentElement) {
      if (SKIP.has(el.tagName) || el.hasAttribute('data-i18n-skip') || (el as HTMLElement).isContentEditable) return true;
    }
    return false;
  }

  private text(node: Text) {
    const value = node.data;
    if (this.textOurs.get(node) === value) return;
    if (!hasCyrillic(value) || this.skipped(node)) return;
    const en = this.t.translate(value);
    if (en === null) return;
    this.textOrig.set(node, value);
    this.textOurs.set(node, en);
    this.touchedText.add(new WeakRef(node));
    node.data = en;
  }

  private attrs(el: Element) {
    for (const name of ATTRS) {
      const value = el.getAttribute(name);
      if (value === null || !hasCyrillic(value)) continue;
      if (this.attrOurs.get(el)?.get(name) === value) continue;
      if (this.skipped(el) && el.tagName !== 'TEXTAREA') continue;
      const en = this.t.translate(value);
      if (en === null) continue;
      if (!this.attrOrig.has(el)) this.attrOrig.set(el, new Map());
      if (!this.attrOurs.has(el)) this.attrOurs.set(el, new Map());
      this.attrOrig.get(el)!.set(name, value);
      this.attrOurs.get(el)!.set(name, en);
      this.touchedEl.add(new WeakRef(el));
      el.setAttribute(name, en);
    }
  }

  private walk(root: Node) {
    if (root.nodeType === 3) return this.text(root as Text);
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) {
      if (SKIP.has((root as Element).tagName)) return;
      this.attrs(root as Element);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === 3) this.text(n as Text);
      else this.attrs(n as Element);
    }
  }

  /** Перевести страницу и следить за изменениями. */
  start() {
    if (this.on) return;
    this.on = true;
    this.walk(document.documentElement);
    this.observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'characterData') this.text(r.target as Text);
        else if (r.type === 'attributes') this.attrs(r.target as Element);
        else r.addedNodes.forEach((n) => this.walk(n));
      }
    });
    this.observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
  }

  /** Вернуть русский текст и перестать переводить. */
  stop() {
    if (!this.on) return;
    this.on = false;
    this.observer?.disconnect();
    this.observer = null;
    for (const ref of this.touchedText) {
      const node = ref.deref();
      if (node && this.textOurs.get(node) === node.data) node.data = this.textOrig.get(node)!;
    }
    for (const ref of this.touchedEl) {
      const el = ref.deref();
      if (!el) continue;
      const ours = this.attrOurs.get(el);
      this.attrOrig.get(el)?.forEach((orig, name) => {
        if (ours?.get(name) === el.getAttribute(name)) el.setAttribute(name, orig);
      });
    }
    this.touchedText.clear();
    this.touchedEl.clear();
    this.textOrig = new WeakMap();
    this.textOurs = new WeakMap();
    this.attrOrig = new WeakMap();
    this.attrOurs = new WeakMap();
  }
}
