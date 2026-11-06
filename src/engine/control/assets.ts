import type { BenchAssetState, ControlAsset, ControlSignals, ControlTestKind, PassportAsset, PassportAssetType, SitePassport, TelemetryReport } from '@/types';

/** Управляемый актив по паспорту (без состояния стенда). */
export interface ControlTarget {
  assetId: string;
  type: PassportAssetType;
  prefix: string;
  kind: ControlTestKind;
  supported: boolean;
  notSupportedReason?: string;
  signals: ControlSignals;
}

/** Сигналы управления актива по соглашению о именах telemetry.csv (ТЗ 5.2). */
export function controlSignals(asset: Pick<PassportAsset, 'type' | 'prefix'>): ControlSignals {
  return {
    sent: asset.type === 'BATTERY' ? `${asset.prefix}.power_kW.setpoint_sent` : null,
    received: `${asset.prefix}.power_kW.setpoint_received`,
    actual: `${asset.prefix}.power_kW`,
  };
}

/**
 * Какие тесты управления требуются по паспорту object.json:
 * батарея – setpoint; PV – ограничение выработки, если в карте есть сигнал принятой уставки.
 * Отсутствие актива или функции подтверждается паспортом – оборудование не придумывается.
 */
export function controlTargets(passport: SitePassport | undefined): ControlTarget[] {
  if (!passport) return [];
  return passport.assets.map((a) => {
    const signals = controlSignals(a);
    const needed = [signals.sent, signals.received, signals.actual].filter((s): s is string => !!s);
    const missing = needed.filter((s) => !a.signals.includes(s));
    const kind: ControlTestKind = a.type === 'BATTERY' ? 'BATTERY_SETPOINT' : 'PV_CURTAILMENT';
    return {
      assetId: a.assetId,
      type: a.type,
      prefix: a.prefix,
      kind,
      supported: missing.length === 0,
      ...(missing.length
        ? { notSupportedReason: a.type === 'PV' ? `PV без управления ограничением выработки: в паспорте нет ${missing.join(', ')}` : `В карте сигналов нет ${missing.join(', ')}` }
        : {}),
      signals,
    };
  });
}

/** Состояние связи актива по результатам этапа 2. */
function linkState(report: TelemetryReport | undefined, actualSignal: string): ControlAsset['link'] {
  const s = report?.signals.find((x) => x.signal === actualSignal);
  if (!s) return 'UNKNOWN';
  return s.diagnosis === 'NO_COMMUNICATION' || s.diagnosis === 'NOT_IN_DATA' ? 'NO_COMMUNICATION' : 'OK';
}

/** Управляемые активы для страницы этапа: паспорт + состояние стенда + связь. */
export function controlAssets(
  passport: SitePassport | undefined,
  report: TelemetryReport | undefined,
  describe: (objectId: string, assetId: string, type: PassportAssetType) => BenchAssetState,
): ControlAsset[] {
  if (!passport) return [];
  return controlTargets(passport).map((t) => {
    const link = linkState(report, t.signals.actual);
    const bench = describe(passport.objectId, t.assetId, t.type);
    return { ...t, link, bench: link === 'NO_COMMUNICATION' ? { ...bench, controller: 'NO_RESPONSE' } : bench };
  });
}
