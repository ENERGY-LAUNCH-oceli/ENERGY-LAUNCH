import { useNow } from '@/hooks/use-now';
import { formatDateTime, formatRelative } from '@/utils/format';

/** «5 минут назад» – обновляется само, пока элемент на экране; точное время – в подсказке. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  useNow();
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={className}>
      {formatRelative(iso)}
    </time>
  );
}
