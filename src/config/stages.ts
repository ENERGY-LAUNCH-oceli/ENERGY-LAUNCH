import type { StageId, StageStatus } from '@/types';

/** Отображаемые метаданные этапов (презентационный справочник, не бизнес-правила). */
export const STAGE_META: Record<StageId, { title: string; titleRu: string; description: string }> = {
  METER_HISTORY: {
    title: 'Meter History',
    titleRu: 'История учёта',
    description: 'Сверка счетов с интервальной историей приборов коммерческого учёта.',
  },
  REALTIME_TELEMETRY: {
    title: 'Real-time Telemetry',
    titleRu: 'Телеметрия',
    description: 'Проверка частоты, полноты и задержки потока оперативных данных.',
  },
  ASSET_CONTROL: {
    title: 'Asset Control',
    titleRu: 'Управление активами',
    description: 'Испытания команд управления: квитирование, исполнение, обратная связь.',
  },
  FINAL_DASHBOARDS: {
    title: 'Final Dashboards',
    titleRu: 'Итоговые панели',
    description: 'Приёмка итоговых панелей мониторинга объекта.',
  },
};

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  NOT_STARTED: 'Не начат',
  IN_PROGRESS: 'В работе',
  BLOCKED: 'Заблокирован',
  COMPLETED: 'Завершён',
};
