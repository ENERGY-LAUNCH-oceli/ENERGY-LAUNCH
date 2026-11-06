import type { Id, IsoDate, IsoDateTime } from './common';
import type { MeasurementUnit } from './measurement';

export const ENERGY_OBJECT_TYPES = [
  'SOLAR_PV',
  'WIND',
  'BESS',
  'HYBRID',
  'GAS_TURBINE',
  'HYDRO',
  'SUBSTATION',
] as const;
export type EnergyObjectType = (typeof ENERGY_OBJECT_TYPES)[number];

export const ENERGY_OBJECT_STATUSES = ['DRAFT', 'LAUNCHING', 'OPERATIONAL', 'SUSPENDED'] as const;
export type EnergyObjectStatus = (typeof ENERGY_OBJECT_STATUSES)[number];

export const ASSET_TYPES = [
  'METER',
  'INVERTER',
  'TRANSFORMER',
  'BREAKER',
  'BATTERY',
  'GENERATOR',
  'PLANT_CONTROLLER',
  'WEATHER_STATION',
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const SIGNAL_KINDS = [
  'ACTIVE_POWER',
  'REACTIVE_POWER',
  'VOLTAGE',
  'CURRENT',
  'FREQUENCY',
  'ENERGY_IMPORT',
  'ENERGY_EXPORT',
  'BREAKER_STATE',
  'STATE_OF_CHARGE',
  'ACTIVE_POWER_SETPOINT',
  'REACTIVE_POWER_SETPOINT',
  'IRRADIANCE',
] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

export const SIGNAL_DIRECTIONS = ['READ', 'WRITE', 'READ_WRITE'] as const;
export type SignalDirection = (typeof SIGNAL_DIRECTIONS)[number];

/** Сигнал (тег) актива: измерение, состояние или уставка. */
export interface AssetSignal {
  id: Id;
  assetId: Id;
  kind: SignalKind;
  /** Тег в SCADA / системе сбора данных. */
  tag: string;
  unit: MeasurementUnit;
  direction: SignalDirection;
  /** Номинальный период опроса, секунды. */
  samplingSec?: number;
  /** Для сигналов коммерческого учёта — идентификатор точки поставки. */
  meteringPointId?: Id;
}

/** Оборудование объекта. */
export interface Asset {
  id: Id;
  objectId: Id;
  type: AssetType;
  name: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  ratedPowerMw?: number;
  /** Поддерживает ли актив дистанционное управление (этап Asset Control). */
  controllable: boolean;
  signals: AssetSignal[];
}

/** Технологическое присоединение к сети. */
export interface GridConnection {
  id: Id;
  objectId: Id;
  gridOperator: string;
  pointOfConnection: string;
  voltageLevelKv: number;
  maxCapacityMw: number;
  /** Точки коммерческого учёта, по которым сверяются счета. */
  meteringPointIds: Id[];
  /** Коды EAN точки подключения (object.json → grid_connection). */
  eanOfftake?: string | null;
  eanInjection?: string | null;
  agreementNumber?: string;
  agreementDate?: IsoDate;
}

export interface PassportDocument {
  id: Id;
  title: string;
  reference: string;
  issuedAt?: IsoDate;
}

/** Паспорт объекта: юридические и технические реквизиты. */
export interface ObjectPassport {
  objectId: Id;
  passportNumber: string;
  owner: string;
  operator: string;
  installedCapacityMw: number;
  /** IANA-часовой пояс площадки, например `Europe/Moscow`. */
  timezone: string;
  location: {
    region: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  plannedLaunchDate?: IsoDate;
  /** Файлы данных объекта (object.json → data_files); null — файл не предоставлен. */
  dataFiles?: { invoice: string | null; telemetry: string | null };
  /** Заявленный период официальной истории. */
  declaredHistory?: { from: IsoDate; to: IsoDate };
  documents: PassportDocument[];
}

/** Энергетический объект — корневая сущность платформы. */
export interface EnergyObject {
  id: Id;
  code: string;
  name: string;
  type: EnergyObjectType;
  status: EnergyObjectStatus;
  passport: ObjectPassport;
  gridConnection: GridConnection;
  assets: Asset[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
