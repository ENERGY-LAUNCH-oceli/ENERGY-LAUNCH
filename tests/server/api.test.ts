// @vitest-environment node
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHandler } from '../../server/app.ts';
import { openDb, type Db } from '../../server/db.ts';
import { migrate, MIGRATIONS } from '../../server/migrations.ts';

/** API хранилища на настоящем движке PostgreSQL (PGlite в памяти): SQL, триггеры, транзакции. */
let db: Db;
let server: Server;
let base: string;

beforeAll(async () => {
  db = await openDb({ pgliteDir: 'memory://' });
  await migrate(db);
  server = createServer(createHandler(db, { maxBodyBytes: 64 * 1024, version: 'test' }));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60_000);

afterAll(async () => {
  await new Promise((r) => server.close(r));
  await db.close();
});

beforeEach(async () => {
  await db.query('delete from workspaces');
  await db.query('delete from user_objects');
});

const json = (method: string, body?: unknown, headers: Record<string, string> = {}) => ({ method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const api = (path: string, init?: RequestInit) => fetch(base + path, init);

const event = (id: string, objectId: string, sessionId: string, action = 'STAGE_STARTED') => ({ id, action, actor: 'Инженер запуска', timestamp: '2026-11-06T12:00:00.000Z', sessionId, objectId, rulesetVersion: '1.5.0', payload: { b: 2, a: 1 } });
const workspace = (objectId: string, sessionId: string, auditLog = [event(`${sessionId}-e1`, objectId, sessionId)]) => ({
  scenarioId: 'user',
  // Порядок ключей этапов важен для интерфейса – база не должна его менять
  session: { id: sessionId, objectId, rulesetVersion: '1.5.0', stages: { METER_HISTORY: { status: 'COMPLETED' }, REALTIME_TELEMETRY: { status: 'IN_PROGRESS' }, ASSET_CONTROL: { status: 'NOT_STARTED' } } },
  inputs: { object: { id: objectId, code: 'TESTOVOE-NAZVANIE' }, controlTests: [], dashboards: [] },
  auditLog,
});

describe('API хранилища', () => {
  it('health сообщает вид хранилища', async () => {
    const r = await api('/api/health');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, storage: 'pglite', version: 'test' });
    expect(r.headers.get('cache-control')).toBe('no-store');
  });

  it('миграции идемпотентны', async () => {
    expect(await migrate(db)).toBe(MIGRATIONS.at(-1)!.version);
    const rows = await db.query<{ n: number }>('select count(*)::int as n from schema_migrations');
    expect(rows[0]!.n).toBe(MIGRATIONS.length);
  });

  it('состояние объекта сохраняется и возвращается без изменений (порядок ключей, журнал)', async () => {
    const ws = workspace('usr-mw5433aj', 'sess-1');
    const put = await api('/api/workspaces/usr-mw5433aj', json('PUT', ws));
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({ revision: 1, auditInserted: 1 });

    const again = await api('/api/workspaces/usr-mw5433aj', json('PUT', { ...ws, auditLog: [...ws.auditLog, event('sess-1-e2', 'usr-mw5433aj', 'sess-1', 'STAGE_COMPLETED')] }));
    expect(await again.json()).toMatchObject({ revision: 2, auditInserted: 1 });

    const state = (await (await api('/api/state')).json()) as { workspaces: { objectId: string; session: { stages: object }; auditLog: { id: string; payload: object }[]; revision: number }[] };
    expect(state.workspaces).toHaveLength(1);
    const saved = state.workspaces[0]!;
    expect(saved).toMatchObject({ objectId: 'usr-mw5433aj', scenarioId: 'user', revision: 2, inputs: ws.inputs });
    expect(Object.keys(saved.session.stages)).toEqual(['METER_HISTORY', 'REALTIME_TELEMETRY', 'ASSET_CONTROL']);
    expect(saved.auditLog.map((e) => e.id)).toEqual(['sess-1-e1', 'sess-1-e2']);
    expect(Object.keys(saved.auditLog[0]!.payload)).toEqual(['b', 'a']);
  });

  it('новая сессия объекта (сброс) – в состоянии только её журнал, старые записи остаются в базе', async () => {
    await api('/api/workspaces/obj-001', json('PUT', workspace('obj-001', 'old')));
    await api('/api/workspaces/obj-001', json('PUT', workspace('obj-001', 'new')));
    const state = (await (await api('/api/state')).json()) as { workspaces: { auditLog: { id: string }[] }[] };
    expect(state.workspaces[0]!.auditLog.map((e) => e.id)).toEqual(['new-e1']);
    // Тот же номер сессии после сброса (исходный портфель детерминирован): прежние события в состояние не возвращаются
    await api('/api/workspaces/obj-001', json('PUT', workspace('obj-001', 'new', [event('new-e1', 'obj-001', 'new'), event('new-e2', 'obj-001', 'new')])));
    await api('/api/workspaces/obj-001', json('PUT', workspace('obj-001', 'new', [event('new-e1', 'obj-001', 'new')])));
    const reset = (await (await api('/api/state')).json()) as typeof state;
    expect(reset.workspaces[0]!.auditLog.map((e) => e.id)).toEqual(['new-e1']);
    const all = (await (await api('/api/audit?objectId=obj-001')).json()) as { events: { id: string }[] };
    expect(all.events.map((e) => e.id)).toEqual(expect.arrayContaining(['old-e1', 'new-e1']));
  });

  it('журнал аудита только дополняется: UPDATE, DELETE и TRUNCATE запрещены', async () => {
    await api('/api/audit', json('POST', { events: [event('immutable-1', 'obj-002', 's2')] }));
    await expect(db.query("update audit_events set actor = 'x' where id = 'immutable-1'")).rejects.toThrow(/только дополняется/);
    await expect(db.query("delete from audit_events where id = 'immutable-1'")).rejects.toThrow(/только дополняется/);
    await expect(db.query('truncate audit_events')).rejects.toThrow(/только дополняется/);
    // Повторная отправка того же события не создаёт дубль
    const r = await api('/api/audit', json('POST', { events: [event('immutable-1', 'obj-002', 's2')] }));
    expect(await r.json()).toEqual({ inserted: 0 });
  });

  it('объекты пользователя: создание, обновление, удаление вместе с состоянием', async () => {
    const o = { id: 'usr-mw5433aj', createdAt: '2026-11-06T15:00:00.000Z', name: 'Тестовое название', code: 'TESTOVOE-NAZVANIE', kind: 'Завод', pvCount: 154, batteryCount: 90 };
    expect((await api('/api/objects/usr-mw5433aj', json('PUT', o))).status).toBe(204);
    expect((await api('/api/objects/usr-mw5433aj', json('PUT', { ...o, name: 'Новое имя' }))).status).toBe(204);
    await api('/api/workspaces/usr-mw5433aj', json('PUT', workspace('usr-mw5433aj', 'su')));
    let state = (await (await api('/api/state')).json()) as { objects: { name: string }[]; workspaces: unknown[] };
    expect(state.objects).toEqual([{ ...o, name: 'Новое имя' }]);
    expect(state.workspaces).toHaveLength(1);

    expect((await api('/api/objects/usr-mw5433aj', { method: 'DELETE' })).status).toBe(204);
    state = (await (await api('/api/state')).json()) as typeof state;
    expect(state).toEqual({ objects: [], workspaces: [] });
  });

  it('сброс портфеля удаляет состояния всех объектов', async () => {
    await api('/api/workspaces/obj-001', json('PUT', workspace('obj-001', 'a')));
    await api('/api/workspaces/obj-002', json('PUT', workspace('obj-002', 'b')));
    expect((await api('/api/workspaces', { method: 'DELETE' })).status).toBe(204);
    expect(((await (await api('/api/state')).json()) as { workspaces: unknown[] }).workspaces).toEqual([]);
  });

  describe('помощник по сайту', () => {
    type Ask = { answer: { id: string; a: string; lesson: string | null } | null; alternatives: { id: string }[]; saved: boolean; published: boolean };
    type Questions = { questions: { text: string; faqId: string; count: number }[] };
    const ask = async (question: string) => (await api('/api/help/ask', json('POST', { question }))).json() as Promise<Ask>;

    it('отвечает из базы знаний и переносит вопрос в FAQ; одинаковые формулировки – одна запись со счётчиком', async () => {
      await db.query('delete from help_questions');
      const r = await ask('Как добавить новый завод?');
      expect(r).toMatchObject({ answer: { id: 'create-object', lesson: 'objects' }, saved: true, published: true });
      await ask('как добавить новый завод');
      const list = (await (await api('/api/help/questions')).json()) as Questions;
      expect(list.questions).toEqual([expect.objectContaining({ text: 'Как добавить новый завод?', faqId: 'create-object', count: 2 })]);
    });

    it('без уверенного ответа вопрос сохраняется, но в общий FAQ не попадает', async () => {
      await db.query('delete from help_questions');
      const r = await ask('какая погода в Москве');
      expect(r).toMatchObject({ answer: null, saved: true, published: false });
      expect((await db.query<{ n: number }>('select count(*)::int as n from help_questions'))[0]!.n).toBe(1);
      expect(((await (await api('/api/help/questions')).json()) as Questions).questions).toEqual([]);
    });

    it('личные данные в вопросе: ответ есть, но вопрос не публикуется', async () => {
      await db.query('delete from help_questions');
      const r = await ask('как создать объект, напишите на ivan@mail.ru');
      expect(r).toMatchObject({ answer: { id: 'create-object' }, published: false });
      expect(((await (await api('/api/help/questions')).json()) as Questions).questions).toEqual([]);
    });

    it('проверяет длину вопроса', async () => {
      expect((await api('/api/help/ask', json('POST', { question: 'a' }))).status).toBe(400);
      expect((await api('/api/help/ask', json('POST', { question: 'x'.repeat(301) }))).status).toBe(400);
    });
  });

  describe('отклоняет некорректные запросы', () => {
    it('состояние другого объекта и чужие события журнала', async () => {
      const r1 = await api('/api/workspaces/obj-001', json('PUT', workspace('obj-002', 's')));
      expect(r1.status).toBe(400);
      const r2 = await api('/api/workspaces/obj-001', json('PUT', workspace('obj-001', 's', [event('x', 'obj-999', 's')])));
      expect(r2.status).toBe(400);
      expect(((await api('/api/state').then((r) => r.json())) as { workspaces: unknown[] }).workspaces).toEqual([]);
    });

    it('недопустимый идентификатор, не JSON, неверный тип содержимого, слишком большое тело', async () => {
      expect((await api(`/api/workspaces/${encodeURIComponent("a'; drop table workspaces; --")}`, json('PUT', workspace('obj-001', 's')))).status).toBe(400);
      expect((await api('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status).toBe(400);
      expect((await api('/api/audit', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"events":[]}' })).status).toBe(415);
      const big = workspace('obj-001', 's');
      (big.inputs as Record<string, unknown>).blob = 'x'.repeat(70 * 1024);
      expect((await api('/api/workspaces/obj-001', json('PUT', big))).status).toBe(413);
      // Таблицы на месте
      expect((await api('/api/state')).status).toBe(200);
    });

    it('запрос с другого сайта', async () => {
      const r = await api('/api/workspaces', { method: 'DELETE', headers: { 'Sec-Fetch-Site': 'cross-site' } });
      expect(r.status).toBe(403);
    });

    it('неизвестный путь и метод', async () => {
      expect((await api('/api/nope')).status).toBe(404);
      expect((await api('/api/state', { method: 'POST' })).status).toBe(405);
    });

    it('битое событие журнала (без даты)', async () => {
      const r = await api('/api/audit', json('POST', { events: [{ id: 'e', action: 'X', actor: 'a', timestamp: 'вчера' }] }));
      expect(r.status).toBe(400);
      expect(((await r.json()) as { error: string }).error).toMatch(/timestamp/);
    });
  });
});
