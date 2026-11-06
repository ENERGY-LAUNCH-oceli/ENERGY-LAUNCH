import type { Asset, AssetSignal, EnergyObject } from '@/types';

/**
 * Демонстрационный объект. Все реквизиты условные и не относятся к реальным
 * организациям; заменяются данными паспорта кейса OE-04 при их сверке.
 */
export const DEMO_OBJECT_ID = 'obj-demo-001';
export const DEMO_METERING_POINT_ID = 'mp-demo-001';

const signal = (assetId: string, id: string, s: Omit<AssetSignal, 'id' | 'assetId'>): AssetSignal => ({ id, assetId, ...s });

const assets: Asset[] = [
  {
    id: 'asset-meter-1',
    objectId: DEMO_OBJECT_ID,
    type: 'METER',
    name: 'Счётчик коммерческого учёта ПУ-1',
    controllable: false,
    signals: [
      signal('asset-meter-1', 'sig-energy-export', { kind: 'ENERGY_EXPORT', tag: 'PU1.EXP.30M', unit: 'kWh', direction: 'READ', samplingSec: 1800, meteringPointId: DEMO_METERING_POINT_ID }),
    ],
  },
  {
    id: 'asset-ctrl-1',
    objectId: DEMO_OBJECT_ID,
    type: 'PLANT_CONTROLLER',
    name: 'Контроллер станции (PPC)',
    ratedPowerMw: 15,
    controllable: true,
    signals: [
      signal('asset-ctrl-1', 'sig-p', { kind: 'ACTIVE_POWER', tag: 'PPC.P', unit: 'MW', direction: 'READ', samplingSec: 60 }),
      signal('asset-ctrl-1', 'sig-q', { kind: 'REACTIVE_POWER', tag: 'PPC.Q', unit: 'Mvar', direction: 'READ', samplingSec: 60 }),
      signal('asset-ctrl-1', 'sig-u', { kind: 'VOLTAGE', tag: 'PPC.U', unit: 'kV', direction: 'READ', samplingSec: 60 }),
      signal('asset-ctrl-1', 'sig-f', { kind: 'FREQUENCY', tag: 'PPC.F', unit: 'Hz', direction: 'READ', samplingSec: 60 }),
      signal('asset-ctrl-1', 'sig-p-sp', { kind: 'ACTIVE_POWER_SETPOINT', tag: 'PPC.P_SP', unit: 'MW', direction: 'WRITE' }),
      signal('asset-ctrl-1', 'sig-q-sp', { kind: 'REACTIVE_POWER_SETPOINT', tag: 'PPC.Q_SP', unit: 'Mvar', direction: 'WRITE' }),
    ],
  },
  {
    id: 'asset-brk-1',
    objectId: DEMO_OBJECT_ID,
    type: 'BREAKER',
    name: 'Выключатель присоединения Q1',
    controllable: true,
    signals: [signal('asset-brk-1', 'sig-brk', { kind: 'BREAKER_STATE', tag: 'Q1.POS', unit: 'state', direction: 'READ', samplingSec: 60 })],
  },
];

export const DEMO_OBJECT: EnergyObject = {
  id: DEMO_OBJECT_ID,
  code: 'DEMO-PV-15',
  name: 'Демо-объект: СЭС 15 МВт',
  type: 'SOLAR_PV',
  status: 'LAUNCHING',
  passport: {
    objectId: DEMO_OBJECT_ID,
    passportNumber: 'DEMO-PASSPORT-0001',
    owner: 'Демо-владелец',
    operator: 'Демо-оператор',
    installedCapacityMw: 15,
    timezone: 'Europe/Moscow',
    location: { region: 'Демо-регион' },
    plannedLaunchDate: '2026-12-01',
    dataFiles: { invoice: 'invoice.csv', telemetry: 'telemetry.csv' },
    declaredHistory: { from: '2024-11-01', to: '2026-10-31' },
    documents: [],
  },
  gridConnection: {
    id: 'gc-demo-001',
    objectId: DEMO_OBJECT_ID,
    gridOperator: 'Демо-сетевая организация',
    pointOfConnection: 'ПС 110 кВ «Демо», яч. 5',
    voltageLevelKv: 110,
    maxCapacityMw: 15,
    meteringPointIds: [DEMO_METERING_POINT_ID],
    eanOfftake: '541448800000000017',
    eanInjection: '541448800000000024',
  },
  assets,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};
