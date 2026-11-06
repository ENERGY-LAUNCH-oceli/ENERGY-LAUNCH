import type { InputKind, InputRef, LaunchInputs, LaunchSession, RulesConfig, StageId, StageStatus, ValidationResult, ValidationSnapshot } from '@/types';

/** SHA-256 файла набора по объекту и имени файла (неизменяемый срез). */
export type ShaResolver = (objectId: string, fileName: string) => string | undefined;

/** Какие этапы зависят от каждого вида входных данных – их подтверждения устаревают при изменении. */
export const AFFECTED_STAGES: Record<InputKind, StageId[]> = {
  invoice: ['METER_HISTORY', 'FINAL_DASHBOARDS'],
  passport: ['METER_HISTORY', 'REALTIME_TELEMETRY', 'ASSET_CONTROL', 'FINAL_DASHBOARDS'],
  telemetry: ['REALTIME_TELEMETRY', 'ASSET_CONTROL', 'FINAL_DASHBOARDS'],
  control: ['ASSET_CONTROL', 'FINAL_DASHBOARDS'],
  dashboard: ['FINAL_DASHBOARDS'],
};

/** Какие входы использует проверка этапа. */
export const STAGE_INPUTS: Record<StageId, InputKind[]> = {
  METER_HISTORY: ['invoice', 'passport'],
  REALTIME_TELEMETRY: ['passport', 'telemetry'],
  ASSET_CONTROL: ['passport', 'telemetry', 'control'],
  FINAL_DASHBOARDS: ['invoice', 'passport', 'telemetry', 'control', 'dashboard'],
};

/** Текущая версия входа. Отсутствующий вход – версия 0 (это не успех, а «нет данных»). */
export function inputRef(kind: InputKind, inputs: LaunchInputs, sha?: ShaResolver): InputRef {
  const oid = inputs.object.id;
  switch (kind) {
    case 'invoice': {
      const d = inputs.invoice;
      const fileName = d?.report?.meta.fileName ?? d?.fileName;
      const h = d && fileName ? sha?.(oid, fileName) : undefined;
      return { kind, label: d ? `${fileName} v${d.version}` : 'invoice.csv – не загружен', version: d?.version ?? 0, ...(fileName ? { fileName } : {}), ...(h ? { sha256: h } : {}), ...(d?.report ? { rows: d.report.meta.rows } : {}) };
    }
    case 'telemetry': {
      const d = inputs.telemetry;
      const fileName = d?.report.meta.fileName;
      const h = d && fileName ? sha?.(oid, fileName) : undefined;
      return { kind, label: d ? `${fileName} v${d.version}` : 'telemetry.csv – не загружен', version: d?.version ?? 0, ...(fileName ? { fileName } : {}), ...(h ? { sha256: h } : {}), ...(d ? { rows: d.report.meta.rows } : {}) };
    }
    case 'passport': {
      const p = inputs.passport;
      const h = p ? sha?.(oid, p.fileName) : undefined;
      return { kind, label: p ? `${p.fileName} v${p.version}` : 'object.json – не загружен', version: p?.version ?? 0, ...(p ? { fileName: p.fileName } : {}), ...(h ? { sha256: h } : {}) };
    }
    case 'control': {
      const n = (inputs.controlCommands ?? []).length;
      return { kind, label: `журнал тестовых команд: ${n}`, version: n };
    }
    case 'dashboard': {
      const v = inputs.dashboard?.published?.version ?? 0;
      return { kind, label: v ? `конфигурация панели v${v}` : 'панель не опубликована', version: v };
    }
  }
}

export const stageInputRefs = (stageId: StageId, inputs: LaunchInputs, sha?: ShaResolver) => STAGE_INPUTS[stageId].map((k) => inputRef(k, inputs, sha));

/** Снимок прогона проверок: входы, правила, результаты, статус до и после. */
export function makeSnapshot(o: {
  id: string;
  session: LaunchSession;
  stageId: StageId;
  inputs: LaunchInputs;
  results: ValidationResult[];
  statusBefore: StageStatus;
  at: string;
  actor: string;
  trigger: ValidationSnapshot['trigger'];
  reason?: string;
  sha?: ShaResolver;
}): ValidationSnapshot {
  return {
    id: o.id,
    objectId: o.session.objectId,
    stageId: o.stageId,
    at: o.at,
    actor: o.actor,
    trigger: o.trigger,
    ...(o.reason ? { reason: o.reason } : {}),
    rulesetVersion: o.session.rulesetVersion,
    inputs: stageInputRefs(o.stageId, o.inputs, o.sha),
    results: o.results,
    statusBefore: o.statusBefore,
    statusAfter: o.session.stages[o.stageId].status,
  };
}

/** Значение параметра правила по configRef (например, `telemetry.maxAgeMinutes`). */
export function configValue(ruleset: RulesConfig, ref: string | undefined): unknown {
  if (!ref) return undefined;
  return ref.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], ruleset);
}

/** Входы этапа изменились после снимка – подтверждения снимка устарели. */
export function changedInputs(snapshot: ValidationSnapshot, inputs: LaunchInputs): InputRef[] {
  const now = stageInputRefs(snapshot.stageId, inputs);
  return now.filter((cur) => {
    const was = snapshot.inputs.find((i) => i.kind === cur.kind);
    return !was || was.version !== cur.version;
  });
}
