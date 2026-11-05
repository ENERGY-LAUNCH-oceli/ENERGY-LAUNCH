import { ArrowRight, Download, Search, Trash2, Zap } from 'lucide-react';
import * as React from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { Drawer, Modal } from '@/components/ui/dialog';
import { FileUpload } from '@/components/ui/file-upload';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Kpi } from '@/components/ui/kpi';
import { Progress } from '@/components/ui/progress';
import { RadioGroup } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import { StatusBadge, StatusDot } from '@/components/ui/status-badge';
import { Stepper } from '@/components/ui/stepper';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Timeline } from '@/components/ui/timeline';
import { Tooltip } from '@/components/ui/tooltip';
import { CheckStatusLabel } from '@/components/launch';
import { STAGE_STATUSES } from '@/types';
import { DsSection, Specimen, StateLabel } from './Specimen';

interface SignalRow {
  asset: string;
  signal: string;
  unit: string;
  completeness: number;
  ageMin: number | null;
  status: 'PASSED' | 'FAILED' | 'UNAVAILABLE';
}

const SIGNALS: SignalRow[] = [
  { asset: 'Grid', signal: 'Grid.power_kW', unit: 'кВт', completeness: 99.8, ageMin: 6, status: 'PASSED' },
  { asset: 'PV1', signal: 'PV1.power_kW', unit: 'кВт', completeness: 99.5, ageMin: 6, status: 'PASSED' },
  { asset: 'PV1', signal: 'PV1.power_kW.setpoint_received', unit: 'кВт', completeness: 97.2, ageMin: 21, status: 'FAILED' },
  { asset: 'Battery1', signal: 'Battery1.power_kW', unit: 'кВт', completeness: 0, ageMin: null, status: 'UNAVAILABLE' },
  { asset: 'Battery1', signal: 'Battery1.SOC_%', unit: '%', completeness: 0, ageMin: null, status: 'UNAVAILABLE' },
  { asset: 'Demand', signal: 'Demand.power_kW', unit: 'кВт', completeness: 100, ageMin: 6, status: 'PASSED' },
];

const COLUMNS: ColumnDef<SignalRow, any>[] = [
  { accessorKey: 'asset', header: 'Актив', cell: (c) => <span className="font-semibold">{c.getValue<string>()}</span> },
  { accessorKey: 'signal', header: 'Сигнал', enableSorting: false, cell: (c) => <span className="font-mono text-caption">{c.getValue<string>()}</span> },
  { accessorKey: 'unit', header: 'Ед.', enableSorting: false },
  { accessorKey: 'completeness', header: 'Полнота, %', meta: { numeric: true }, cell: (c) => c.getValue<number>().toLocaleString('ru-RU', { minimumFractionDigits: 1 }) },
  { accessorKey: 'ageMin', header: 'Возраст, мин', meta: { numeric: true }, cell: (c) => c.getValue<number | null>() ?? '—' },
  { accessorKey: 'status', header: 'Проверка', enableSorting: false, cell: (c) => <CheckStatusLabel status={c.getValue<SignalRow['status']>()} /> },
];

export function ComponentsSection() {
  const [files, setFiles] = React.useState<File[]>([]);
  const [modal, setModal] = React.useState(false);
  return (
    <DsSection id="components" eyebrow="UI Kit" title="Базовые компоненты" description="Переиспользуемые элементы интерфейса. Все состояния: по умолчанию, наведение, фокус, отключено, загрузка, ошибка.">
      <Specimen id="button" title="Button" description="Primary — основное действие экрана; Accent — продвижение запуска; Secondary/Outline — второстепенные; Danger — необратимые.">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Начать этап</Button>
            <Button variant="accent">
              Завершить этап <ArrowRight />
            </Button>
            <Button variant="secondary">Запустить проверки</Button>
            <Button variant="outline">Посмотреть</Button>
            <Button variant="ghost">Отмена</Button>
            <Button variant="danger">
              <Trash2 />
              Удалить материал
            </Button>
            <Button variant="link">Открыть журнал</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" variant="secondary" aria-label="Скачать">
              <Download />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button loading>Проверка…</Button>
            <Button variant="accent" disabled>
              Завершить этап
            </Button>
            <Button variant="secondary" disabled>
              Недоступно
            </Button>
          </div>
        </div>
      </Specimen>

      <Specimen id="input" title="Input · Select · Field" description="Подпись над полем, подсказка или ошибка под ним. Единицы измерения — внутри поля.">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Field label="EAN потребления" htmlFor="ds-ean" hint="18-значный код точки подключения" required>
            <Input id="ds-ean" placeholder="5414488000…" className="font-mono" />
          </Field>
          <Field label="Минимальная полнота" htmlFor="ds-compl">
            <Input id="ds-compl" defaultValue="99" trailing="%" inputMode="decimal" className="tabular" />
          </Field>
          <Field label="Поиск сигнала" htmlFor="ds-search">
            <Input id="ds-search" leading={<Search />} placeholder="Battery.power_kW" />
          </Field>
          <Field label="Шаг данных" htmlFor="ds-step" error="Ожидается 15 минут, получено 60" >
            <Input id="ds-step" defaultValue="60" trailing="мин" aria-invalid />
          </Field>
          <Field label="Часовой пояс" htmlFor="ds-tz">
            <Select
              id="ds-tz"
              defaultValue="Europe/Brussels"
              options={[
                { value: 'Europe/Brussels', label: 'Europe/Brussels', description: 'Только для отображения' },
                { value: 'UTC', label: 'UTC', description: 'Время данных' },
              ]}
            />
          </Field>
          <Field label="Отключено" htmlFor="ds-dis">
            <Input id="ds-dis" disabled defaultValue="Building1" />
          </Field>
          <Field label="Комментарий к подтверждению" htmlFor="ds-note" className="md:col-span-2 xl:col-span-3">
            <Textarea id="ds-note" placeholder="Пробелы 12.03 обработаны по согласованному правилу…" />
          </Field>
        </div>
      </Specimen>

      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen id="checkbox" title="Checkbox">
          <div className="flex flex-col gap-4">
            <Checkbox label="История за 24 месяца проверена" description="MH-CONF-OWNER · владелец объекта" defaultChecked />
            <Checkbox label="Карта сигналов подтверждена" />
            <Checkbox label="Частично выбрано" checked="indeterminate" />
            <Checkbox label="Недоступно" disabled />
          </div>
        </Specimen>
        <Specimen id="radio" title="Radio">
          <RadioGroup
            defaultValue="rule"
            options={[
              { value: 'fix', label: 'Получить недостающие данные', description: 'Препятствие устраняется загрузкой' },
              { value: 'rule', label: 'Обработать по согласованному правилу', description: 'Требуется обоснование' },
              { value: 'na', label: 'Не применимо', description: 'Только при подтверждённом отсутствии актива', disabled: true },
            ]}
          />
        </Specimen>
      </div>

      <Specimen id="tabs" title="Tabs" description="Line — разделы страницы; Pill — переключение представлений.">
        <div className="flex flex-col gap-8">
          <Tabs defaultValue="checks">
            <TabsList>
              <TabsTrigger value="checks" count={6}>
                Проверки
              </TabsTrigger>
              <TabsTrigger value="blockers" count={2}>
                Препятствия
              </TabsTrigger>
              <TabsTrigger value="evidence">Подтверждения</TabsTrigger>
              <TabsTrigger value="off" disabled>
                Недоступно
              </TabsTrigger>
            </TabsList>
            <TabsContent value="checks" className="text-body-sm text-text-secondary">
              Содержимое вкладки «Проверки».
            </TabsContent>
            <TabsContent value="blockers" className="text-body-sm text-text-secondary">
              Содержимое вкладки «Препятствия».
            </TabsContent>
            <TabsContent value="evidence" className="text-body-sm text-text-secondary">
              Содержимое вкладки «Подтверждения».
            </TabsContent>
          </Tabs>
          <Tabs defaultValue="48h">
            <TabsList variant="pill">
              <TabsTrigger value="24h">24 ч</TabsTrigger>
              <TabsTrigger value="48h">48 ч</TabsTrigger>
              <TabsTrigger value="24m">24 мес</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Specimen>

      <Specimen id="card" title="Card" tone="background">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Паспорт объекта</CardTitle>
              <CardDescription>object.json · Building1</CardDescription>
            </CardHeader>
            <CardContent className="text-body-sm text-text-secondary">Адрес, координаты, коды EAN, состав активов и карта сигналов.</CardContent>
            <CardFooter>
              <Button size="sm" variant="outline">
                Открыть
              </Button>
            </CardFooter>
          </Card>
          <Card interactive>
            <CardHeader>
              <CardTitle>Интерактивная</CardTitle>
              <CardDescription>Рамка усиливается при наведении</CardDescription>
            </CardHeader>
            <CardContent className="text-body-sm text-text-secondary">Для карточек-ссылок и выбора.</CardContent>
          </Card>
          <Card tone="secondary">
            <CardHeader>
              <CardTitle>Вторичная поверхность</CardTitle>
              <CardDescription>surface-secondary</CardDescription>
            </CardHeader>
            <CardContent className="text-body-sm text-text-secondary">Для вложенных и справочных блоков.</CardContent>
          </Card>
        </div>
      </Specimen>

      <Specimen id="badge" title="Badge · StatusBadge" description="StatusBadge — только для статусов этапов; Badge — для меток и категорий.">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Нейтральный</Badge>
            <Badge tone="accent">PV</Badge>
            <Badge tone="info">Тестовый контур</Badge>
            <Badge tone="success">Пройдено</Badge>
            <Badge tone="warning">Неактуально</Badge>
            <Badge tone="error">Блокирует</Badge>
            <Badge tone="inverse">v1.0.0</Badge>
            <Badge size="sm">small</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {STAGE_STATUSES.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {STAGE_STATUSES.map((s) => (
              <span key={s} className="flex items-center gap-2">
                <StatusBadge status={s} size="sm" />
                <StatusBadge status={s} iconOnly />
                <StatusDot status={s} />
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {(['PASSED', 'FAILED', 'WARNING', 'SKIPPED', 'NOT_APPLICABLE', 'STALE', 'UNAVAILABLE', 'PENDING'] as const).map((s) => (
              <CheckStatusLabel key={s} status={s} />
            ))}
          </div>
        </div>
      </Specimen>

      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen id="progress" title="Progress" description="Отметка — порог из конфигурации правил.">
          <div className="flex flex-col gap-5">
            <Progress value={99.6} threshold={99} tone="success" label="Полнота 15-минутного потока (48 ч)" showValue />
            <Progress value={79} threshold={100} tone="error" label="Покрытие истории: 19 из 24 месяцев" showValue />
            <Progress value={2} max={4} tone="info" label="Этапы" />
            <Progress value={40} tone="accent" size="sm" />
          </div>
        </Specimen>
        <Specimen id="tooltip" title="Tooltip" description="Пояснения к терминам и значениям. Не для критичной информации.">
          <div className="flex flex-wrap gap-3">
            <Tooltip content="Договорное ограничение мощности подключения, отдельно для потребления и выдачи">
              <Button variant="secondary" size="sm">
                Что такое CA?
              </Button>
            </Tooltip>
            <Tooltip content="State of Charge — уровень заряда батареи, %" side="bottom">
              <Badge tone="accent" tabIndex={0}>
                SoC
              </Badge>
            </Tooltip>
          </div>
        </Specimen>
      </div>

      <Specimen id="modal" title="Modal · Drawer" description="Modal — решение, требующее внимания. Drawer — подробности без потери контекста.">
        <div className="flex flex-wrap gap-3">
          <Modal
            open={modal}
            onOpenChange={setModal}
            title="Обработать пропуск по правилу?"
            description="Решение записывается в журнал с автором, временем и версией правил."
            trigger={<Button variant="secondary">Открыть Modal</Button>}
            footer={
              <>
                <Button variant="ghost" onClick={() => setModal(false)}>
                  Отмена
                </Button>
                <Button variant="accent" onClick={() => setModal(false)}>
                  Подтвердить
                </Button>
              </>
            }
          >
            <Field label="Обоснование" htmlFor="ds-reason" required>
              <Textarea id="ds-reason" placeholder="Плановое отключение счётчика 12.03, согласовано с владельцем процесса" />
            </Field>
          </Modal>
          <Drawer title="MH-003 · Полнота истории" description="Подробности проверки" trigger={<Button variant="secondary">Открыть Drawer</Button>}>
            <div className="flex flex-col gap-3 text-body-sm text-text-secondary">
              <p>Пропущено 288 интервалов (3 суток) в серии Grid.energy_kWh.offtake_invoice.</p>
              <Alert tone="error" title="Пробел 12.03.2025 00:00 — 15.03.2025 00:00">
                Поле <span className="font-mono">Grid.energy_kWh.offtake_invoice</span>
              </Alert>
            </div>
          </Drawer>
        </div>
      </Specimen>

      <Specimen id="alert" title="Alert" description="Светлая подложка и акцентная левая граница — без сплошной заливки.">
        <div className="grid gap-3 lg:grid-cols-2">
          <Alert tone="info" title="Данные синтетические">
            Набор помечен как синтетический в manifest.json.
          </Alert>
          <Alert tone="success" title="Все обязательные сигналы присутствуют">
            Проверено 14 сигналов по 4 активам.
          </Alert>
          <Alert tone="warning" title="Подтверждения неактуальны" action={<Button size="sm" variant="secondary">Перепроверить</Button>}>
            Конфигурация изменена после проверки.
          </Alert>
          <Alert tone="error" title="Переход отклонён">
            Этап 3 нельзя завершить: не завершён этап 2 «Данные в реальном времени».
          </Alert>
        </div>
      </Specimen>

      <Specimen id="datatable" title="DataTable" description="TanStack Table: сортировка, числовые колонки справа табличными цифрами, подсветка строк с нарушением.">
        <div className="flex flex-col gap-6">
          <DataTable
            columns={COLUMNS}
            data={SIGNALS}
            caption="Сигналы телеметрии"
            rowTone={(r) => (r.status === 'FAILED' ? 'warning' : r.status === 'UNAVAILABLE' ? 'error' : undefined)}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <StateLabel>Загрузка</StateLabel>
              <DataTable columns={COLUMNS} data={[]} loading />
            </div>
            <div className="flex flex-col gap-2">
              <StateLabel>Пусто</StateLabel>
              <DataTable columns={COLUMNS} data={[]} emptyTitle="Телеметрия не загружена" emptyDescription="Загрузите telemetry.csv" />
            </div>
          </div>
        </div>
      </Specimen>

      <Specimen id="states" title="EmptyState · ErrorState · LoadingState" tone="background">
        <div className="grid gap-4 lg:grid-cols-3">
          <EmptyState title="Материалов пока нет" description="Отчёты проверок и акты появятся здесь." action={<Button size="sm" variant="secondary">Загрузить</Button>} />
          <ErrorState description="API телеметрии не ответил за 60 секунд." lastSuccessAt="2026-11-05T09:15:00Z" onRetry={() => undefined} />
          <div className="flex flex-col gap-4">
            <LoadingState />
            <LoadingState variant="spinner" label="Выполняются проверки…" className="rounded-lg border border-border bg-surface" />
          </div>
        </div>
      </Specimen>

      <Specimen id="kpi" title="KPI" description="Значение — табличными цифрами; единица отдельно. Верхняя линия — тон показателя." tone="background">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Покрытие истории" value="19" unit="из 24 мес" tone="error" hint="Не хватает 5 месяцев" />
          <Kpi label="Полнота телеметрии" value="99,6" unit="%" tone="success" hint="порог 99 % · 48 ч" />
          <Kpi label="Последнее значение" value="21" unit="мин" tone="warning" hint="допустимо ≤ 30 мин" />
          <Kpi label="Выработка PV" value="1 248,75" unit="кВт·ч" icon={<Zap />} delta={{ value: '4,2 %', direction: 'up', positive: true }} hint="к прошлым суткам" />
        </div>
      </Specimen>

      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen id="timeline" title="Timeline">
          <Timeline
            items={[
              { id: '1', title: 'Загружена выгрузка invoice.csv', time: '05.11.2026 09:12', tone: 'neutral', description: '70 080 интервалов · 24 месяца' },
              { id: '2', title: 'Выполнены проверки', time: '05.11.2026 09:13', tone: 'error', description: 'Не пройдены: MH-003' },
              { id: '3', title: 'Препятствие устранено', time: '05.11.2026 11:40', tone: 'success' },
              { id: '4', title: 'Этап завершён', time: '05.11.2026 11:42', tone: 'accent' },
            ]}
          />
        </Specimen>
        <Specimen id="stepper" title="Stepper" description="Горизонтальный на широком экране, вертикальный на узком.">
          <div className="flex flex-col gap-8">
            <Stepper
              currentId="b"
              onStepClick={() => undefined}
              steps={[
                { id: 'a', title: 'История счётчиков', status: 'COMPLETED' },
                { id: 'b', title: 'Данные в реальном времени', status: 'BLOCKED', description: 'Нет данных Battery1' },
                { id: 'c', title: 'Управление', status: 'NOT_STARTED' },
                { id: 'd', title: 'Финальные дашборды', status: 'NOT_STARTED' },
              ]}
            />
            <Stepper
              orientation="vertical"
              currentId="c"
              steps={[
                { id: 'a', title: 'Отправить setpoint', status: 'COMPLETED' },
                { id: 'b', title: 'Приём контроллером', status: 'COMPLETED' },
                { id: 'c', title: 'Отклик актива', status: 'IN_PROGRESS', description: 'Ожидание изменения мощности' },
              ]}
            />
          </div>
        </Specimen>
      </div>

      <Specimen id="fileupload" title="FileUpload" description="Перетаскивание или выбор файла; тип и размер проверяются до импорта.">
        <div className="grid gap-6 lg:grid-cols-2">
          <FileUpload accept=".csv,.json" multiple files={files} onFilesChange={setFiles} label="Перетащите invoice.csv, telemetry.csv или object.json" />
          <div className="flex flex-col gap-4">
            <FileUpload accept=".csv" error="Неподдерживаемая кодировка: ожидается UTF-8 с BOM" />
            <FileUpload accept=".csv" disabled label="Загрузка недоступна до начала этапа" />
          </div>
        </div>
      </Specimen>
    </DsSection>
  );
}
