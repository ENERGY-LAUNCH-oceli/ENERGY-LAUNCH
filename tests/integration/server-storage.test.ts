import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { withCheckDigit } from '@/engine/invoice/format';

/**
 * Приложение и сервер хранилища вместе: настоящий процесс `node server/index.ts` (PostgreSQL – PGlite в памяти).
 * «Перезагрузка страницы» – новый экземпляр модулей приложения: состояние восстанавливается с сервера.
 */
let proc: ChildProcess;
let base: string;

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => resolve(port));
    });
  });

beforeAll(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}/api`;
  proc = spawn(process.execPath, ['server/index.ts'], { env: { ...process.env, AUTH_REQUIRED: '0', DATABASE_URL: '', PGLITE_DIR: 'memory://', API_PORT: String(port), API_HOST: '127.0.0.1' }, stdio: 'pipe' });
  let log = '';
  proc.stderr?.on('data', (d) => (log += d));
  proc.stdout?.on('data', (d) => (log += d));
  for (let i = 0; i < 300; i++) {
    if ((await fetch(`${base}/health`).then((r) => r.ok).catch(() => false)) === true) return;
    if (proc.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`сервер хранилища не запустился:\n${log}`);
}, 60_000);

afterAll(() => {
  proc?.kill();
});

const api = async <T,>(path: string): Promise<T> => (await fetch(base + path)).json() as Promise<T>;
const serverObjects = async () => (await api<{ objects: { id: string }[] }>('/state')).objects.map((o) => o.id);

/** Открыть приложение заново: свежие модули, загрузка портфеля и сохранённого состояния. */
async function boot() {
  vi.resetModules();
  const storage = await import('@/services/server-storage');
  storage.setApiBase(base);
  const store = await import('@/store');
  const objects = await import('@/data/objects');
  const err = vi.spyOn(console, 'error').mockImplementation(() => {});
  await store.useLaunchStore.getState().bootstrap(() => {});
  await store.useLaunchStore.getState().commitBootstrap();
  err.mockRestore();
  return { ...store, ...storage, catalog: objects.OBJECT_CATALOG };
}

const settle = async (app: Awaited<ReturnType<typeof boot>>) => {
  await app.useLaunchStore.getState().persistence.flush?.();
  await vi.waitFor(() => expect(app.useStorageStatus.getState().status).not.toBe('saving'));
};

const DRAFT = { name: 'Тестовое название', code: 'TESTOVOE-NAZVANIE', kind: 'Завод', city: 'Swansea', street: '455 South Church Street', postalCode: '29160', responsible: 'Инженер запуска', eanOfftake: withCheckDigit('54143000000000008'), eanInjection: withCheckDigit('54144568746856858'), pvCount: 2, batteryCount: 1 };

describe('хранение в PostgreSQL', () => {
  it('ход запуска и объекты переживают перезагрузку; сброс и удаление доходят до базы', async () => {
    localStorage.clear();
    let app = await boot();
    expect(app.useStorageStatus.getState()).toMatchObject({ mode: 'server', kind: 'pglite' });
    expect(app.useLaunchStore.getState().storageReady).toBe(true);

    const entry = app.useLaunchStore.getState().createObject(DRAFT);
    expect(app.useLaunchStore.getState().startStage('METER_HISTORY')).toBe(true);
    const before = app.useLaunchStore.getState().session!;
    expect(before.stages.METER_HISTORY.status).toBe('IN_PROGRESS');
    await settle(app);
    await vi.waitFor(async () => expect(await serverObjects()).toEqual([entry.id]));
    expect(app.useStorageStatus.getState().status).toBe('saved');

    // Другой браузер (пустой localStorage): объект и этап приходят с сервера
    localStorage.clear();
    app = await boot();
    expect(app.catalog.some((o) => o.id === entry.id)).toBe(true);
    app.useLaunchStore.getState().selectObject(entry.id);
    let s = app.useLaunchStore.getState();
    expect(s.session!.id).toBe(before.id);
    expect(s.session!.stages.METER_HISTORY.status).toBe('IN_PROGRESS');
    expect(Object.keys(s.session!.stages)).toEqual(Object.keys(before.stages));
    expect(s.auditLog.map((e) => e.action)).toContain('STAGE_STARTED');

    // Сброс портфеля: состояния удаляются, объект остаётся, журнал аудита – тоже
    await app.useLaunchStore.getState().resetPortfolio();
    await settle(app);
    app = await boot();
    app.useLaunchStore.getState().selectObject(entry.id);
    s = app.useLaunchStore.getState();
    expect(s.session!.stages.METER_HISTORY.status).not.toBe('IN_PROGRESS');
    // Номер сессии исходного портфеля детерминирован, но журнал состояния – только новый
    expect(s.auditLog.map((e) => e.action)).not.toContain('STAGE_STARTED');
    const audit = await api<{ events: { action: string }[] }>(`/audit?objectId=${entry.id}`);
    expect(audit.events.map((e) => e.action)).toContain('STAGE_STARTED');

    // Удаление объекта
    expect(app.useLaunchStore.getState().removeObject(entry.id)).toBe(true);
    await vi.waitFor(async () => expect(await serverObjects()).toEqual([]));
    localStorage.clear();
    app = await boot();
    expect(app.catalog.some((o) => o.id === entry.id)).toBe(false);
  }, 60_000);

  it('две вкладки: устаревшая не затирает новое состояние, изменения другой вкладки видны без перезагрузки', async () => {
    localStorage.clear();
    const old = await boot(); // вкладка, открытая давно
    const tab = await boot(); // вкладка, где идёт работа
    // Объект с начатым этапом 1 (в обеих вкладках одинаковый исходный портфель)
    const id = tab.catalog.find((o) => {
      tab.useLaunchStore.getState().selectObject(o.id);
      return ['IN_PROGRESS', 'BLOCKED'].includes(tab.useLaunchStore.getState().session!.stages.METER_HISTORY.status);
    })!.id;
    const other = tab.catalog.find((o) => o.id !== id)!.id;
    old.useLaunchStore.getState().selectObject(id);
    const runs = (app: typeof tab) => app.useLaunchStore.getState().auditLog.filter((e) => e.action === 'VALIDATION_RUN').length;
    const initialRuns = runs(old);
    const revision = async () => (await api<{ revisions: Record<string, number> }>('/revisions')).revisions[id] ?? 0;

    // Работа во второй вкладке доходит до сервера
    expect(tab.useLaunchStore.getState().validateStage('METER_HISTORY')).toBe(true);
    await settle(tab);
    const done = await revision();
    expect(done).toBeGreaterThan(0);
    expect(runs(tab)).toBe(initialRuns + 1);

    // Старая вкладка: переключение объектов ничего не меняет – и ничего не пишет
    old.useLaunchStore.getState().selectObject(other);
    old.useLaunchStore.getState().selectObject(id);
    await settle(old);
    expect(await revision()).toBe(done);

    // Действие в старой вкладке построено на устаревшем состоянии: сервер отклоняет, вкладка показывает актуальное
    old.useLaunchStore.getState().validateStage('METER_HISTORY');
    await settle(old);
    expect(await revision()).toBe(done);
    await vi.waitFor(() => expect(old.useLaunchStore.getState().auditLog.map((e) => e.id)).toEqual(tab.useLaunchStore.getState().auditLog.map((e) => e.id)));
    expect(old.useLaunchStore.getState().session).toEqual(tab.useLaunchStore.getState().session);

    // После обновления старая вкладка снова пишет нормально, а вторая получает её изменение сама (без перезагрузки)
    expect(old.useLaunchStore.getState().validateStage('METER_HISTORY')).toBe(true);
    await settle(old);
    expect(await revision()).toBe(done + 1);
    await vi.waitFor(() => expect(runs(tab)).toBe(initialRuns + 2), { timeout: 5000 });
    expect(tab.useLaunchStore.getState().session).toEqual(old.useLaunchStore.getState().session);
  }, 60_000);

  it('объекты, созданные раньше только в браузере, переносятся на сервер при первом подключении', async () => {
    localStorage.clear();
    const stored = { ...DRAFT, id: 'usr-legacy1', createdAt: '2026-11-06T15:00:00.000Z', name: 'Старый объект', code: 'OLD-1' };
    localStorage.setItem('el.objects.user', JSON.stringify([stored]));
    const app = await boot();
    expect(app.catalog.some((o) => o.id === 'usr-legacy1')).toBe(true);
    expect(await serverObjects()).toContain('usr-legacy1');
  }, 60_000);

  it('без сервера приложение работает в браузере, как раньше', async () => {
    const saved = base;
    base = 'http://127.0.0.1:9/api';
    try {
      const app = await boot();
      expect(app.useStorageStatus.getState().mode).toBe('browser');
      expect(app.useLaunchStore.getState().storageReady).toBe(false);
      expect(app.useLaunchStore.getState().currentObjectId).not.toBeNull();
    } finally {
      base = saved;
    }
  }, 60_000);
});
