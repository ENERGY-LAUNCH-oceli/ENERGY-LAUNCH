import { create } from 'zustand';
import { ROUTES } from '@/app/routes';
import { OBJECT_CATALOG, findObject, validateDraft } from '@/data/objects';
import { can, ROLE_TITLE } from '@/engine/dashboards';
import { importInvoice } from '@/services/invoice-import';
import { importPassport, importTelemetry } from '@/services/telemetry-import';
import { KIND_LABEL, planDrop, type DropKind, type DropPlan, type DroppedFile, type ObjectKey } from '@/services/file-route';
import { notify, useLaunchStore } from '@/store';
import type { StageId } from '@/types';

export const NEW_OBJECT = '__new__';

export interface DropResult {
  status: 'running' | 'ok' | 'error' | 'skipped';
  message?: string;
  href?: string;
}

interface DropState {
  open: boolean;
  analyzing: boolean;
  applying: boolean;
  done: boolean;
  /** Почему открыто окно (например, «файл не для этого поля»). */
  note: string | null;
  plans: DropPlan[];
  /** Выбор пользователя: id объекта или NEW_OBJECT. */
  targets: Record<string, string | null>;
  results: Record<string, DropResult>;
  analyze(files: DroppedFile[], note?: string): Promise<void>;
  setTarget(planId: string, target: string | null): void;
  apply(navigate: (to: string) => void): Promise<void>;
  close(): void;
  /** Открыть выбор файлов (кнопка «Загрузить файлы», меню правой кнопки). */
  pick(): void;
  registerPicker(fn: (() => void) | null): void;
}

let picker: (() => void) | null = null;

/** Объекты портфеля с актуальным паспортом (после загрузки исправленного object.json object_id мог измениться). */
export function objectKeys(): ObjectKey[] {
  const st = useLaunchStore.getState();
  return OBJECT_CATALOG.filter((e) => e.source !== 'SCENARIO').map((entry) => {
    const inputs = entry.id === st.currentObjectId ? st.inputs : (st.workspaces[entry.id]?.inputs ?? entry.inputs);
    const p = inputs?.passport;
    return { entry, ...(p ? { passportObjectId: p.objectId } : {}), ean: [entry.ean.offtake, entry.ean.injection, ...(p ? [p.ean.offtake, p.ean.injection] : [])].filter((e): e is string => !!e) };
  });
}

export const STAGE_OF: Record<Exclude<DropKind, 'unknown'>, StageId> = { invoice: 'METER_HISTORY', telemetry: 'REALTIME_TELEMETRY', passport: 'REALTIME_TELEMETRY' };
const SECTION = { invoice: 'history', telemetry: 'telemetry', passport: 'telemetry' } as const;
const ORDER: Record<DropKind, number> = { passport: 0, invoice: 1, telemetry: 2, unknown: 3 };

/** Входы объекта без переключения на него. */
const inputsOf = (id: string) => {
  const st = useLaunchStore.getState();
  return id === st.currentObjectId ? st.inputs : (st.workspaces[id]?.inputs ?? findObject(id)?.inputs ?? null);
};
/** Сделать объект текущим и вернуть свежее состояние хранилища (для синхронной записи сразу после). */
const select = (id: string) => {
  const st = useLaunchStore.getState();
  if (st.currentObjectId !== id) st.selectObject(id);
  return useLaunchStore.getState();
};

export const useDrop = create<DropState>()((set, get) => ({
  open: false,
  analyzing: false,
  applying: false,
  done: false,
  note: null,
  plans: [],
  targets: {},
  results: {},

  analyze: async (files, note) => {
    if (!files.length) return;
    set({ open: true, analyzing: true, done: false, note: note ?? null, plans: [], targets: {}, results: {} });
    const st = useLaunchStore.getState();
    const plans = await planDrop(files, objectKeys(), st.currentObjectId, st.actor);
    set({ analyzing: false, plans, targets: Object.fromEntries(plans.map((p) => [p.id, p.draft || p.withPassport ? NEW_OBJECT : p.objectId])) });
  },

  setTarget: (planId, target) => set((s) => ({ targets: { ...s.targets, [planId]: target } })),

  apply: async (navigate) => {
    const { plans, targets } = get();
    const todo = plans.filter((p) => p.kind !== 'unknown' && targets[p.id]).sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
    if (!todo.length) return;
    set({ applying: true });
    const result = (id: string, r: DropResult) => set((s) => ({ results: { ...s.results, [id]: r } }));
    const touched = new Set<string>();
    // Новые объекты из паспортов этой загрузки: id плана паспорта → id созданного объекта
    const created = new Map<string, string>();
    let lastHref = '';
    for (const p of todo) {
      result(p.id, { status: 'running' });
      try {
        const store = useLaunchStore.getState();
        if (!can(store.role, 'launch.manage')) throw new Error(`Роль «${ROLE_TITLE[store.role]}» не может загружать данные – смените роль в меню профиля`);
        const target = targets[p.id]!;
        const name = p.file.name;
        // Сначала файл разбирается целиком (асинхронно), потом выбор объекта и запись – синхронно, одним шагом:
        // страница объекта синхронизирует текущий объект с адресом и не успеет вмешаться между ними
        let objectId = target;
        if (target === NEW_OBJECT && !p.draft) {
          const id = p.withPassport ? created.get(p.withPassport) : undefined;
          if (!id) throw new Error('Новый объект не создан – выберите объект вручную');
          objectId = id;
        }
        if (target === NEW_OBJECT && p.draft) {
          const errors = Object.values(validateDraft(p.draft));
          if (errors.length) throw new Error(`Объект не создан: ${errors.join('; ')}`);
          const passport = await importPassport(p.file, { fileName: name });
          objectId = useLaunchStore.getState().createObject(p.draft).id;
          created.set(p.id, objectId);
          useLaunchStore.getState().importPassport(passport);
        } else if (p.kind === 'passport') {
          const passport = await importPassport(p.file, { fileName: name });
          select(objectId).importPassport(passport);
        } else if (p.kind === 'invoice') {
          const report = await importInvoice(p.file, store.ruleset.meterHistory, { fileName: name });
          select(objectId).importInvoiceReport(report);
        } else {
          const passport = inputsOf(objectId)?.passport;
          if (!passport) throw new Error('У объекта нет паспорта object.json – добавьте его в загрузку');
          const report = await importTelemetry(p.file, passport, store.ruleset.telemetry, { fileName: name });
          select(objectId).importTelemetryReport(report);
        }
        const kind = p.kind as Exclude<DropKind, 'unknown'>;
        const href = targets[p.id] === NEW_OBJECT && p.draft ? ROUTES.objectSection(objectId, 'launch') : ROUTES.objectSection(objectId, SECTION[kind]);
        touched.add(objectId);
        lastHref = href;
        result(p.id, { status: 'ok', message: `${KIND_LABEL[kind]} → ${findObject(objectId)?.name ?? objectId}`, href });
      } catch (e) {
        result(p.id, { status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    }
    for (const p of plans) if (!get().results[p.id]) result(p.id, { status: 'skipped', message: p.error ?? 'Не загружен: объект не выбран' });
    const ok = Object.values(get().results).filter((r) => r.status === 'ok').length;
    const failed = Object.values(get().results).filter((r) => r.status === 'error').length;
    set({ applying: false, done: true });
    if (ok) notify({ tone: failed ? 'warning' : 'success', title: `Загружено файлов: ${ok}${failed ? `, с ошибкой: ${failed}` : ''}`, description: `Объектов: ${touched.size}. Начатые этапы перепроверены автоматически.` });
    // Всё ушло в один объект без ошибок – сразу открываем нужный этап
    if (ok && !failed && touched.size === 1 && plans.every((p) => get().results[p.id]?.status === 'ok')) {
      set({ open: false });
      navigate(lastHref);
    }
  },

  close: () => !get().applying && set({ open: false }),
  pick: () => picker?.(),
  registerPicker: (fn) => {
    picker = fn;
  },
}));

/**
 * Файл, брошенный в поле загрузки этапа: подходит этому полю и объекту – грузится здесь, как раньше;
 * другой тип или другой объект – открывается окно с предложением загрузить его по назначению.
 */
export async function routeForField(file: File, expected: Exclude<DropKind, 'unknown'>): Promise<'here' | 'routed'> {
  const st = useLaunchStore.getState();
  const [plan] = await planDrop([{ file, path: file.name }], objectKeys(), st.currentObjectId, st.actor);
  if (!plan || plan.kind === 'unknown') return 'here';
  if (plan.kind === expected && (plan.objectId === st.currentObjectId || plan.match === 'current')) return 'here';
  const where = plan.objectId ? `объекта «${findObject(plan.objectId)?.name ?? plan.objectId}»` : 'другого объекта';
  const note = plan.kind !== expected ? `Это не ${KIND_LABEL[expected].toLowerCase()}, а ${KIND_LABEL[plan.kind].toLowerCase()}${plan.objectId && plan.objectId !== st.currentObjectId ? ` ${where}` : ''}. Загрузить по назначению?` : `Это файл ${where}, а не текущего. Загрузить туда?`;
  await useDrop.getState().analyze([{ file, path: file.name }], note);
  return 'routed';
}
