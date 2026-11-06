import pg from 'pg';

/**
 * Доступ к PostgreSQL. Рабочий режим – сервер PostgreSQL по DATABASE_URL (пул pg).
 * Без DATABASE_URL – встроенный PostgreSQL (PGlite, тот же движок в WebAssembly) с данными в папке:
 * для разработки на машине без установленного PostgreSQL и для тестов (memory://).
 */
export interface Tx {
  /** Один запрос с параметрами ($1, $2 …) – значения никогда не подставляются в текст SQL. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Несколько команд без параметров (миграции). */
  exec(sql: string): Promise<void>;
}

export interface Db extends Tx {
  readonly kind: 'postgres' | 'pglite';
  /** Запросы в одной транзакции: ошибка откатывает все. */
  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
  close(): Promise<void>;
}

export interface DbOptions {
  /** postgres://… – сервер PostgreSQL. */
  databaseUrl?: string | undefined;
  /** Папка встроенного PostgreSQL или memory:// (по умолчанию .data/pglite). */
  pgliteDir?: string | undefined;
}

export async function openDb(opts: DbOptions): Promise<Db> {
  if (opts.databaseUrl) return openPostgres(opts.databaseUrl);
  return openPglite(opts.pgliteDir ?? '.data/pglite');
}

type PgQueryable = Pick<pg.PoolClient, 'query'>;

const pgTx = (c: PgQueryable): Tx => ({
  query: async <T>(sql: string, params: unknown[] = []) => (await c.query(sql, params)).rows as T[],
  exec: async (sql: string) => {
    await c.query(sql);
  },
});

async function openPostgres(connectionString: string): Promise<Db> {
  const pool = new pg.Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
  // Ошибка простаивающего соединения не роняет процесс; строка подключения (с паролем) не логируется
  pool.on('error', (e) => console.error('[db] соединение с PostgreSQL прервано:', e.message));
  await pool.query('select 1');
  return {
    kind: 'postgres',
    ...pgTx(pool as unknown as PgQueryable),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await fn(pgTx(client));
        await client.query('commit');
        return result;
      } catch (e) {
        await client.query('rollback').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function openPglite(dataDir: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = await PGlite.create(dataDir);
  type Q = { query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>; exec(sql: string): Promise<unknown> };
  const liteTx = (c: Q): Tx => ({
    query: async <T>(sql: string, params: unknown[] = []) => (await c.query<T>(sql, params)).rows,
    exec: async (sql: string) => {
      await c.exec(sql);
    },
  });
  return {
    kind: 'pglite',
    ...liteTx(db),
    transaction: (fn) => db.transaction((tx) => fn(liteTx(tx))),
    close: () => db.close(),
  };
}
