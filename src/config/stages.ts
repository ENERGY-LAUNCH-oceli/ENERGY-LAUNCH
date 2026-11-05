import type { StageId, StageStatus } from '@/types';

/** Отображаемые метаданные этапов (презентационный справочник, не бизнес-правила). */
export const STAGE_META: Record<StageId, { title: string; titleRu: string; description: string }> = {
  METER_HISTORY: {
    title: 'Meter History',
    titleRu: 'История счётчиков',
    description: 'Официальные данные расчётного учёта за 24 месяца: период, полнота, связь счётчиков с объектом.',
  },
  REALTIME_TELEMETRY: {
    title: 'Real-time Telemetry',
    titleRu: 'Данные в реальном времени',
    description: 'Телеметрия установленных активов: сигналы, привязки, актуальность, полнота и качество потока.',
  },
  ASSET_CONTROL: {
    title: 'Asset Control',
    titleRu: 'Управление',
    description: 'Контур управления: отправка setpoint, приём контроллером, отклик актива в ожидаемом интервале.',
  },
  FINAL_DASHBOARDS: {
    title: 'Final Dashboards',
    titleRu: 'Финальные дашборды',
    description: 'Обязательные блоки, данные нужного объекта, права доступа, приёмка ответственным.',
  },
};

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  NOT_STARTED: 'Не начат',
  IN_PROGRESS: 'В работе',
  BLOCKED: 'Заблокирован',
  COMPLETED: 'Завершён',
};
