import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { answer, normalizeQuestion, publishable } from '../src/help/agent.ts';
import { authRoutes, AuthError, guard } from './auth.ts';
import type { Db } from './db.ts';

/**
 * HTTP API хранилища. Сервер хранит то, что прислал клиент, и не принимает решений о запуске:
 * статусы этапов вычисляет движок в приложении. Журнал аудита только дополняется.
 */

const ID = z.string().regex(/^[A-Za-z0-9._:-]{1,120}$/, 'недопустимый идентификатор');
const ISO = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'ожидается дата ISO 8601');

const auditEvent = z.looseObject({
  id: ID,
  action: z.string().min(1).max(64),
  actor: z.string().max(200),
  timestamp: ISO,
  sessionId: ID.optional(),
  objectId: ID.optional(),
  stageId: z.string().max(64).optional(),
  rulesetVersion: z.string().max(32).optional(),
});

const userObject = z.looseObject({
  id: ID,
  createdAt: ISO,
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(64),
  pvCount: z.number().int().min(0),
  batteryCount: z.number().int().min(0),
});

const workspaceBody = z.object({
  scenarioId: z.string().max(120).nullable(),
  session: z.looseObject({ id: ID, objectId: ID, rulesetVersion: z.string().min(1).max(32) }),
  inputs: z.looseObject({ object: z.looseObject({ id: ID }) }),
  auditLog: z.array(auditEvent).max(50_000),
  /** Ревизия, от которой клиент строил изменения (0 – состояния ещё нет): другая на сервере – запись отклоняется (409), устаревшая вкладка не затрёт новое. Без неё – тоже 409. */
  baseRevision: z.number().int().min(0).optional(),
});

export type AuditEventRow = z.infer<typeof auditEvent>;
export interface SavedWorkspace {
  objectId: string;
  scenarioId: string | null;
  inputs: unknown;
  session: unknown;
  auditLog: unknown[];
  revision: number;
  updatedAt: string;
}

class HttpError extends Error {
  readonly status: number;
  readonly extra: Record<string, unknown> | undefined;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export interface AppOptions {
  /** Предел тела запроса: состояние крупного объекта – сотни КБ, с историей загрузок – единицы МБ. */
  maxBodyBytes?: number;
  version?: string;
  /** Вход обязателен для всего API данных (AUTH_REQUIRED=1). По умолчанию – нет: демо-режим без входа, личный кабинет по желанию. */
  authRequired?: boolean;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

async function readJson(req: IncomingMessage, limit: number): Promise<unknown> {
  const type = req.headers['content-type'] ?? '';
  // Только JSON: обычная HTML-форма с чужого сайта не может отправить такой запрос без CORS-согласования
  if (!/^application\/json\b/i.test(type)) throw new HttpError(415, 'ожидается Content-Type: application/json');
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > limit) throw new HttpError(413, `тело запроса больше ${limit} байт`);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, `тело запроса больше ${limit} байт`);
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'некорректный JSON');
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new HttpError(400, `некорректные данные${issue ? `: ${issue.path.join('.') || 'тело'} – ${issue.message}` : ''}`);
  }
  return r.data;
}

function send(res: ServerResponse, status: number, body?: unknown): void {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (body === undefined) {
    res.end();
    return;
  }
  const text = JSON.stringify(body);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(text));
  res.end(text);
}

function sameOrigin(req: IncomingMessage, origin: string): boolean {
  try {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = typeof forwardedProto === 'string' && forwardedProto.split(',')[0] ? forwardedProto.split(',')[0]!.trim() : 'http';
    return new URL(origin).origin === `${protocol}://${req.headers.host ?? ''}`;
  } catch {
    return false;
  }
}

/** Запись событий журнала: повторная отправка того же события игнорируется (идемпотентность по id). */
async function appendAudit(q: Db['query'], events: readonly AuditEventRow[], actor?: string): Promise<number> {
  let inserted = 0;
  for (const e of events) {
    const recorded = actor ? { ...e, actor } : e;
    const rows = await q<{ id: string }>(
      `insert into audit_events (id, session_id, object_id, stage_id, action, actor, ts, ruleset_version, event)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::json) on conflict (id) do nothing returning id`,
      [recorded.id, recorded.sessionId ?? null, recorded.objectId ?? null, recorded.stageId ?? null, recorded.action, recorded.actor, recorded.timestamp, recorded.rulesetVersion ?? null, JSON.stringify(recorded)],
    );
    inserted += rows.length;
  }
  return inserted;
}

export function createHandler(db: Db, opts: AppOptions = {}) {
  const limit = opts.maxBodyBytes ?? 32 * 1024 * 1024;

  /** Сохранённые состояния (все или одного объекта) с журналом – ровно те события и в том порядке, что были у клиента при сохранении. */
  async function loadWorkspaces(objectId?: string): Promise<SavedWorkspace[]> {
    const where = objectId ? 'where w.object_id = $1' : '';
    const params = objectId ? [objectId] : [];
    const ws = await db.query<{ object_id: string; scenario_id: string | null; session_id: string; inputs: unknown; session: unknown; revision: number; updated_at: unknown }>(
      `select object_id, scenario_id, session_id, inputs, session, revision, updated_at from workspaces w ${where} order by object_id`,
      params,
    );
    const events = await db.query<{ object_id: string; event: unknown }>(
      `select w.object_id, e.event from workspaces w
         cross join lateral json_array_elements_text(w.audit_ids) with ordinality as a(id, ord)
         join audit_events e on e.id = a.id
       ${where}
       order by w.object_id, a.ord`,
      params,
    );
    const byObject = new Map<string, unknown[]>();
    for (const e of events) byObject.set(e.object_id, [...(byObject.get(e.object_id) ?? []), e.event]);
    return ws.map((w) => ({ objectId: w.object_id, scenarioId: w.scenario_id, inputs: w.inputs, session: w.session, auditLog: byObject.get(w.object_id) ?? [], revision: Number(w.revision), updatedAt: iso(w.updated_at) }));
  }

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '');
    const method = req.method ?? 'GET';
    // Запросы со сторонних сайтов отклоняются (браузер помечает их Sec-Fetch-Site)
    if (req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'запрос с другого сайта отклонён');
    const origin = req.headers.origin;
    if (origin && !sameOrigin(req, origin)) throw new HttpError(403, 'запрос с другого источника отклонён');

    if (path === '/api/health' && method === 'GET') {
      await db.query('select 1');
      return send(res, 200, { ok: true, storage: db.kind, version: opts.version ?? null });
    }

    // Вход, личный кабинет, админ-панель; остальной API – только для вошедших (если сотрудники заведены)
    if (await authRoutes(db, req, res, path, method, () => readJson(req, limit), send, opts.authRequired)) return;
    const user = opts.authRequired ? await guard(db, req, path) : null;

    if (path === '/api/state' && method === 'GET') {
      const objects = await db.query<{ data: unknown }>('select data from user_objects order by created_at, id');
      return send(res, 200, { objects: objects.map((o) => o.data), workspaces: await loadWorkspaces() });
    }

    // Ревизии состояний – лёгкий опрос: вкладка подгружает только объекты, изменённые в другом месте
    if (path === '/api/revisions' && method === 'GET') {
      const rows = await db.query<{ object_id: string; revision: number }>('select object_id, revision from workspaces order by object_id');
      return send(res, 200, { revisions: Object.fromEntries(rows.map((r) => [r.object_id, Number(r.revision)])) });
    }

    const obj = /^\/api\/objects\/([^/]+)$/.exec(path);
    if (obj) {
      const id = parse(ID, decodeURIComponent(obj[1]!));
      if (method === 'PUT') {
        const body = parse(userObject, await readJson(req, limit));
        if (body.id !== id) throw new HttpError(400, 'id в адресе и в теле не совпадают');
        await db.query(
          `insert into user_objects (id, data, created_at) values ($1, $2::json, $3)
           on conflict (id) do update set data = excluded.data, updated_at = now()`,
          [id, JSON.stringify(body), body.createdAt],
        );
        return send(res, 204);
      }
      if (method === 'DELETE') {
        // Объект и его состояние удаляются; записи журнала аудита остаются
        await db.transaction(async (tx) => {
          await tx.query('delete from workspaces where object_id = $1', [id]);
          await tx.query('delete from user_objects where id = $1', [id]);
        });
        return send(res, 204);
      }
    }

    if (path === '/api/workspaces' && method === 'DELETE') {
      await db.query('delete from workspaces');
      return send(res, 204);
    }

    const wsMatch = /^\/api\/workspaces\/([^/]+)$/.exec(path);
    if (wsMatch && method === 'GET') {
      const [w] = await loadWorkspaces(parse(ID, decodeURIComponent(wsMatch[1]!)));
      return w ? send(res, 200, w) : send(res, 404, { error: 'состояние объекта не сохранено', revision: 0 });
    }
    if (wsMatch && method === 'PUT') {
      const objectId = parse(ID, decodeURIComponent(wsMatch[1]!));
      const body = parse(workspaceBody, await readJson(req, limit));
      if (body.session.objectId !== objectId || body.inputs.object.id !== objectId) throw new HttpError(400, 'состояние относится к другому объекту');
      const foreign = body.auditLog.find((e) => e.objectId !== undefined && e.objectId !== objectId);
      if (foreign) throw new HttpError(400, `событие ${foreign.id} относится к другому объекту`);
      const result = await db.transaction(async (tx) => {
        const base = body.baseRevision;
        const conflict = (revision: number) => new HttpError(409, 'состояние объекта уже изменено в другой вкладке или другим пользователем', { revision });
        const [cur] = await tx.query<{ revision: number }>('select revision from workspaces where object_id = $1 for update', [objectId]);
        const current = Number(cur?.revision ?? 0);
        // Без ревизии пишет вкладка со старой версией приложения – слепая перезапись затёрла бы чужие изменения
        if (base === undefined) throw new HttpError(409, 'вкладка открыта со старой версией приложения – обновите страницу', { revision: current });
        if (current !== base) throw conflict(current);
        const rows = await tx.query<{ revision: number; updated_at: unknown }>(
          `insert into workspaces (object_id, session_id, scenario_id, ruleset_version, inputs, session, audit_ids)
           values ($1, $2, $3, $4, $5::json, $6::json, $7::json)
           on conflict (object_id) do update set session_id = excluded.session_id, scenario_id = excluded.scenario_id,
             ruleset_version = excluded.ruleset_version, inputs = excluded.inputs, session = excluded.session,
             audit_ids = excluded.audit_ids, revision = workspaces.revision + 1, updated_at = now()
           where workspaces.revision = $8::integer
           returning revision, updated_at`,
          [objectId, body.session.id, body.scenarioId, body.session.rulesetVersion, JSON.stringify(body.inputs), JSON.stringify(body.session), JSON.stringify(body.auditLog.map((e) => e.id)), base],
        );
        // Параллельная запись успела раньше (строка появилась между проверкой и вставкой)
        if (!rows[0]) throw conflict(-1);
        const inserted = await appendAudit(tx.query, body.auditLog);
        return { revision: Number(rows[0]!.revision), updatedAt: iso(rows[0]!.updated_at), auditInserted: inserted };
      });
      return send(res, 200, result);
    }

    if (path === '/api/audit' && method === 'POST') {
      const body = parse(z.object({ events: z.array(auditEvent).max(50_000) }), await readJson(req, limit));
      const inserted = await db.transaction((tx) => appendAudit(tx.query, body.events));
      return send(res, 200, { inserted });
    }

    // Помощник по сайту: ответ из базы знаний (без внешних ИИ-сервисов), вопрос сохраняется для FAQ
    if (path === '/api/help/ask' && method === 'POST') {
      const { question } = parse(z.object({ question: z.string().trim().min(3, 'вопрос слишком короткий').max(300, 'вопрос длиннее 300 знаков') }), await readJson(req, 4096));
      const r = answer(question);
      const norm = normalizeQuestion(question);
      const published = !!r.best && publishable(question);
      if (norm) {
        await db.query(
          `insert into help_questions (text, norm, faq_id, confidence, published) values ($1, $2, $3, $4, $5)
           on conflict (norm) do update set count = help_questions.count + 1, last_asked_at = now(),
             faq_id = excluded.faq_id, confidence = excluded.confidence, published = help_questions.published or excluded.published`,
          [question.replace(/\s+/g, ' '), norm, r.best?.item.id ?? null, r.best?.confidence ?? null, published],
        );
      }
      const pick = (m: (typeof r.alternatives)[number]) => ({ id: m.item.id, q: m.item.q, a: m.item.a, lesson: m.item.lesson ?? null, confidence: m.confidence });
      return send(res, 200, { answer: r.best ? pick(r.best) : null, alternatives: r.alternatives.map(pick), saved: !!norm, published });
    }

    if (path === '/api/help/questions' && method === 'GET') {
      const rows = await db.query<{ text: string; faq_id: string; count: number; last_asked_at: unknown }>(
        'select text, faq_id, count, last_asked_at from help_questions where published and faq_id is not null order by last_asked_at desc limit 50',
      );
      return send(res, 200, { questions: rows.map((q) => ({ text: q.text, faqId: q.faq_id, count: Number(q.count), lastAskedAt: iso(q.last_asked_at) })) });
    }

    if (path === '/api/audit' && method === 'GET') {
      const objectId = url.searchParams.get('objectId');
      const sessionId = url.searchParams.get('sessionId');
      const max = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 500) || 500, 1), 5000);
      const where: string[] = [];
      const params: unknown[] = [];
      if (objectId) where.push(`object_id = $${params.push(parse(ID, objectId))}`);
      if (sessionId) where.push(`session_id = $${params.push(parse(ID, sessionId))}`);
      const rows = await db.query<{ event: unknown }>(`select event from audit_events ${where.length ? `where ${where.join(' and ')}` : ''} order by seq desc limit ${max}`, params);
      return send(res, 200, { events: rows.map((r) => r.event).reverse() });
    }

    if (path.startsWith('/api/')) throw new HttpError(path.match(/^\/api\/(health|state|revisions|auth|admin|me|objects|workspaces|audit|help)\b/) ? 405 : 404, 'нет такого метода API');
    throw new HttpError(404, 'не найдено');
  }

  return (req: IncomingMessage, res: ServerResponse): void => {
    route(req, res).catch((e: unknown) => {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...e.extra });
      if (e instanceof AuthError) return send(res, e.status, { error: e.message });
      // Наружу – только общее сообщение; в журнал сервера – текст ошибки без тела запроса
      console.error(`[api] ${req.method} ${req.url?.split('?')[0]}:`, e instanceof Error ? e.message : e);
      if (!res.headersSent) send(res, 500, { error: 'внутренняя ошибка сервера' });
    });
  };
}
