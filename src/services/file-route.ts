import { OBJECT_CATALOG, suggestCode, type ObjectCatalogEntry, type UserObjectDraft } from '@/data/objects';
import { objectJsonSchema } from '@/engine/telemetry/passport';

/**
 * «Брось файл куда угодно»: по содержимому файла определяется, что это (история счётчиков, телеметрия, паспорт),
 * к какому объекту он относится и на какой этап его загрузить. Ничего не загружается без подтверждения –
 * результат распознавания показывается пользователю с объяснением, объект можно поменять.
 */

export type DropKind = 'invoice' | 'telemetry' | 'passport' | 'unknown';
export type MatchBy = 'object_id' | 'ean' | 'hash' | 'name' | 'new' | 'current' | 'none';

export interface DroppedFile {
  file: File;
  /** Путь внутри перетащенной папки (Building3/invoice.csv) или имя файла. */
  path: string;
}

export interface DropPlan {
  id: string;
  file: File;
  path: string;
  kind: DropKind;
  /** Объект, куда загрузить; null – не выбран (нет подходящего). */
  objectId: string | null;
  match: MatchBy;
  /** Почему выбран этот объект – для пользователя. */
  reason: string;
  /** Что нашлось в файле. */
  found: { objectId?: string; ean?: string[] };
  /** Паспорт объекта, которого нет в портфеле: из него можно создать новый объект. */
  draft?: UserObjectDraft;
  /** Файл относится к новому объекту из паспорта этой же загрузки (id плана паспорта). */
  withPassport?: string;
  /** Файл не распознан или не читается. */
  error?: string;
}

/** Сведения об объекте для сопоставления: каталог + актуальный паспорт из состояния (после загрузки исправленного). */
export interface ObjectKey {
  entry: ObjectCatalogEntry;
  passportObjectId?: string;
  ean: string[];
}

export const KIND_LABEL: Record<DropKind, string> = { invoice: 'История счётчиков · этап 1', telemetry: 'Телеметрия · этап 2', passport: 'Паспорт object.json', unknown: 'Не распознан' };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9а-яё]+/g, '');
const header = (h: string) => h.trim().replace(/^\uFEFF/, '').replace(/\s*\([^)]*\)\s*$/, '').toLowerCase();

/** Чтение текста и байтов файла; FileReader – запасной путь для окружений без Blob.text() (тесты на jsdom). */
const readText = (b: Blob): Promise<string> =>
  typeof b.text === 'function'
    ? b.text()
    : new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsText(b);
      });
const readBytes = (b: Blob): Promise<ArrayBuffer> =>
  typeof b.arrayBuffer === 'function'
    ? b.arrayBuffer()
    : new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as ArrayBuffer);
        r.onerror = () => reject(r.error);
        r.readAsArrayBuffer(b);
      });

async function sha256(file: File): Promise<string | null> {
  if (!globalThis.crypto?.subtle || file.size > 200 * 1024 * 1024) return null;
  const buf = await crypto.subtle.digest('SHA-256', await readBytes(file));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface Sniff {
  kind: DropKind;
  objectId?: string;
  ean?: string[];
  json?: Record<string, unknown>;
  error?: string;
}

/** Тип файла по первым строкам (CSV) или структуре (JSON). Большие файлы целиком не читаются. */
export async function sniff(file: File): Promise<Sniff> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) {
    if (file.size > 5 * 1024 * 1024) return { kind: 'unknown', error: 'JSON больше 5 МБ – это не паспорт объекта' };
    try {
      const j = JSON.parse((await readText(file)).replace(/^\uFEFF/, '')) as Record<string, unknown>;
      const grid = (j.grid_connection ?? {}) as Record<string, unknown>;
      if (typeof j.object_id === 'string' && (Array.isArray(j.assets) || j.grid_connection)) {
        // Неполный паспорт отмечается сразу, до загрузки – с понятной причиной
        const check = objectJsonSchema.safeParse(j);
        if (!check.success) {
          const issue = check.error.issues[0];
          return { kind: 'unknown', error: `object.json не соответствует формату${issue ? `: ${issue.path.join('.') || 'файл'} – ${issue.message}` : ''}` };
        }
        return { kind: 'passport', objectId: j.object_id, ean: [grid.ean_offtake, grid.ean_injection].filter((x): x is string => typeof x === 'string'), json: j };
      }
      return { kind: 'unknown', error: 'JSON без object_id и активов – не похож на паспорт объекта' };
    } catch {
      return { kind: 'unknown', error: 'Некорректный JSON' };
    }
  }
  if (!/\.(csv|txt)$/.test(name)) return { kind: 'unknown', error: 'Поддерживаются invoice.csv, telemetry.csv и object.json' };
  const head = (await readText(file.slice(0, 64 * 1024))).replace(/^\uFEFF/, '');
  const lines = head.split(/\r?\n/).filter((l) => l.trim());
  const first = lines[0] ?? '';
  const sep = first.split(';').length >= first.split(',').length ? ';' : ',';
  const cols = first.split(sep).map(header);
  const row = (lines[1] ?? '').split(sep).map((c) => c.trim());
  const col = (n: string) => cols.indexOf(n);
  if (cols.some((c) => c.includes('_invoice'))) {
    const ean = ['ean_offtake', 'ean_injection'].map((n) => row[col(n)]).filter((v): v is string => !!v && /^\d{8,}$/.test(v));
    return { kind: 'invoice', ean };
  }
  if (cols.includes('object_id') || cols.includes('grid.power_kw') || cols.some((c) => /^(pv|battery)\d*\./.test(c))) {
    const id = col('object_id') >= 0 ? row[col('object_id')] : undefined;
    return { kind: 'telemetry', ...(id ? { objectId: id } : {}) };
  }
  return { kind: 'unknown', error: 'Колонки не похожи ни на историю счётчиков, ни на телеметрию' };
}

/** Черновик объекта из паспорта (как форма «Новый объект»): название, адрес, EAN, число установок. */
export function draftFromPassport(j: Record<string, unknown>, actor: string, catalog: ObjectCatalogEntry[] = OBJECT_CATALOG): UserObjectDraft {
  const addr = (j.address ?? {}) as Record<string, unknown>;
  const grid = (j.grid_connection ?? {}) as Record<string, unknown>;
  const assets = Array.isArray(j.assets) ? (j.assets as Record<string, unknown>[]) : [];
  const name = typeof j.name === 'string' && j.name.trim() ? j.name.trim() : String(j.object_id);
  let code = suggestCode(name) || norm(String(j.object_id)).toUpperCase().slice(0, 24) || 'OBJECT';
  const taken = new Set(catalog.map((o) => o.code.toUpperCase()));
  for (let i = 2; taken.has(code); i++) code = `${suggestCode(name).slice(0, 20) || 'OBJECT'}-${i}`;
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    name,
    code,
    kind: 'Объект из object.json',
    city: s(addr.city),
    street: s(addr.street),
    postalCode: s(addr.postal_code),
    responsible: actor,
    eanOfftake: s(grid.ean_offtake),
    eanInjection: s(grid.ean_injection),
    pvCount: assets.filter((a) => String(a.type).toLowerCase() === 'pv').length,
    batteryCount: assets.filter((a) => String(a.type).toLowerCase() === 'battery').length,
    ...(typeof j.object_id === 'string' && j.object_id.trim() ? { objectId: j.object_id.trim() } : {}),
  };
}

/** Объект по имени файла или папки: id, код или папка набора (Building3). Берётся самое длинное совпадение. */
function byName(path: string, keys: ObjectKey[]): ObjectKey | null {
  const p = norm(path);
  let best: { k: ObjectKey; len: number } | null = null;
  for (const k of keys) {
    for (const t of [k.entry.id, k.entry.code, k.entry.folder, k.passportObjectId]) {
      const n = t ? norm(t) : '';
      if (n.length >= 3 && p.includes(n) && (!best || n.length > best.len)) best = { k, len: n.length };
    }
  }
  return best?.k ?? null;
}

let seq = 0;

/** Распознать файлы и предложить, куда их загрузить. currentObjectId – запасной вариант, если объект не определился. */
export async function planDrop(files: DroppedFile[], keys: ObjectKey[], currentObjectId: string | null, actor: string): Promise<DropPlan[]> {
  const plans: DropPlan[] = [];
  for (const { file, path } of files) {
    const base = { id: `drop-${++seq}`, file, path, found: {} as DropPlan['found'] };
    let s: Sniff;
    try {
      s = await sniff(file);
    } catch (e) {
      plans.push({ ...base, kind: 'unknown', objectId: null, match: 'none', reason: '', error: e instanceof Error ? e.message : 'Файл не читается' });
      continue;
    }
    if (s.kind === 'unknown') {
      plans.push({ ...base, kind: 'unknown', objectId: null, match: 'none', reason: '', error: s.error ?? 'Файл не распознан' });
      continue;
    }
    const found = { ...(s.objectId ? { objectId: s.objectId } : {}), ...(s.ean?.length ? { ean: s.ean } : {}) };
    const set = (k: ObjectKey | null, match: MatchBy, reason: string): DropPlan => ({ ...base, found, kind: s.kind, objectId: k?.entry.id ?? null, match, reason });

    const byId = s.objectId ? keys.find((k) => [k.entry.id, k.passportObjectId, k.entry.code].some((v) => v && v.toLowerCase() === s.objectId!.toLowerCase())) : undefined;
    if (byId) {
      plans.push(set(byId, 'object_id', `object_id «${s.objectId}» в файле совпадает с объектом`));
      continue;
    }
    const byEan = s.ean?.length ? keys.find((k) => s.ean!.some((e) => k.ean.includes(e))) : undefined;
    if (byEan) {
      plans.push(set(byEan, 'ean', `EAN ${s.ean!.join(', ')} в файле совпадает с точкой подключения объекта`));
      continue;
    }
    if (s.kind === 'passport' && s.json) {
      // Паспорта такого объекта нет в портфеле – предлагаем создать объект из него
      plans.push({ ...base, found, kind: 'passport', objectId: null, match: 'none', reason: `Объекта «${s.objectId}» нет в портфеле – можно создать его из этого паспорта`, draft: draftFromPassport(s.json, actor, keys.map((k) => k.entry)) });
      continue;
    }
    const hash = keys.some((k) => k.entry.fileHashes) ? await sha256(file).catch(() => null) : null;
    const byHash = hash ? keys.find((k) => Object.values(k.entry.fileHashes ?? {}).includes(hash)) : undefined;
    if (byHash) {
      plans.push(set(byHash, 'hash', 'Файл совпадает с файлом объекта из набора (SHA-256)'));
      continue;
    }
    const named = byName(path, keys);
    if (named) {
      plans.push(set(named, 'name', `Объект указан в имени ${path.includes('/') ? 'папки или файла' : 'файла'}: ${path}`));
      continue;
    }
    if (s.objectId || s.ean?.length) {
      // В файле указан объект, которого в портфеле нет: загрузка в другой объект провалит проверку привязки – не предлагаем её по умолчанию
      plans.push(set(null, 'none', `В файле ${s.objectId ? `object_id «${s.objectId}»` : `EAN ${s.ean!.join(', ')}`} – такого объекта в портфеле нет. Выберите объект вручную`));
      continue;
    }
    const cur = keys.find((k) => k.entry.id === currentObjectId) ?? null;
    plans.push(set(cur, cur ? 'current' : 'none', cur ? 'В файле нет object_id и EAN – выбран текущий объект, при необходимости поменяйте' : 'Объект по файлу не определён – выберите его'));
  }
  return linkNewObjectFiles(plans);
}

/**
 * Паспорт нового объекта брошен вместе с историей и телеметрией: файлы, не привязанные к существующему объекту,
 * относятся к новому – по object_id или EAN в файле, по object_id в имени файла, либо это единственный новый паспорт.
 */
function linkNewObjectFiles(plans: DropPlan[]): DropPlan[] {
  const drafts = plans.filter((p) => p.draft);
  if (!drafts.length) return plans;
  return plans.map((p) => {
    if (p.draft || p.kind === 'unknown' || p.kind === 'passport' || !['current', 'none'].includes(p.match)) return p;
    const name = p.path.toLowerCase();
    const hit =
      drafts.find((d) => d.found.objectId && (p.found.objectId?.toLowerCase() === d.found.objectId.toLowerCase() || name.includes(d.found.objectId.toLowerCase()))) ??
      drafts.find((d) => p.found.ean?.some((e) => d.found.ean?.includes(e))) ??
      (drafts.length === 1 && !p.found.objectId && !p.found.ean?.length ? drafts[0] : undefined);
    if (!hit) return p;
    return { ...p, objectId: null, match: 'new' as const, withPassport: hit.id, reason: `Относится к новому объекту «${hit.draft!.name}» из паспорта в этой же загрузке` };
  });
}

/** Файлы из перетаскивания, включая вложенные папки (Building1/…, весь набор кейса). */
export async function collectDropped(dt: DataTransfer): Promise<DroppedFile[]> {
  const items = [...dt.items].filter((i) => i.kind === 'file');
  const entries = items.map((i) => (i as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.() ?? null);
  if (!entries.some((e) => e?.isDirectory)) return [...dt.files].map((file) => ({ file, path: file.name }));
  const out: DroppedFile[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (out.length >= 200) return;
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push({ file, path: `${prefix}${file.name}` });
      return;
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries отдаёт папку частями – читаем до пустого ответа
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
    }
  };
  for (const e of entries) if (e) await walk(e, '');
  // Служебные и посторонние файлы папки (manifest.json, Configuration_file.json, картинки) не предлагаем
  return out.filter((f) => /\.(csv|json|txt)$/i.test(f.file.name) && !/^(manifest|configuration_file)\.json$/i.test(f.file.name));
}
