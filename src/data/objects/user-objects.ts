import { createDashboardWorkspace } from '@/engine/dashboards';
import { eanProblem, gs1CheckDigit } from '@/engine/invoice/format';
import { parseObjectJson } from '@/engine/telemetry/passport';
import { demoObjectJson } from '@/data/mock';
import type { EnergyObject, LaunchInputs } from '@/types';
import { OBJECT_CATALOG, type ObjectCatalogEntry } from './catalog';
import { localStore } from '@/utils/local-store';

/**
 * Объекты, добавленные пользователем. Хранится только описание (паспорт из формы) – в браузере;
 * сессия запуска начинается с чистого листа, данные загружаются на страницах этапов.
 */
export interface UserObjectDraft {
  name: string;
  code: string;
  kind: string;
  city: string;
  street: string;
  postalCode: string;
  responsible: string;
  eanOfftake: string;
  eanInjection: string;
  pvCount: number;
  batteryCount: number;
  /** object_id из паспорта (объект создан из object.json): становится id объекта, если свободен – тогда паспорт, история и телеметрия относятся к нему же. */
  objectId?: string;
}

export interface StoredUserObject extends UserObjectDraft {
  id: string;
  createdAt: string;
}

const STORAGE_KEY = 'el.objects.user';
const EAN_LENGTH = 18;
/** Верхняя граница – защита от опечатки (лишний ноль), а не ограничение масштаба: крупные площадки – сотни установок. */
export const MAX_ASSETS = 2000;

export const EMPTY_DRAFT: UserObjectDraft = { name: '', code: '', kind: '', city: '', street: '', postalCode: '', responsible: '', eanOfftake: '', eanInjection: '', pvCount: 1, batteryCount: 0 };

/** Код объекта из названия: латиница/цифры, верхний регистр. */
export function suggestCode(name: string): string {
  const map: Record<string, string> = { а: 'A', б: 'B', в: 'V', г: 'G', д: 'D', е: 'E', ё: 'E', ж: 'ZH', з: 'Z', и: 'I', й: 'Y', к: 'K', л: 'L', м: 'M', н: 'N', о: 'O', п: 'P', р: 'R', с: 'S', т: 'T', у: 'U', ф: 'F', х: 'H', ц: 'C', ч: 'CH', ш: 'SH', щ: 'SCH', ы: 'Y', э: 'E', ю: 'YU', я: 'YA' };
  const latin = [...name.toLowerCase()].map((c) => map[c] ?? c).join('');
  return latin.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
}

/** Исправленный EAN: 17 цифр – дописать контрольную цифру; 18 с неверной – заменить последнюю. */
export function eanFix(code: string): string | null {
  const c = code.trim();
  if (/^\d{17}$/.test(c)) return c + gs1CheckDigit(c);
  if (/^\d{18}$/.test(c) && eanProblem(c, EAN_LENGTH)) return c.slice(0, 17) + gs1CheckDigit(c.slice(0, 17));
  return null;
}

/** Краткая запись диапазона активов: PV1…PV120. */
export const assetRange = (prefix: string, n: number) => (n <= 0 ? '' : n === 1 ? `${prefix}1` : n === 2 ? `${prefix}1, ${prefix}2` : `${prefix}1…${prefix}${n}`);

export type DraftErrors = Partial<Record<keyof UserObjectDraft, string>>;

/** Проверка формы. Коды объектов уникальны во всём портфеле. */
export function validateDraft(d: UserObjectDraft, catalog: ObjectCatalogEntry[] = OBJECT_CATALOG): DraftErrors {
  const e: DraftErrors = {};
  if (!d.name.trim()) e.name = 'Укажите название объекта';
  const code = d.code.trim();
  if (!code) e.code = 'Укажите код объекта';
  else if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code)) e.code = 'Латинские буквы, цифры, «-» и «_», от 2 до 32 символов';
  else if (catalog.some((o) => o.code.toUpperCase() === code.toUpperCase())) e.code = 'Объект с таким кодом уже есть';
  if (!d.city.trim()) e.city = 'Укажите город';
  if (!d.responsible.trim()) e.responsible = 'Укажите ответственного за запуск';
  const off = d.eanOfftake.trim();
  const inj = d.eanInjection.trim();
  const offProblem = off ? eanProblem(off, EAN_LENGTH) : 'Укажите EAN точки отбора';
  const injProblem = inj ? eanProblem(inj, EAN_LENGTH) : 'Укажите EAN точки отдачи';
  if (offProblem) e.eanOfftake = off ? `Некорректный EAN – ${offProblem}` : offProblem;
  if (injProblem) e.eanInjection = inj ? `Некорректный EAN – ${injProblem}` : injProblem;
  if (!offProblem && !injProblem && off === inj) e.eanInjection = 'EAN отбора и отдачи должны различаться';
  for (const k of ['pvCount', 'batteryCount'] as const) {
    if (!Number.isInteger(d[k]) || d[k] < 0 || d[k] > MAX_ASSETS) e[k] = `От 0 до ${MAX_ASSETS}`;
  }
  return e;
}

const trimDraft = (d: UserObjectDraft): UserObjectDraft => ({
  ...d,
  name: d.name.trim(),
  code: d.code.trim().toUpperCase(),
  kind: d.kind.trim(),
  city: d.city.trim(),
  street: d.street.trim(),
  postalCode: d.postalCode.trim(),
  responsible: d.responsible.trim(),
  eanOfftake: d.eanOfftake.trim(),
  eanInjection: d.eanInjection.trim(),
});

/** Запись каталога: паспорт из формы проходит тот же разбор object.json, что и загруженный файл. */
export function buildUserObject(stored: StoredUserObject): ObjectCatalogEntry {
  const d = trimDraft(stored);
  const equipment = [
    ...Array.from({ length: d.pvCount }, (_, i) => ({ id: `pv-${i + 1}`, type: 'pv' as const, prefix: `PV${i + 1}` })),
    ...Array.from({ length: d.batteryCount }, (_, i) => ({ id: `battery-${i + 1}`, type: 'battery' as const, prefix: `Battery${i + 1}` })),
  ];
  const json = demoObjectJson({ objectId: stored.id, name: d.name, street: d.street || null, postalCode: d.postalCode || null, city: d.city, ean: { offtake: d.eanOfftake, injection: d.eanInjection }, assets: equipment });
  const passport = parseObjectJson(json, { version: 1, source: 'UPLOAD', fileName: 'object.json', loadedAt: stored.createdAt });
  const address = [d.street, [d.postalCode, d.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const object: EnergyObject = {
    id: stored.id,
    code: d.code,
    name: d.name,
    type: 'HYBRID',
    status: 'LAUNCHING',
    passport: {
      objectId: stored.id,
      passportNumber: '',
      owner: '',
      operator: '',
      installedCapacityMw: 0,
      timezone: passport.timezone,
      location: { region: d.city, ...(address ? { address } : {}) },
      dataFiles: passport.dataFiles,
      documents: [],
    },
    gridConnection: { id: `gc-${stored.id}`, objectId: stored.id, gridOperator: '', pointOfConnection: '', voltageLevelKv: 0, maxCapacityMw: 0, meteringPointIds: [], eanOfftake: d.eanOfftake, eanInjection: d.eanInjection },
    assets: [],
    createdAt: stored.createdAt,
    updatedAt: stored.createdAt,
  };
  const inputs: LaunchInputs = { object, passport, controlTests: [], controlCommands: [], dashboards: [], dashboard: createDashboardWorkspace(stored.id, stored.createdAt, d.responsible) };
  return {
    id: stored.id,
    code: d.code,
    name: d.name,
    city: d.city,
    address: address || 'адрес не указан',
    kind: d.kind || 'Объект',
    assets: equipment.map((a) => a.prefix).join(' · ') || 'активов нет',
    assetCount: equipment.length,
    responsible: d.responsible,
    ean: { offtake: d.eanOfftake, injection: d.eanInjection },
    scenarioId: 'user',
    equipment,
    seedUntil: 'METER_HISTORY',
    seedAt: stored.createdAt,
    source: 'USER',
    inputs,
  };
}

export function loadStoredObjects(): StoredUserObject[] {
  return localStore.getJson<StoredUserObject[]>(STORAGE_KEY, [], Array.isArray).filter((o) => o && typeof o.id === 'string' && typeof o.name === 'string');
}

/** Список целиком (загружен с сервера): localStorage – его копия для синхронного старта. */
export function replaceStoredObjects(list: StoredUserObject[]): void {
  saveStoredObjects(list.filter((o) => o && typeof o.id === 'string' && typeof o.name === 'string'));
}

export const findStoredObject = (id: string) => loadStoredObjects().find((o) => o.id === id);

function saveStoredObjects(list: StoredUserObject[]): void {
  localStore.setJson(STORAGE_KEY, list);
}

/** Добавляет сохранённые объекты в портфель (после загрузки набора). Повреждённые записи пропускаются. */
export function attachStoredObjects(): void {
  for (const stored of loadStoredObjects()) {
    if (OBJECT_CATALOG.some((o) => o.id === stored.id)) continue;
    try {
      OBJECT_CATALOG.push(buildUserObject(stored));
    } catch (e) {
      console.warn('[objects] пропущен сохранённый объект', stored.id, e);
    }
  }
}

export function addUserObject(draft: UserObjectDraft, now = new Date()): ObjectCatalogEntry {
  const { objectId, ...rest } = trimDraft(draft);
  const own = objectId && /^[A-Za-z0-9._:-]{1,120}$/.test(objectId) && !OBJECT_CATALOG.some((o) => o.id.toLowerCase() === objectId.toLowerCase()) ? objectId : null;
  const stored: StoredUserObject = { ...rest, id: own ?? `usr-${now.getTime().toString(36)}`, createdAt: now.toISOString() };
  const entry = buildUserObject(stored);
  OBJECT_CATALOG.push(entry);
  saveStoredObjects([...loadStoredObjects(), stored]);
  return entry;
}

export function removeUserObject(id: string): boolean {
  const i = OBJECT_CATALOG.findIndex((o) => o.id === id && o.source === 'USER');
  if (i < 0) return false;
  OBJECT_CATALOG.splice(i, 1);
  saveStoredObjects(loadStoredObjects().filter((o) => o.id !== id));
  return true;
}
