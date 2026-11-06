import type { Db } from './db.ts';

/**
 * Схема базы. Миграции только добавляются (номер – порядок применения), применённые не меняются.
 * Документы хранятся в json, а не jsonb: jsonb переставляет ключи, а порядок важен (этапы сессии, снимки проверок).
 */
export const MIGRATIONS: readonly { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: 'objects, workspaces, audit',
    sql: `
      -- Объекты, добавленные пользователем (паспорт из формы «Новый объект»)
      create table user_objects (
        id text primary key,
        data json not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      -- Текущее состояние запуска объекта: входные данные, сессия автомата, история проверок
      create table workspaces (
        object_id text primary key,
        session_id text not null,
        scenario_id text,
        ruleset_version text not null,
        inputs json not null,
        session json not null,
        -- События журнала этого состояния по порядку (id из audit_events): сессия после сброса может получить прежний id
        audit_ids json not null default '[]',
        revision integer not null default 1,
        updated_at timestamptz not null default now()
      );

      -- Журнал аудита: только добавление. Изменение, удаление и очистка запрещены триггерами.
      create table audit_events (
        seq bigserial unique,
        id text primary key,
        session_id text,
        object_id text,
        stage_id text,
        action text not null,
        actor text not null,
        ts timestamptz not null,
        ruleset_version text,
        event json not null,
        recorded_at timestamptz not null default now()
      );
      create index audit_events_session_idx on audit_events (session_id, seq);
      create index audit_events_object_idx on audit_events (object_id, ts);

      create function audit_events_append_only() returns trigger language plpgsql as $$
      begin
        raise exception 'audit_events: журнал только дополняется (% запрещён)', tg_op;
      end $$;
      create trigger audit_events_no_change before update or delete on audit_events
        for each row execute function audit_events_append_only();
      create trigger audit_events_no_truncate before truncate on audit_events
        for each statement execute function audit_events_append_only();
    `,
  },
];

/** Применяет недостающие миграции, каждую в своей транзакции. Возвращает номер версии схемы. */
export async function migrate(db: Db): Promise<number> {
  await db.exec('create table if not exists schema_migrations (version integer primary key, name text not null, applied_at timestamptz not null default now())');
  const done = new Set((await db.query<{ version: number }>('select version from schema_migrations')).map((r) => Number(r.version)));
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.query('insert into schema_migrations (version, name) values ($1, $2)', [m.version, m.name]);
    });
  }
  return Math.max(0, ...MIGRATIONS.map((m) => m.version));
}
