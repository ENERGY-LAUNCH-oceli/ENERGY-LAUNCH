import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { Db } from './db.ts';

/**
 * Сотрудники и вход. Пароль хранится только хешем scrypt, сессия – случайный токен в cookie HttpOnly
 * (в базе – SHA-256 токена). Пока в базе нет ни одного сотрудника, API открыт и предлагается создать администратора.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = 'el_session';
const SESSION_DAYS = 14;
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_ATTEMPTS_MAX_KEYS = 10_000;

type LoginAttempt = { count: number; resetAt: number };
const loginAttempts = new Map<string, LoginAttempt>();

export const ROLES = ['ADMIN', 'LAUNCH_ENGINEER', 'OPERATOR', 'ACCEPTANCE_OFFICER'] as const;
export type Role = (typeof ROLES)[number];

export interface AuthUser {
  id: number;
  login: string;
  name: string;
  role: Role;
}

export class AuthError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [kind, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const key = await scrypt(pw, Buffer.from(salt, 'hex'), 32);
  const want = Buffer.from(hash, 'hex');
  return want.length === key.length && timingSafeEqual(want, key);
}

const sha = (t: string) => createHash('sha256').update(t).digest('hex');

const LOGIN = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, 'логин: 3–40 символов, латиница, цифры, . _ -');
const PASSWORD = z.string().min(8, 'пароль – не короче 8 символов').max(200);
const NAME = z.string().trim().min(2, 'укажите имя').max(120);
const ROLE = z.enum(ROLES);

function cookieToken(req: IncomingMessage): string | null {
  const m = /(?:^|;\s*)el_session=([A-Za-z0-9_-]{20,})/.exec(req.headers.cookie ?? '');
  return m ? m[1]! : null;
}

function setCookie(req: IncomingMessage, res: ServerResponse, token: string | null) {
  const secure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', token ? `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}` : `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
}

const clientAddress = (req: IncomingMessage) => req.socket.remoteAddress ?? 'unknown';

function pruneLoginAttempts(now: number): void {
  for (const [key, attempt] of loginAttempts) {
    if (attempt.resetAt <= now) loginAttempts.delete(key);
  }
  while (loginAttempts.size >= LOGIN_ATTEMPTS_MAX_KEYS) {
    const oldest = loginAttempts.keys().next().value as string | undefined;
    if (!oldest) break;
    loginAttempts.delete(oldest);
  }
}

function loginKey(req: IncomingMessage, login: string): string {
  return `${clientAddress(req)}:${login}`;
}

function checkLoginRate(req: IncomingMessage, login: string): number | null {
  const now = Date.now();
  pruneLoginAttempts(now);
  const key = loginKey(req, login);
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
    return null;
  }
  if (current.count >= LOGIN_MAX_ATTEMPTS) return Math.ceil((current.resetAt - now) / 1000);
  return null;
}

}

const usersExist = async (db: Db) => (await db.query<{ n: number }>('select count(*)::int as n from users'))[0]!.n > 0;

export async function currentUser(db: Db, req: IncomingMessage): Promise<AuthUser | null> {
  const token = cookieToken(req);
  if (!token) return null;
  const [u] = await db.query<AuthUser & { disabled: boolean }>(
    `select u.id::int as id, u.login, u.name, u.role, u.disabled from user_sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [sha(token)],
  );
  return u && !u.disabled ? { id: u.id, login: u.login, name: u.name, role: u.role } : null;
}

async function startSession(db: Db, req: IncomingMessage, res: ServerResponse, userId: number) {
  const token = randomBytes(32).toString('base64url');
  await db.query(`insert into user_sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`, [sha(token), userId]);
  await db.query('update users set last_login_at = now(), login_count = login_count + 1 where id = $1', [userId]);
  await db.query('delete from user_sessions where expires_at < now()');
  setCookie(req, res, token);
}

type Send = (res: ServerResponse, status: number, body?: unknown) => void;
type Body = () => Promise<unknown>;

/**
 * Маршруты входа и админ-панели. Возвращает true, если запрос обработан.
 * Остальной API при наличии сотрудников требует входа (guard ниже).
 */
export async function authRoutes(db: Db, req: IncomingMessage, res: ServerResponse, path: string, method: string, body: Body, send: Send, required = false): Promise<boolean> {
  const parse = <T>(schema: z.ZodType<T>, v: unknown): T => {
    const r = schema.safeParse(v);
    if (!r.success) throw new AuthError(400, r.error.issues.map((i) => i.message).join('; '));
    return r.data;
  };

  if (path === '/api/auth/me' && method === 'GET') {
    const user = await currentUser(db, req);
    return send(res, 200, { user, setup: !user && !(await usersExist(db)), required }), true;
  }

  if (path === '/api/auth/setup' && method === 'POST') {
    // Первый запуск: создать администратора можно, только пока сотрудников нет
    const b = parse(z.object({ login: LOGIN, name: NAME, password: PASSWORD }), await body());
    const id = await db.transaction(async (tx) => {
      const [n] = await tx.query<{ n: number }>('select count(*)::int as n from users');
      if (n!.n > 0) throw new AuthError(409, 'администратор уже создан – войдите');
      const [row] = await tx.query<{ id: number }>("insert into users (login, name, role, password_hash, created_by) values ($1, $2, 'ADMIN', $3, 'первый запуск') returning id::int as id", [b.login, b.name, await hashPassword(b.password)]);
      return row!.id;
    });
    await startSession(db, req, res, id);
    return send(res, 200, { user: await userById(db, id) }), true;
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const b = parse(z.object({ login: z.string().trim().toLowerCase().max(40), password: z.string().max(200) }), await body());
    const [u] = await db.query<{ id: number; password_hash: string; disabled: boolean }>('select id::int as id, password_hash, disabled from users where login = $1', [b.login]);
    // Одинаковый ответ для неизвестного логина и неверного пароля
    const ok = u ? await verifyPassword(b.password, u.password_hash) : await verifyPassword(b.password, 'scrypt$00$00').then(() => false);
    if (!u || !ok) throw new AuthError(401, 'неверный логин или пароль');
    if (u.disabled) throw new AuthError(403, 'учётная запись отключена администратором');
    await startSession(db, req, res, u.id);
    return send(res, 200, { user: await userById(db, u.id) }), true;
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    const token = cookieToken(req);
    if (token) await db.query('delete from user_sessions where token_hash = $1', [sha(token)]);
    setCookie(req, res, null);
    return send(res, 204), true;
  }

  if (path === '/api/auth/password' && method === 'POST') {
    const user = await currentUser(db, req);
    if (!user) throw new AuthError(401, 'нужно войти');
    const b = parse(z.object({ current: z.string().max(200), next: PASSWORD }), await body());
    const [u] = await db.query<{ password_hash: string }>('select password_hash from users where id = $1', [user.id]);
    if (!(await verifyPassword(b.current, u!.password_hash))) throw new AuthError(400, 'текущий пароль указан неверно');
    await db.query('update users set password_hash = $2 where id = $1', [user.id, await hashPassword(b.next)]);
    // Остальные сессии сотрудника закрываются
    await db.query('delete from user_sessions where user_id = $1 and token_hash <> $2', [user.id, sha(cookieToken(req)!)]);
    return send(res, 204), true;
  }

  if (path === '/api/me/stats' && method === 'GET') {
    const user = await currentUser(db, req);
    if (!user) throw new AuthError(401, 'нужно войти');
    return send(res, 200, await statsFor(db, user)), true;
  }

  if (path.startsWith('/api/admin/')) {
    const user = await currentUser(db, req);
    if (!user) throw new AuthError(401, 'нужно войти');
    if (user.role !== 'ADMIN') throw new AuthError(403, 'только для администратора');

    if (path === '/api/admin/users' && method === 'GET') {
      const users = await db.query(
        `select u.id::int as id, u.login, u.name, u.role, u.disabled, u.created_at, u.created_by, u.last_login_at, u.login_count,
                count(a.id)::int as actions, count(a.id) filter (where a.ts > now() - interval '7 days')::int as actions_7d,
                count(distinct a.object_id)::int as objects, max(a.ts) as last_action_at
           from users u left join audit_events a on a.actor = u.name
          group by u.id order by u.created_at`,
      );
      const [summary] = await db.query(
        `select (select count(*)::int from users) as users,
                (select count(*)::int from users where disabled) as disabled,
                (select count(*)::int from users where last_login_at > now() - interval '7 days') as active_7d,
                (select count(*)::int from user_sessions where expires_at > now()) as sessions,
                (select count(*)::int from audit_events a join users u on u.name = a.actor where a.ts > now() - interval '1 day') as actions_24h`,
      );
      return send(res, 200, { users, summary }), true;
    }

    if (path === '/api/admin/users' && method === 'POST') {
      const b = parse(z.object({ login: LOGIN, name: NAME, role: ROLE, password: PASSWORD }), await body());
      const exists = await db.query('select 1 from users where login = $1 or name = $2', [b.login, b.name]);
      if (exists.length) throw new AuthError(409, 'такой логин или имя уже есть');
      const [row] = await db.query<{ id: number }>('insert into users (login, name, role, password_hash, created_by) values ($1, $2, $3, $4, $5) returning id::int as id', [b.login, b.name, b.role, await hashPassword(b.password), user.name]);
      return send(res, 201, { user: await userById(db, row!.id) }), true;
    }

    const m = /^\/api\/admin\/users\/(\d+)$/.exec(path);
    if (m && method === 'PATCH') {
      const id = Number(m[1]);
      const b = parse(z.object({ disabled: z.boolean().optional(), role: ROLE.optional(), password: PASSWORD.optional() }), await body());
      if (id === user.id && (b.disabled || (b.role && b.role !== 'ADMIN'))) throw new AuthError(400, 'нельзя отключить себя или снять с себя права администратора');
      if (b.disabled !== undefined) await db.query('update users set disabled = $2 where id = $1', [id, b.disabled]);
      if (b.role) await db.query('update users set role = $2 where id = $1', [id, b.role]);
      if (b.password) await db.query('update users set password_hash = $2 where id = $1', [id, await hashPassword(b.password)]);
      if (b.disabled || b.password) await db.query('delete from user_sessions where user_id = $1', [id]);
      return send(res, 200, { user: await userById(db, id) }), true;
    }
  }
  return false;
}

async function userById(db: Db, id: number): Promise<AuthUser | null> {
  const [u] = await db.query<AuthUser>('select id::int as id, login, name, role from users where id = $1', [id]);
  return u ?? null;
}

async function statsFor(db: Db, user: AuthUser) {
  const [s] = await db.query(
    `select count(*)::int as actions, count(*) filter (where ts > now() - interval '7 days')::int as actions_7d,
            count(distinct object_id)::int as objects, max(ts) as last_action_at,
            (select last_login_at from users where id = $2) as last_login_at, (select login_count from users where id = $2) as login_count,
            (select created_at from users where id = $2) as created_at
       from audit_events where actor = $1`,
    [user.name, user.id],
  );
  const recent = await db.query<{ event: unknown }>(`select event from audit_events where actor = $1 order by seq desc limit 30`, [user.name]);
  const byAction = await db.query(`select action, count(*)::int as n from audit_events where actor = $1 group by action order by n desc limit 8`, [user.name]);
  return { ...s, recent: recent.map((r) => r.event), byAction };
}

/** Есть сотрудники – API данных только для вошедших. Возвращает сотрудника (или null, если вход не настроен). */
export async function guard(db: Db, req: IncomingMessage, path: string): Promise<AuthUser | null> {
  if (path === '/api/health' || path.startsWith('/api/help/')) return null;
  if (!(await usersExist(db))) return null;
  const user = await currentUser(db, req);
  if (!user) throw new AuthError(401, 'нужно войти');
  return user;
}
