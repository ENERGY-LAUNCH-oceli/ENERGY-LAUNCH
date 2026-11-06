import { PageHeader, SectionHeader } from '@/components/common/PageHeader';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useLaunchStore, useUi } from '@/store';

const fmt = (v: unknown) => (Array.isArray(v) ? v.join(', ') : String(v));

export function SettingsPage() {
  const ruleset = useLaunchStore((s) => s.ruleset);
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  const context = useUi((s) => s.contextPanelOpen);
  const setContext = useUi((s) => s.setContextPanelOpen);
  const groups: [string, Record<string, unknown>][] = [
    ['История счётчиков', ruleset.meterHistory as unknown as Record<string, unknown>],
    ['Телеметрия', ruleset.telemetry as unknown as Record<string, unknown>],
    ['Управление', ruleset.control as unknown as Record<string, unknown>],
    ['Дашборды', ruleset.dashboards as unknown as Record<string, unknown>],
  ];
  return (
    <div className="flex flex-col gap-10">
      <PageHeader eyebrow="Настройки" title="Правила и интерфейс" description="Пороговые значения проверок хранятся в версионируемом наборе правил, а не в коде." />
      {ruleset.provisional && (
        <Alert tone="warning" title={`Набор правил v${ruleset.version} — предварительный`}>
          Значения ещё не сверены с ТЗ «Кейс 4» и паспортом OE-04 (см. docs/requirements-reconciliation.md).
        </Alert>
      )}
      <section>
        <SectionHeader eyebrow="Правила" title={`Набор v${ruleset.version}`} description={`Действует с ${ruleset.effectiveFrom}. Изменение порогов — новая версия набора.`} />
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map(([title, values]) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-border text-body-sm">
                  {Object.entries(values).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-2">
                      <dt className="font-mono text-caption text-text-secondary">{k}</dt>
                      <dd className="tabular text-right font-semibold">{fmt(v)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <SectionHeader eyebrow="Интерфейс" title="Рабочее пространство" />
        <Card>
          <CardContent className="flex flex-col gap-4 pt-5">
            <Checkbox label="Свёрнутая боковая навигация" description="Ctrl + B" checked={collapsed} onCheckedChange={toggle} />
            <Checkbox label="Контекстная панель объекта" description="Справа на широких экранах" checked={context} onCheckedChange={(v) => setContext(v === true)} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
