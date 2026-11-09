import { PageHeader, SectionHeader } from '@/components/common/PageHeader';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { AppearanceSettings } from '@/features/settings/AppearanceSettings';
import { RuleValues } from '@/features/settings/RuleValues';
import { StorageSettings } from '@/features/settings/StorageSettings';
import { useLaunchStore, useUi } from '@/store';

export function SettingsPage() {
  const ruleset = useLaunchStore((s) => s.ruleset);
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  const context = useUi((s) => s.contextPanelOpen);
  const setContext = useUi((s) => s.setContextPanelOpen);
  const groups: [string, Record<string, unknown>][] = [
    ['Счётчики', ruleset.meterHistory as unknown as Record<string, unknown>],
    ['Телеметрия', ruleset.telemetry as unknown as Record<string, unknown>],
    ['Команды управления', ruleset.control as unknown as Record<string, unknown>],
    ...(ruleset.controlTesting ? [['Проверки управления', ruleset.controlTesting as unknown as Record<string, unknown>] as [string, Record<string, unknown>]] : []),
    ...(ruleset.dashboardConfig ? [['Состав итоговой панели', ruleset.dashboardConfig as unknown as Record<string, unknown>] as [string, Record<string, unknown>]] : []),
    ['Публикация панели', ruleset.dashboards as unknown as Record<string, unknown>],
  ];
  return (
    <div className="flex flex-col gap-10">
      <PageHeader eyebrow="Настройки" title="Настройки" description="Выберите внешний вид и посмотрите, какие условия проверяет система перед запуском объекта." />
      {ruleset.provisional && (
        <Alert tone="warning" title={`Набор правил v${ruleset.version} – предварительный`}>
          Значения ещё не сверены с ТЗ «Кейс 4» и паспортом OE-04 (см. docs/requirements-reconciliation.md).
        </Alert>
      )}
      <section data-tour="settings-appearance">
        <SectionHeader eyebrow="Оформление" title="Внешний вид" description="Тема, акцентный цвет и язык интерфейса." />
        <AppearanceSettings />
      </section>
      <section>
        <SectionHeader eyebrow="Проверки запуска" title={`Условия проверок · v${ruleset.version}`} description={`Действуют с ${ruleset.effectiveFrom}. Эти значения определяют, какие данные система считает корректными.`} />
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          {groups.map(([title, values]) => (
            <Card key={title} className="min-w-0">
              <CardHeader>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <RuleValues values={values} />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section data-tour="settings-storage">
        <SectionHeader eyebrow="Данные" title="Хранилище" description="Где сохраняются объекты, ход запуска и журнал аудита." />
        <StorageSettings />
      </section>
      <section>
        <SectionHeader eyebrow="Интерфейс" title="Рабочее пространство" />
        <Card>
          <CardContent className="flex flex-col gap-4 pt-5">
            <div className="hidden lg:block">
              <Checkbox label="Свёрнутая боковая навигация" description="Ctrl + B" checked={collapsed} onCheckedChange={toggle} />
            </div>
            <Checkbox label="Контекстная панель объекта" description="Справа на широких экранах" checked={context} onCheckedChange={(v) => setContext(v === true)} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
