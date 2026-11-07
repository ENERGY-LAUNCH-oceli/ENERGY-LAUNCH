import { FAQ, type FaqItem } from './knowledge.ts';

/**
 * Помощник по сайту: подбирает ответ из базы знаний (FAQ) на вопрос своими словами.
 * Работает локально – без внешних ИИ-сервисов, ключей и оплаты за запросы: нормализация, упрощённая основа слова,
 * синонимы, исправление опечаток и ранжирование BM25. Текст вопроса – только данные для поиска, а не инструкции.
 * Файл без зависимостей от браузера и Node: его используют сервер (server/app.ts) и приложение (без сервера).
 */

export interface HelpMatch {
  item: FaqItem;
  /** 0…1 – насколько уверенно найден ответ. */
  confidence: number;
}

export interface HelpAnswer {
  /** Лучший ответ или null, если уверенного ответа нет. */
  best: HelpMatch | null;
  /** Другие подходящие вопросы. */
  alternatives: HelpMatch[];
}

/** Порог уверенности: ниже – «пока не знаю ответа», вопрос сохраняется для команды. */
export const CONFIDENCE_THRESHOLD = 0.45;

const STOP = new Set(
  (
    'а без бы был была были было быть в вам вас ваш во вот все всё вы где да даже для до его её ее если есть ещё еще же за здесь и из или им их ' +
    'к как какая какие каким каких какой когда ко кто ли либо мне мной могу можно мой моя на надо нам нас наш не него нет ни но ну о об ' +
    'один он она они оно от по под при про с со так там тебе то тоже только тут ты у уже хочу хотел хотела чего чем что чтобы эта эти это этот ' +
    'я подскажите скажите пожалуйста расскажите объясните помогите вопрос нужно нужен нужна почему зачем сколько сайт сайте сайта сделать делать ' +
    'будет будут мы меня себя свой своё свою свои всего всем очень просто вообще ли система системы систему системе системой'
  ).split(/\s+/),
);

/** Группы синонимов: все слова группы сводятся к первому. */
const SYNONYMS: string[][] = [
  ['объект', 'обьект', 'обект', 'завод', 'станция', 'площадка', 'здание', 'предприятие', 'object'],
  ['создать', 'добавить', 'завести', 'зарегистрировать', 'новый', 'add', 'create'],
  ['удалить', 'убрать', 'стереть', 'delete'],
  ['ean', 'еан', 'иан', 'ean18'],
  ['история', 'счетчик', 'счётчик', 'invoice', 'инвойс', 'учет', 'учёт'],
  ['телеметрия', 'telemetry', 'телеметрию', 'поток'],
  ['управление', 'команда', 'setpoint', 'сетпоинт', 'уставка'],
  ['дашборд', 'дешборд', 'панель', 'dashboard', 'виджет'],
  ['препятствие', 'блокер', 'blocker', 'проблема', 'ошибка'],
  ['журнал', 'аудит', 'лог', 'audit', 'log'],
  ['тема', 'оформление', 'темный', 'тёмный', 'ночной'],
  ['перезагрузка', 'перезагрузить', 'обновить', 'f5', 'reload'],
  ['паспорт', 'object.json', 'json'],
  ['батарея', 'аккумулятор', 'battery', 'накопитель'],
  ['pv', 'солнечный', 'панели', 'фотоэлектрический', 'солнце'],
  ['роль', 'права', 'доступ', 'полномочия'],
  ['файл', 'csv', 'выгрузка', 'загрузка', 'загрузить'],
  ['заблокирован', 'блокирован', 'blocked', 'застрял', 'стоит'],
  ['завершить', 'закончить', 'закрыть', 'complete'],
  ['протокол', 'отчет', 'отчёт', 'pdf'],
  ['сценарий', 'песочница', 'demo', 'демо'],
  ['обучение', 'тур', 'урок', 'инструкция', 'туториал'],
  ['вводить', 'ввести', 'вбивать', 'вбить', 'указать', 'указывать', 'заполнить', 'вписать'],
];

/** Слишком общие основы («система», «платформа» в смысле «сайт») – не помогают выбрать ответ. */
const STOP_STEMS = new Set(['систе', 'сист']);

const ENDINGS = ['иями', 'ями', 'ами', 'ией', 'ием', 'иях', 'ться', 'тся', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ешь', 'ях', 'ах', 'ых', 'их', 'ой', 'ей', 'ий', 'ый', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ую', 'юю', 'ом', 'ем', 'ов', 'ев', 'ам', 'ям', 'ть', 'ет', 'ют', 'ут', 'ит', 'ат', 'ят', 'ла', 'ло', 'ли', 'а', 'я', 'о', 'е', 'ы', 'и', 'у', 'ю', 'ь', 'й'];
const STEM_LEN = 5;

/** Упрощённая основа: снять окончание и оставить до 5 букв (объекта, объекты → объек). */
export function stem(word: string): string {
  if (/^[\da-z.]+$/.test(word)) return word;
  let w = word;
  for (const e of ENDINGS) {
    if (w.length - e.length >= 3 && w.endsWith(e)) {
      w = w.slice(0, -e.length);
      break;
    }
  }
  return w.slice(0, STEM_LEN);
}

const CANON = new Map<string, string>();
for (const group of SYNONYMS) {
  const head = stem(group[0]!);
  for (const w of group) CANON.set(stem(w.toLowerCase().replace(/ё/g, 'е')), head);
}

/** Слова вопроса → основы (без служебных слов, синонимы сведены). */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9.]+/g, ' ')
    .split(' ')
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => {
      const s = stem(w);
      return CANON.get(s) ?? s;
    })
    .filter((s) => !STOP_STEMS.has(s));
}

function trigrams(s: string): Set<string> {
  const t = new Set<string>();
  const p = `  ${s} `;
  for (let i = 0; i < p.length - 2; i++) t.add(p.slice(i, i + 3));
  return t;
}

const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};

interface Doc {
  item: FaqItem;
  tf: Map<string, number>;
  len: number;
}

/** Индекс базы знаний. Вес поля: вопрос ×3, ключевые слова ×2, ответ ×1. */
export function buildIndex(items: readonly FaqItem[] = FAQ) {
  const docs: Doc[] = items.map((item) => {
    const tf = new Map<string, number>();
    const add = (text: string, w: number) => {
      for (const t of tokens(text)) tf.set(t, (tf.get(t) ?? 0) + w);
    };
    add(item.q, 3);
    add(item.keywords, 2);
    add(item.a, 1);
    return { item, tf, len: [...tf.values()].reduce((a, b) => a + b, 0) };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length;
  const idf = new Map<string, number>();
  for (const [t, f] of df) idf.set(t, Math.log(1 + (n - f + 0.5) / (f + 0.5)));
  const avgLen = docs.reduce((a, d) => a + d.len, 0) / (n || 1);
  const vocab = [...df.keys()].map((t) => ({ t, g: trigrams(t) }));
  return { docs, idf, avgLen, vocab };
}

const DEFAULT_INDEX = buildIndex();

/** Неизвестное слово – ближайшее из словаря (опечатка), иначе null. */
function correct(t: string, index: ReturnType<typeof buildIndex>): string | null {
  if (index.idf.has(t)) return t;
  if (t.length < 4) return null;
  const g = trigrams(t);
  let best: string | null = null;
  let bestSim = 0.45;
  for (const v of index.vocab) {
    const sim = jaccard(g, v.g);
    if (sim > bestSim) {
      bestSim = sim;
      best = v.t;
    }
  }
  return best;
}

/** Ответ на вопрос: лучший вопрос базы знаний и похожие. */
export function answer(question: string, index = DEFAULT_INDEX): HelpAnswer {
  const raw = [...new Set(tokens(question.slice(0, 500)))];
  if (!raw.length) return { best: null, alternatives: [] };
  const terms: { t: string; w: number }[] = [];
  let unknown = 0;
  for (const t of raw) {
    const c = correct(t, index);
    if (c) terms.push({ t: c, w: c === t ? 1 : 0.7 });
    else unknown++;
  }
  const maxIdf = Math.max(...index.idf.values());
  const k1 = 1.2;
  const b = 0.5;
  const scored = index.docs
    .map((d) => {
      let score = 0;
      let matched = 0;
      for (const { t, w } of terms) {
        const f = d.tf.get(t);
        if (!f) continue;
        const idf = index.idf.get(t)!;
        score += w * idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / index.avgLen)));
        matched += w * idf;
      }
      return { d, score, matched };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);
  if (!scored.length) return { best: null, alternatives: [] };
  // Уверенность: какая доля «веса» слов вопроса нашлась в ответе (неизвестные слова считаются ненайденными)
  // и насколько лучший ответ отрывается от второго
  const totalIdf = terms.reduce((a, { t, w }) => a + w * index.idf.get(t)!, 0) + unknown * maxIdf * 0.6;
  const toMatch = (x: (typeof scored)[number]): HelpMatch => {
    const coverage = x.matched / (totalIdf || 1);
    const strength = Math.min(1, x.score / 6);
    return { item: x.d.item, confidence: Math.round(Math.min(1, 0.65 * coverage + 0.35 * strength) * 100) / 100 };
  };
  const top = toMatch(scored[0]!);
  const alternatives = scored
    .slice(1)
    .filter((x) => x.score >= scored[0]!.score * 0.55)
    .slice(0, 3)
    .map(toMatch);
  return top.confidence >= CONFIDENCE_THRESHOLD ? { best: top, alternatives } : { best: null, alternatives: [top, ...alternatives].slice(0, 3) };
}

/** Нормализованный вид вопроса – одинаковые по смыслу формулировки сливаются в одну запись. */
export const normalizeQuestion = (q: string) => [...new Set(tokens(q))].sort().join(' ');

/** Вопрос можно показать в общем FAQ: без ссылок, почты, телефонов и прочих личных данных. */
export function publishable(q: string): boolean {
  return !/(https?:\/\/|www\.|@|\+?\d[\d\s()-]{8,}\d|<|>)/i.test(q) && q.trim().length >= 6 && q.length <= 200;
}
