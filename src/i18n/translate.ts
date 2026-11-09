/**
 * Перевод русского текста на английский по словарю (en.json): точные строки и шаблоны с подстановками {0}, {1}…
 * Чистые функции без DOM – их использует слой перевода страницы (dom.ts) и тесты.
 *
 * Порядок: точная строка → правила дат и времени → шаблоны → перевод по частям (разделители «: », « · », «; »,
 * « / », скобки, тире). Из вариантов берётся тот, где меньше всего осталось русского текста; если ни один вариант
 * не уменьшил его – строка остаётся как есть (перевод одного слова внутри фразы хуже, чем исходная фраза).
 */

export interface Dictionary {
  /** Русский текст (пробелы схлопнуты) → английский. */
  exact: Record<string, string>;
  /** Русский шаблон с {0}, {1}… → английский с теми же подстановками. */
  templates: Record<string, string>;
}

const CYR = /[А-Яа-яЁё]/;
const CYR_G = /[А-Яа-яЁё]/g;
export const hasCyrillic = (s: string) => CYR.test(s);
const cyrCount = (s: string) => s.match(CYR_G)?.length ?? 0;

interface CompiledTemplate {
  re: RegExp;
  en: string;
  /** Длина литеральной части – более конкретные шаблоны проверяются первыми. */
  weight: number;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function compileTemplates(templates: Record<string, string>): CompiledTemplate[] {
  return Object.entries(templates)
    .map(([ru, en]) => {
      const parts = ru.split(/\{\d+\}/);
      const slots = [...ru.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
      let src = '^' + escapeRe(parts[0]!);
      // Подстановка может быть пустой: «({2}%{3})» – {3} пуст, когда ничего не округлялось
      for (let i = 0; i < slots.length; i++) {
        // Подстановка сразу за другой («{0}{1}») начинается со знака или пробела – иначе граница неоднозначна
        const glued = i > 0 && parts[i] === '';
        src += (glued ? `(?<s${slots[i]}>(?:[^\\p{L}\\p{N}_][\\s\\S]*?)?)` : `(?<s${slots[i]}>[\\s\\S]*?)`) + escapeRe(parts[i + 1]!);
      }
      return { re: new RegExp(src + '$', 'u'), en, weight: parts.join('').length };
    })
    .filter((t) => hasCyrillic(t.re.source))
    .sort((a, b) => b.weight - a.weight);
}

/* ---------- Даты и время, которые собираются в коде (date-fns, сокращения месяцев) ---------- */

const MONTHS: Record<string, string> = { янв: 'Jan', фев: 'Feb', мар: 'Mar', апр: 'Apr', май: 'May', июн: 'Jun', июл: 'Jul', авг: 'Aug', сен: 'Sep', окт: 'Oct', ноя: 'Nov', дек: 'Dec' };
const MONTH_RE = new RegExp(`^(\\d{1,2} )?(${Object.keys(MONTHS).join('|')})\\.?( \\d{2,4})?$`);
const UNITS: [RegExp, string][] = [
  [/^секунд[уы]?$/, 'second'],
  [/^минут[уы]?$/, 'minute'],
  [/^час(а|ов)?$/, 'hour'],
  [/^(день|дня|дней)$/, 'day'],
  [/^недел[юиь]$/, 'week'],
  [/^месяц(а|ев)?$/, 'month'],
  [/^(год|года|лет)$/, 'year'],
];
const unit = (word: string, n: number) => {
  const u = UNITS.find(([re]) => re.test(word))?.[1];
  return u ? `${n} ${u}${n === 1 ? '' : 's'}` : null;
};

/** «5 нояб. 2026 г., 10:00 UTC» – toLocaleString('ru-RU') */
const LONG_DATE = /^(\d{1,2}) (янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек)[а-яё]*\.? (\d{4}) г\.(.*)$/;

function dateRule(core: string): string | null {
  const long = LONG_DATE.exec(core);
  if (long) return `${long[1]} ${MONTHS[long[2]!.startsWith('ма') ? 'май' : long[2]!]} ${long[3]}${long[4]}`;
  const m = MONTH_RE.exec(core);
  if (m) return `${m[1] ?? ''}${MONTHS[m[2]!]}${m[3] ?? ''}`;
  const ago = /^(\d+) ([а-яё]+) назад$/.exec(core);
  if (ago) {
    const u = unit(ago[2]!, Number(ago[1]));
    return u ? `${u} ago` : null;
  }
  const inn = /^через (\d+) ([а-яё]+)$/.exec(core);
  if (inn) {
    const u = unit(inn[2]!, Number(inn[1]));
    return u ? `in ${u}` : null;
  }
  if (core === 'только что') return 'just now';
  return null;
}

/** Разделители «голова + остаток» – по первому вхождению. */
const HEAD_SEPS = [' · ', ': ', '; ', ' / ', ' → ', ' – ', ', '];

/** Разделители, по которым составная строка переводится частями: сначала крупные, затем ещё и все запятые. */
const SPLITS = [
  /(\s*:\s+|\s+·\s+|^·\s+|\s*;\s+|\s+\/\s+|\s+[–—]\s+|\s+→\s+|\s*\(|\)\s*|,\s+(?=[А-ЯЁA-Z]))/,
  /(\s*:\s+|\s+·\s+|^·\s+|\s*;\s+|\s+\/\s+|\s+[–—]\s+|\s+→\s+|\s*\(|\)\s*|,\s+)/,
];

export class Translator {
  private exact: Map<string, string>;
  private templates: CompiledTemplate[];
  private cache = new Map<string, string | null>();

  constructor(dict: Dictionary) {
    this.exact = new Map(Object.entries(dict.exact));
    this.templates = compileTemplates(dict.templates);
  }

  /** Перевод строки; null – перевода нет (остаётся как есть). Пробелы по краям сохраняются. */
  translate(text: string): string | null {
    if (!hasCyrillic(text)) return null;
    const cached = this.cache.get(text);
    if (cached !== undefined) return cached;
    const lead = /^\s*/.exec(text)![0];
    const trail = /\s*$/.exec(text)![0];
    const core = text.slice(lead.length, text.length - trail.length).replace(/\s+/g, ' ');
    const en = this.core(core, 0);
    const result = en === null || cyrCount(en) >= cyrCount(core) ? null : lead + en + trail;
    if (this.cache.size > 50_000) this.cache.clear();
    this.cache.set(text, result);
    return result;
  }

  /** Лучший перевод фрагмента или null. */
  private core(core: string, depth: number): string | null {
    if (!hasCyrillic(core)) return core;
    const hit = this.exact.get(core);
    if (hit !== undefined) return hit;
    const date = dateRule(core);
    if (date !== null) return date;
    if (depth > 4) return null;

    let best: string | null = null;
    const consider = (candidate: string | null) => {
      if (candidate !== null && (best === null || cyrCount(candidate) < cyrCount(best))) best = candidate;
    };
    for (const t of this.templates) {
      const m = t.re.exec(core);
      if (!m) continue;
      // Подстановки сами могут быть русским текстом (название этапа, причина) – переводятся рекурсивно
      consider(
        t.en.replace(/\{(\d+)\}/g, (_, i: string) => {
          const v = m.groups?.[`s${i}`] ?? '';
          if (!hasCyrillic(v)) return v;
          const inner = v.trim();
          const en = this.core(inner, depth + 1);
          return en === null ? v : v.replace(inner, en);
        }),
      );
      if (best !== null && !hasCyrillic(best)) return best;
    }
    // Составная строка: «TM-011: Сигналы батарей», «· История счётчиков», «Батареи · 1»
    // «Голова + остаток»: «MH-002 · История покрывает 19 из 24 месяцев; нет данных: …» – остаток переводится
    // целиком, чтобы сработал его шаблон (дробление по всем разделителям сразу ломает шаблон)
    for (const sep of HEAD_SEPS) {
      if (best !== null && !hasCyrillic(best)) break;
      const i = core.indexOf(sep);
      if (i <= 0 || i + sep.length >= core.length) continue;
      const head = core.slice(0, i);
      const rest = core.slice(i + sep.length);
      const h = hasCyrillic(head) ? this.core(head, depth + 1) : head;
      const r = this.core(rest, depth + 1);
      if (h !== null || r !== null) consider(`${h ?? head}${sep}${r ?? rest}`);
    }
    for (const split of SPLITS) {
      if (best !== null && !hasCyrillic(best)) break;
      const parts = core.split(split);
      if (parts.length < 2) continue;
      consider(
        parts
          .map((p, i) => {
            if (i % 2 === 1 || !hasCyrillic(p)) return p;
            const inner = p.trim();
            const en = this.core(inner, depth + 1);
            return en === null ? p : p.replace(inner, en);
          })
          .join(''),
      );
    }
    return best;
  }
}
