import { useLaunchStore } from '@/store';

export function Topbar() {
  const ruleset = useLaunchStore((s) => s.ruleset);
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <span className="text-sm text-muted-foreground">Сопровождение запуска энергетических объектов</span>
      <span className="font-mono text-xs text-muted-foreground" title={ruleset.provisional ? 'Пороговые значения ожидают сверки с ТЗ и паспортом OE-04' : undefined}>
        Правила v{ruleset.version}
        {ruleset.provisional && ' · предварительные'}
      </span>
    </header>
  );
}
