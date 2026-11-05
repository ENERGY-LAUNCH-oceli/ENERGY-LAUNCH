import { Upload } from 'lucide-react';
import {
  AuditTimeline,
  BlockerCard,
  BlockerPanel,
  DataQualityIndicator,
  EvidenceCard,
  EvidencePanel,
  LaunchProgress,
  LaunchStageCard,
  NextActionCard,
  ValidationResult,
  ValidationStatus,
  type ValidationResultView,
} from '@/components/launch';
import { Button } from '@/components/ui/button';
import type { AuditEvent, Blocker } from '@/types';
import { DsSection, Specimen, StateLabel } from './Specimen';

const T = '2026-11-05T09:13:00.000Z';

const RESULTS: ValidationResultView[] = [
  {
    ruleId: 'MH-004',
    title: 'Покрытие 24 месяцев',
    status: 'FAILED',
    dimension: 'PRESENCE',
    message: 'Официальные данные покрывают 19 из 24 последовательных месяцев.',
    actual: 19,
    expected: 24,
    unit: 'мес',
    location: ['2023-11', '2023-12', '2024-01', '2024-02', '2024-03'],
    source: 'invoice.csv',
    evaluatedAt: T,
    rulesetVersion: '1.0.0',
  },
  {
    ruleId: 'MH-003',
    title: 'Полнота 15-минутных интервалов',
    status: 'PASSED',
    dimension: 'QUALITY',
    message: 'Пропусков и дублей временных меток не найдено.',
    actual: 100,
    expected: 100,
    unit: '%',
    source: 'invoice.csv',
    evaluatedAt: T,
    rulesetVersion: '1.0.0',
  },
  {
    ruleId: 'TM-001',
    title: 'Обязательные сигналы',
    status: 'UNAVAILABLE',
    dimension: 'PRESENCE',
    message: 'Нет связи с Battery1: данные не поступают. Это не признак неисправности батареи.',
    location: ['Battery1.power_kW', 'Battery1.SOC_%'],
    source: 'telemetry API',
    evaluatedAt: T,
    rulesetVersion: '1.0.0',
  },
  { ruleId: 'CT-005', title: 'Управление батареей', status: 'NOT_APPLICABLE', dimension: 'FUNCTION', message: 'На объекте нет батареи — подтверждено паспортом object.json.', source: 'object.json', evaluatedAt: T, rulesetVersion: '1.0.0' },
  { ruleId: 'DB-003', title: 'Привязка блоков к объекту', status: 'STALE', dimension: 'QUALITY', message: 'Конфигурация дашборда изменена после проверки — требуется перепроверка.', evaluatedAt: T, rulesetVersion: '1.0.0' },
];

const blocker = (p: Partial<Blocker>): Blocker => ({
  id: 'b1',
  sessionId: 's',
  stageId: 'METER_HISTORY',
  title: 'MH-004: История короче 24 месяцев',
  description: 'Нет официальных данных за 5 месяцев подряд.',
  severity: 'CRITICAL',
  status: 'OPEN',
  source: 'VALIDATION',
  ruleId: 'MH-004',
  createdAt: T,
  createdBy: 'system',
  ...p,
});

const EVENTS: AuditEvent[] = [
  { id: 'e1', action: 'SESSION_CREATED', actor: 'Инженер запуска', timestamp: '2026-11-05T09:00:00Z', rulesetVersion: '1.0.0' },
  { id: 'e2', action: 'STAGE_STARTED', actor: 'Инженер запуска', timestamp: '2026-11-05T09:05:00Z', stageId: 'METER_HISTORY', rulesetVersion: '1.0.0' },
  { id: 'e3', action: 'VALIDATION_RUN', actor: 'Инженер запуска', timestamp: '2026-11-05T09:13:00Z', stageId: 'METER_HISTORY', rulesetVersion: '1.0.0', payload: { failed: ['MH-004'] } },
  { id: 'e4', action: 'STAGE_BLOCKED', actor: 'system', timestamp: '2026-11-05T09:13:00Z', stageId: 'METER_HISTORY', rulesetVersion: '1.0.0' },
  { id: 'e5', action: 'TRANSITION_REJECTED', actor: 'Инженер запуска', timestamp: '2026-11-05T09:20:00Z', stageId: 'ASSET_CONTROL', rulesetVersion: '1.0.0', payload: { message: 'Этап ASSET_CONTROL недоступен: предыдущий этап REALTIME_TELEMETRY не завершён' } },
  { id: 'e6', action: 'BLOCKER_RESOLVED', actor: 'Инженер запуска', timestamp: '2026-11-05T11:40:00Z', stageId: 'METER_HISTORY', rulesetVersion: '1.0.0' },
  { id: 'e7', action: 'STAGE_COMPLETED', actor: 'Инженер запуска', timestamp: '2026-11-05T11:42:00Z', stageId: 'METER_HISTORY', rulesetVersion: '1.0.0' },
];

const STAGES = [
  { id: 'METER_HISTORY', title: 'История счётчиков' },
  { id: 'REALTIME_TELEMETRY', title: 'Данные в реальном времени' },
  { id: 'ASSET_CONTROL', title: 'Управление' },
  { id: 'FINAL_DASHBOARDS', title: 'Финальные дашборды' },
];

export function ProductSection() {
  return (
    <DsSection id="product" eyebrow="Продукт" title="Специальные компоненты" description="Элементы, отражающие модель запуска из ТЗ: этапы, проверки с подтверждениями, препятствия с точным местом и следующее действие.">
      <Specimen id="launch-progress" title="LaunchProgress" description="Общий прогресс: сегмент на этап, текущий этап, итоговая готовность — только после завершения всех четырёх этапов." tone="background">
        <div className="flex flex-col gap-6">
          <LaunchProgress
            objectName="Building1"
            objectCode="object_id: B1 · Europe/Brussels"
            currentStageId="REALTIME_TELEMETRY"
            stages={STAGES.map((s, i) => ({ ...s, status: (['COMPLETED', 'BLOCKED', 'NOT_STARTED', 'NOT_STARTED'] as const)[i]! }))}
          />
          <LaunchProgress objectName="Building3" currentStageId="FINAL_DASHBOARDS" ready stages={STAGES.map((s) => ({ ...s, status: 'COMPLETED' as const }))} />
        </div>
      </Specimen>

      <Specimen id="next-action" title="NextActionCard" description="Самый заметный элемент экрана: конкретный шаг, который устраняет препятствие или продвигает этап." tone="background">
        <NextActionCard
          stageLabel="История счётчиков"
          title="Получить полную выгрузку за недостающие месяцы"
          description="Нет официальных данных за ноябрь 2023 — март 2024 (5 месяцев)."
          reason="Препятствие MH-004 · блокирует этап 1"
          action={
            <Button variant="accent" size="lg">
              <Upload />
              Загрузить выгрузку
            </Button>
          }
        />
      </Specimen>

      <Specimen id="stage-card" title="LaunchStageCard" description="Все четыре статуса. Заблокированный этап выделен коралловой линией и счётчиком препятствий; текущий — бирюзовой линией." tone="background">
        <div className="grid gap-4 md:grid-cols-2">
          <LaunchStageCard order={1} title="История счётчиков" status="COMPLETED" checks={{ passed: 6, total: 6 }} responsible={{ name: 'И. Лютов', role: 'учёт' }} lastCheckedAt="2026-11-05T11:42:00Z" />
          <LaunchStageCard
            order={2}
            title="Данные в реальном времени"
            status="BLOCKED"
            current
            checks={{ passed: 3, total: 5 }}
            blockersCount={1}
            responsible={{ name: 'Н. Братченко', role: 'интеграции' }}
            lastCheckedAt={T}
            nextAction="Подключить телеметрию Battery1"
            actions={
              <>
                <Button size="sm" variant="secondary">
                  Запустить проверки
                </Button>
                <Button size="sm" variant="accent" disabled>
                  Завершить
                </Button>
              </>
            }
          />
          <LaunchStageCard order={3} title="Управление" status="IN_PROGRESS" current checks={{ passed: 2, total: 6 }} nextAction="Отправить тестовый setpoint через имитатор" />
          <LaunchStageCard
            order={4}
            title="Финальные дашборды"
            status="NOT_STARTED"
            dependency="Ожидает завершения этапа «Управление»"
            actions={
              <Button size="sm" variant="accent" disabled>
                Начать этап
              </Button>
            }
          />
        </div>
      </Specimen>

      <Specimen id="validation-status" title="ValidationStatus" description="Наличие, качество и функция — раздельно (ТЗ 2.2.3). Недоступный источник не даёт успеха." tone="background">
        <div className="flex flex-col gap-4">
          <ValidationStatus results={RESULTS} lastCheckedAt={T} rulesetVersion="1.0.0" />
          <ValidationStatus results={RESULTS.slice(1, 2)} unavailable lastCheckedAt={T} rulesetVersion="1.0.0" />
        </div>
      </Specimen>

      <Specimen id="validation-result" title="ValidationResult" description="Подтверждение проверки: источник, результат, время, версия правила и точное место проблемы." tone="background">
        <div className="grid gap-3 lg:grid-cols-2">
          {RESULTS.map((r) => (
            <ValidationResult key={r.ruleId} result={r} onOpen={() => undefined} />
          ))}
        </div>
      </Specimen>

      <Specimen id="blockers" title="BlockerCard · BlockerPanel" description="Препятствие указывает место: интервалы и поля, актив и сигналы или причину." tone="background">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <StateLabel>Открытое · устранённое · принятое по правилу</StateLabel>
            <BlockerCard
              blocker={blocker({})}
              location={[
                { label: 'Месяцы', value: '2023-11 … 2024-03' },
                { label: 'Поле', value: 'Grid.energy_kWh.offtake_invoice' },
              ]}
              nextAction="Получить полную выгрузку за недостающие месяцы"
              actions={<Button size="sm" variant="secondary">Перепроверить</Button>}
            />
            <BlockerCard blocker={blocker({ id: 'b2', title: 'MH-002: Смешанные единицы', status: 'RESOLVED', resolvedAt: '2026-11-05T11:40:00Z', resolution: 'Загружена исправленная выгрузка в кВт·ч' })} />
            <BlockerCard blocker={blocker({ id: 'b3', title: 'Пробел 12.03.2025', status: 'WAIVED', source: 'MANUAL', resolvedAt: '2026-11-05T11:30:00Z', resolution: 'Плановое отключение, обработано по согласованному правилу' })} />
          </div>
          <div className="flex flex-col gap-3">
            <StateLabel>Панель с препятствиями · без препятствий</StateLabel>
            <BlockerPanel
              items={[
                {
                  blocker: blocker({ id: 'p1', stageId: 'REALTIME_TELEMETRY', ruleId: 'TM-001', title: 'TM-001: Нет телеметрии актива', description: 'Батарея не передаёт данные. Отсутствие связи не трактуется как неисправность актива.' }),
                  location: [
                    { label: 'Актив', value: 'Battery1' },
                    { label: 'Сигналы', value: 'Battery1.power_kW, Battery1.SOC_%' },
                  ],
                  nextAction: 'Подключить телеметрию по отсутствующим сигналам',
                },
                { blocker: blocker({ id: 'p2', status: 'RESOLVED', title: 'TM-003: Полнота ниже 99 %', resolvedAt: T }) },
              ]}
            />
            <BlockerPanel items={[]} />
          </div>
        </div>
      </Specimen>

      <Specimen id="evidence" title="EvidenceCard · EvidencePanel" description="Неактуальные материалы не удаляются: они помечаются и требуют перепроверки." tone="background">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <EvidenceCard evidence={{ id: 'ev1', title: 'Отчёт проверки истории учёта', type: 'VALIDATION_REPORT', fileName: 'report-meter-history.pdf', sizeBytes: 182_000, createdAt: T, createdBy: 'system', source: 'invoice.csv', rulesetVersion: '1.0.0', checksumSha256: '9a395959d3ecee76a0fe47a63a774211' }} onDownload={() => undefined} />
            <EvidenceCard evidence={{ id: 'ev2', title: 'Журнал тестовых команд', type: 'COMMAND_LOG', fileName: 'control-test.json', sizeBytes: 12_400, createdAt: T, createdBy: 'Инженер запуска', stale: true }} />
          </div>
          <EvidencePanel
            confirmations={{ received: 1, required: 2 }}
            onAdd={() => undefined}
            items={[
              { id: 'x1', title: 'Акт приёмки истории учёта', type: 'SIGNED_ACT', createdAt: T, createdBy: 'И. Лютов', rulesetVersion: '1.0.0' },
              { id: 'x2', title: 'Снимок карты сигналов', type: 'SCREENSHOT', createdAt: T, createdBy: 'Н. Братченко', stale: true },
            ]}
          />
        </div>
      </Specimen>

      <Specimen id="data-quality" title="DataQualityIndicator" description="Пороги передаются из конфигурации правил (полнота ≥ 99 % за 48 ч, возраст ≤ 30 мин — настройки демо по ТЗ)." tone="background">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DataQualityIndicator title="Grid" period="последние 48 ч" completenessPct={99.8} minCompletenessPct={99} freshnessMinutes={6} maxAgeMinutes={30} gaps={0} duplicates={0} />
            <DataQualityIndicator title="PV1" period="последние 48 ч" completenessPct={99.2} minCompletenessPct={99} freshnessMinutes={12} maxAgeMinutes={30} gaps={3} duplicates={0} />
            <DataQualityIndicator title="Demand" period="последние 48 ч" completenessPct={96.4} minCompletenessPct={99} freshnessMinutes={45} maxAgeMinutes={30} gaps={69} duplicates={2} />
            <DataQualityIndicator title="Battery1" period="последние 48 ч" minCompletenessPct={99} unavailable lastSuccessAt="2026-11-04T22:15:00Z" />
          </div>
          <div className="flex flex-wrap gap-2">
            <DataQualityIndicator compact completenessPct={99.8} minCompletenessPct={99} />
            <DataQualityIndicator compact completenessPct={99.2} minCompletenessPct={99} gaps={3} />
            <DataQualityIndicator compact completenessPct={96.4} minCompletenessPct={99} />
            <DataQualityIndicator compact minCompletenessPct={99} unavailable />
          </div>
        </div>
      </Specimen>

      <Specimen id="audit" title="AuditTimeline" description="Журнал переходов: время, автор, этап, версия правил и результат.">
        <AuditTimeline events={EVENTS} />
      </Specimen>
    </DsSection>
  );
}
