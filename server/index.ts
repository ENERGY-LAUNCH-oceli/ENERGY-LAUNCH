import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createHandler } from './app.ts';
import { openDb } from './db.ts';
import { migrate } from './migrations.ts';

/**
 * Сервер хранилища ENERGY LAUNCH.
 *   DATABASE_URL – postgres://пользователь:пароль@хост:5432/база (задаётся в .env, в репозиторий не попадает);
 *   без него – встроенный PostgreSQL в PGLITE_DIR (по умолчанию .data/pglite).
 *   API_HOST / API_PORT – адрес (по умолчанию 127.0.0.1:8787: сервер не виден из сети).
 */
const env = process.env;
const host = env.API_HOST || '127.0.0.1';
const port = Number(env.API_PORT || 8787);
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

const db = await openDb({ databaseUrl: env.DATABASE_URL, pgliteDir: env.PGLITE_DIR });
const schema = await migrate(db);
const authRequired = process.env.AUTH_REQUIRED !== '0';
const server = createServer({ requestTimeout: 60_000 }, createHandler(db, { version, authRequired }));

server.listen(port, host, () => {
  // Строка подключения содержит пароль – в журнал попадает только вид хранилища
  const where = db.kind === 'postgres' ? 'PostgreSQL (DATABASE_URL)' : `встроенный PostgreSQL (PGlite) · ${env.PGLITE_DIR || '.data/pglite'}`;
  console.warn(`[api] http://${host}:${port}/api · ${where} · схема v${schema}`);
});

let closing = false;
const shutdown = (signal: string) => {
  if (closing) return;
  closing = true;
  console.warn(`[api] ${signal}: остановка`);
  server.close(() => void db.close().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
