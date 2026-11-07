import { createHandler } from './app.ts';
import { openDb } from './db.ts';
import { migrate } from './migrations.ts';

/**
 * API хранилища внутри dev-сервера Vite: `npm run dev` поднимает и приложение, и PostgreSQL – отдельная команда
 * не нужна. Подключается плагином в vite.config.ts; та же база, что у `npm run api` (DATABASE_URL или .data/pglite).
 */
export async function startDevApi(env: Record<string, string | undefined>) {
  const db = await openDb({ databaseUrl: env.DATABASE_URL || undefined, pgliteDir: env.PGLITE_DIR || undefined });
  const schema = await migrate(db);
  return { db, schema, handler: createHandler(db, { version: 'dev' }) };
}
