import { RefreshCw, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { OFFLINE_INFO } from '@/errors/codes';
import { pingServer, useOnline } from '@/hooks/use-online';
import { notify } from '@/store/notifications-store';
import { StatusScreen } from './StatusScreen';

/**
 * Связь пропала – экран «Нет подключения» поверх приложения (данные на странице не теряются).
 * Связь вернулась – экран закрывается сам. Можно продолжить без сети: экран вернётся при следующем обрыве.
 */
export function OfflineOverlay() {
  const online = useOnline();
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [noNet, setNoNet] = useState(false);
  const wasOffline = useRef(false);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setDismissed(false);
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      notify({ tone: 'success', title: 'Подключение восстановлено', description: 'Изменения снова сохраняются на сервере' });
    }
  }, [online]);

  const visible = !online && !dismissed;
  useEffect(() => {
    if (visible) first.current?.focus();
  }, [visible]);
  if (!visible) return null;

  const check = async () => {
    setChecking(true);
    const ok = await pingServer();
    setChecking(false);
    if (ok) setDismissed(true);
    else {
      setNoNet(true);
      setTimeout(() => setNoNet(false), 2500);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="status-title" data-testid="offline-overlay" className="fixed inset-0 z-[200] overflow-y-auto bg-background p-3">
      <div>
        <StatusScreen
          standalone
          info={OFFLINE_INFO}
          actions={
            <>
              <Button ref={first} variant="accent" onClick={() => void check()} loading={checking}>
                <RefreshCw aria-hidden />
                {noNet ? 'Сети по-прежнему нет' : 'Проверить подключение'}
              </Button>
              <Button variant="secondary" onClick={() => setDismissed(true)}>
                <WifiOff aria-hidden />
                Продолжить без сети
              </Button>
            </>
          }
          footer={<p className="max-w-md text-caption text-text-muted">Без сети изменения не сохраняются на сервере. Открытая страница продолжает работать, а загруженные данные остаются на месте.</p>}
        />
      </div>
    </div>
  );
}
