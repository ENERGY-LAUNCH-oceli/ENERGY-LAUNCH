import { Activity, Building2, Gauge, History, LayoutDashboard, type LucideIcon, Rocket, Settings, ShieldCheck, SlidersHorizontal, Zap } from 'lucide-react';
import { ROUTES, type ObjectSection } from '@/app/routes';
import type { StageId } from '@/types';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Путь; для разделов объекта строится от текущего объекта. */
  to: (objectId: string) => string;
  /** Раздел объекта (для активного состояния). */
  section?: ObjectSection | 'object';
  hint: string;
}

/** Восемь разделов боковой навигации. */
export const PRIMARY_NAV: NavItem[] = [
  { id: 'overview', label: 'Обзор', icon: Gauge, to: () => ROUTES.overview, hint: 'Портфель объектов и статусы запусков' },
  { id: 'objects', label: 'Объекты', icon: Building2, to: () => ROUTES.objects, section: 'object', hint: 'Паспорта, активы, точки подключения' },
  { id: 'launch', label: 'Запуски', icon: Rocket, to: (id) => ROUTES.objectSection(id, 'launch'), section: 'launch', hint: 'Карточка запуска текущего объекта' },
  { id: 'checks', label: 'Проверки', icon: ShieldCheck, to: (id) => ROUTES.objectSection(id, 'history'), section: 'history', hint: 'История счётчиков и телеметрия' },
  { id: 'control', label: 'Управление', icon: SlidersHorizontal, to: (id) => ROUTES.objectSection(id, 'control'), section: 'control', hint: 'Тесты контура управления' },
  { id: 'dashboards', label: 'Дашборды', icon: LayoutDashboard, to: (id) => ROUTES.objectSection(id, 'dashboards'), section: 'dashboards', hint: 'Финальные дашборды и приёмка' },
  { id: 'audit', label: 'Журнал', icon: History, to: (id) => ROUTES.objectSection(id, 'audit'), section: 'audit', hint: 'Переходы и подтверждения' },
  { id: 'settings', label: 'Настройки', icon: Settings, to: () => ROUTES.settings, hint: 'Правила проверок и интерфейс' },
];

/** Контекстная навигация внутри объекта: этапы и журнал. */
export const OBJECT_TABS: { section: ObjectSection; label: string; icon: LucideIcon; stageId?: StageId }[] = [
  { section: 'launch', label: 'Запуск', icon: Rocket },
  { section: 'history', label: 'История счётчиков', icon: History, stageId: 'METER_HISTORY' },
  { section: 'telemetry', label: 'Телеметрия', icon: Activity, stageId: 'REALTIME_TELEMETRY' },
  { section: 'control', label: 'Управление', icon: Zap, stageId: 'ASSET_CONTROL' },
  { section: 'dashboards', label: 'Дашборды', icon: LayoutDashboard, stageId: 'FINAL_DASHBOARDS' },
  { section: 'audit', label: 'Журнал', icon: History },
];

/** «Проверки» подсвечивается на страницах обоих этапов с данными. */
export const sectionOwner = (section: string | undefined): string | undefined =>
  section === 'telemetry' || section === 'history' ? 'checks' : section === 'launch' ? 'launch' : section;
