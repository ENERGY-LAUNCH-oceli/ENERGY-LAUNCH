import { ACTIVE_RULESET, CASE4_CHECK_POINT } from '@/config/rules';
import { createDashboardWorkspace } from '@/engine/dashboards';
import { importInvoice } from '@/services/invoice-import';
import { importPassport, importTelemetry } from '@/services/telemetry-import';
import type { EnergyObject, InvoiceDataset, LaunchInputs, SitePassport, TelemetryDatasetV2 } from '@/types';
import type { ObjectCatalogEntry } from '../objects/catalog';

/**
 * Набор кейса 4 (Building1–6): читается из public/case4 при старте приложения.
 * Набор хранится только локально (ТЗ 4.3 п. 5, 8). Файлы проходят тот же импорт и те же проверки,
 * что и загрузка пользователем. Вымышленные значения в паспорт не вносятся.
 */
export interface Case4ManifestFile {
  path: string;
  sizeBytes: number;
  sha256: string;
  processed: boolean;
  rows?: number;
  period?: { first: string | null; last: string | null };
}

export interface Case4Manifest {
  dataset: string;
  objects: string[];
  files: Case4ManifestFile[];
}

export interface Case4Progress {
  done: number;
  total: number;
  label: string;
}

const BASE = '/case4';

async function fetchText(path: string): Promise<string | null> {
  const res = await fetch(`${BASE}/${path}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const type = res.headers.get('content-type') ?? '';
  // SPA-сервер отдаёт index.html на любой путь – это не файл набора
  if (type.includes('text/html')) return null;
  return res.text();
}

export async function fetchCase4Manifest(): Promise<Case4Manifest | null> {
  try {
    const text = await fetchText('manifest.json');
    return text ? (JSON.parse(text) as Case4Manifest) : null;
  } catch {
    return null;
  }
}

/** Объект платформы из паспорта: только поля object.json; отсутствующее остаётся пустым. */
function energyObject(p: SitePassport): EnergyObject {
  return {
    id: p.objectId,
    code: p.objectId.toUpperCase().replace('_', '-'),
    name: p.name,
    type: 'HYBRID',
    status: 'LAUNCHING',
    passport: {
      objectId: p.objectId,
      passportNumber: '',
      owner: '',
      operator: '',
      installedCapacityMw: 0,
      timezone: p.timezone,
      location: { region: p.address?.split(', ').at(-2) ?? '', ...(p.address ? { address: p.address } : {}), ...(p.coordinates ? { latitude: p.coordinates.lat, longitude: p.coordinates.lon } : {}) },
      dataFiles: p.dataFiles,
      documents: [],
    },
    gridConnection: { id: `gc-${p.objectId}`, objectId: p.objectId, gridOperator: '', pointOfConnection: '', voltageLevelKv: 0, maxCapacityMw: 0, meteringPointIds: [], eanOfftake: p.ean.offtake, eanInjection: p.ean.injection },
    assets: [],
    createdAt: CASE4_CHECK_POINT,
    updatedAt: CASE4_CHECK_POINT,
  };
}

const fileMeta = (m: Case4Manifest, path: string) => m.files.find((f) => f.path === path);

/** Загрузка и проверка одного объекта набора. */
async function loadObject(m: Case4Manifest, folder: string): Promise<ObjectCatalogEntry | null> {
  const passportText = await fetchText(`${folder}/object.json`);
  if (!passportText) return null;
  const loadedAt = CASE4_CHECK_POINT;
  const parsed = await importPassport(passportText, { fileName: 'object.json', source: 'UPLOAD' });
  const passport: SitePassport = { ...parsed, version: 1, loadedAt };
  const object = energyObject(passport);

  let invoice: InvoiceDataset | undefined;
  const invPath = passport.dataFiles.invoice ? `${folder}/${passport.dataFiles.invoice}` : null;
  const invText = invPath && fileMeta(m, invPath) ? await fetchText(invPath) : null;
  if (invText) {
    const report = await importInvoice(invText, ACTIVE_RULESET.meterHistory, { fileName: passport.dataFiles.invoice!, uploadedAt: loadedAt, source: 'UPLOAD' });
    invoice = { kind: 'INVOICE', id: `invoice-${passport.objectId}-v1`, objectId: passport.objectId, source: 'CSV_IMPORT', fileName: report.meta.fileName, importedAt: loadedAt, periodStart: report.period.first ?? loadedAt, periodEnd: report.period.last ?? loadedAt, version: 1, report };
  }

  let telemetry: TelemetryDatasetV2 | undefined;
  const telPath = passport.dataFiles.telemetry ? `${folder}/${passport.dataFiles.telemetry}` : null;
  const telText = telPath && fileMeta(m, telPath) ? await fetchText(telPath) : null;
  if (telText) {
    const report = await importTelemetry(telText, passport, ACTIVE_RULESET.telemetry, { fileName: passport.dataFiles.telemetry!, uploadedAt: loadedAt, source: 'UPLOAD', checkPoint: ACTIVE_RULESET.telemetry.checkPoint });
    telemetry = { kind: 'TELEMETRY', id: `telemetry-${passport.objectId}-v1`, objectId: passport.objectId, version: 1, report };
  }

  const inputs: LaunchInputs = {
    object,
    ...(invoice ? { invoice } : {}),
    passport,
    ...(telemetry ? { telemetry } : {}),
    controlTests: [],
    controlCommands: [],
    dashboards: [],
    dashboard: createDashboardWorkspace(passport.objectId, loadedAt, 'Инженер запуска'),
  };
  const pv = passport.assets.filter((a) => a.type === 'PV');
  const bat = passport.assets.filter((a) => a.type === 'BATTERY');
  return {
    id: passport.objectId,
    code: object.code,
    name: passport.name,
    city: passport.address?.split(', ')[2] ?? '–',
    address: passport.address ?? 'адрес не указан в паспорте',
    kind: `Здание · ${folder}`,
    assets: [pv.map((a) => a.assetId).join(' · '), bat.map((a) => a.assetId).join(' · ')].filter(Boolean).join(' · ') || 'активов нет',
    assetCount: passport.assets.length,
    responsible: 'Инженер запуска',
    ean: { offtake: passport.ean.offtake ?? '', injection: passport.ean.injection ?? '' },
    scenarioId: 'case4',
    equipment: passport.assets.map((a) => ({ id: a.assetId, type: a.type === 'PV' ? ('pv' as const) : ('battery' as const), prefix: a.prefix })),
    seedUntil: 'METER_HISTORY',
    seedAt: CASE4_CHECK_POINT,
    source: 'CASE4',
    folder,
    inputs,
    fileHashes: Object.fromEntries(m.files.filter((f) => f.path.startsWith(`${folder}/`)).map((f) => [f.path.slice(folder.length + 1), f.sha256])),
  };
}

/** Портфель из набора кейса 4 или null, если набора нет. Объект с ошибкой разбора пропускается. */
export async function loadCase4Portfolio(onProgress?: (p: Case4Progress) => void): Promise<{ manifest: Case4Manifest; entries: ObjectCatalogEntry[]; errors: string[] } | null> {
  const manifest = await fetchCase4Manifest();
  if (!manifest?.objects?.length) return null;
  const entries: ObjectCatalogEntry[] = [];
  const errors: string[] = [];
  for (const [i, folder] of manifest.objects.entries()) {
    onProgress?.({ done: i, total: manifest.objects.length, label: folder });
    try {
      const e = await loadObject(manifest, folder);
      if (e) entries.push(e);
      else errors.push(`${folder}: нет object.json`);
    } catch (err) {
      errors.push(`${folder}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  onProgress?.({ done: manifest.objects.length, total: manifest.objects.length, label: 'готово' });
  return { manifest, entries, errors };
}
