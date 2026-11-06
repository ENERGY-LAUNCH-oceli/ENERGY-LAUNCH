import { Database, HardDrive } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { useStorageStatus, type StorageStatus } from '@/services/server-storage';
import { cn } from '@/utils/cn';

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');

/** Текст состояния хранилища: где лежат данные и записано ли последнее изменение. */
export function storageText(s: StorageStatus): { title: string; detail: string; tone: 'ok' | 'busy' | 'error' | 'local' } {
  if (s.mode === 'browser') return { title: 'Только в браузере', detail: 'Сервер хранилища не запущен: ход запуска сбросится при перезагрузке страницы', tone: 'local' };
  const where = s.kind === 'pglite' ? 'Встроенный PostgreSQL (PGlite). ' : '';
  if (s.status === 'error') return { title: 'PostgreSQL · ошибка', detail: `${where}${s.error ?? 'Изменение не сохранено'}`, tone: 'error' };
  if (s.status === 'saving') return { title: 'PostgreSQL · сохранение…', detail: `${where}Изменения отправляются на сервер`, tone: 'busy' };
  if (s.status === 'saved') return { title: 'PostgreSQL · сохранено', detail: `${where}Последнее изменение записано в ${time(s.savedAt)}`, tone: 'ok' };
  return { title: 'PostgreSQL', detail: `${where}Состояние запуска загружено с сервера и сохраняется при каждом изменении`, tone: 'ok' };
}

const DOT = { ok: 'bg-status-completed-solid', busy: 'bg-status-in-progress-solid animate-pulse', error: 'bg-status-blocked-solid', local: 'bg-status-not-started-solid' } as const;

/** Индикатор в боковой панели. В свёрнутом виде – значок с подсказкой. */
export function StorageIndicator({ collapsed = false }: { collapsed?: boolean }) {
  const s = useStorageStatus();
  const t = storageText(s);
  const Icon = s.mode === 'server' ? Database : HardDrive;
  const body = (
    <div
      role="status"
      aria-label={`Хранилище: ${t.title}`}
      data-testid="storage-indicator"
      data-storage={s.mode}
      data-storage-status={s.status}
      className={cn('flex min-w-0 items-center gap-2 rounded-sm text-caption text-text-muted', collapsed ? 'size-9 justify-center' : 'h-8 px-2.5')}
    >
      <span className="relative flex shrink-0">
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        <span aria-hidden className={cn('absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full ring-2 ring-surface', DOT[t.tone])} />
      </span>
      {!collapsed && <span className="truncate">{t.title}</span>}
    </div>
  );
  return (
    <Tooltip side={collapsed ? 'right' : 'top'} content={<span><b>{t.title}</b><br />{t.detail}</span>}>
      {body}
    </Tooltip>
  );
}
