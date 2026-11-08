// Манифест набора данных кейса 4 (паспорт кейса, «Версия / контроль»): SHA-256 каждого файла,
// период, число строк, фактический шаг. Фиксирует неизменяемый срез, на который ссылаются проверки.
// Запуск: node scripts/case4-manifest.mjs  → public/case4/manifest.json
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'public/case4';
/** Файлы, которые прототип хранит, но пока не обрабатывает (не выводятся в интерфейсе). */
const NOT_PROCESSED = {
  'Configuration_file.json': 'Шаблон конфигурации объекта (доп. функция ТЗ 3.3 «заполнение конфигурационного файла»); файл не является валидным JSON',
};

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

function csvStats(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(';');
  const ts = lines.slice(1).map((l) => l.slice(0, l.indexOf(';')));
  const steps = new Map();
  for (let i = 1; i < ts.length; i++) {
    const m = (Date.parse(ts[i]) - Date.parse(ts[i - 1])) / 60000;
    steps.set(m, (steps.get(m) ?? 0) + 1);
  }
  const step = [...steps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { rows: ts.length, columns: header, period: { first: ts[0] ?? null, last: ts.at(-1) ?? null }, stepMinutes: step, bom: text.charCodeAt(0) === 0xfeff };
}

const files = walk(ROOT)
  .filter((f) => !f.endsWith('manifest.json'))
  .sort()
  .map((path) => {
    const buf = readFileSync(path);
    const rel = relative(ROOT, path).replaceAll('\\', '/');
    const name = rel.split('/').at(-1);
    const entry = { path: rel, sizeBytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
    if (name.endsWith('.csv')) Object.assign(entry, csvStats(buf.toString('utf-8')));
    if (NOT_PROCESSED[name]) Object.assign(entry, { processed: false, note: NOT_PROCESSED[name] });
    else entry.processed = true;
    return entry;
  });

// Версия действующего набора правил: из src/config/rules (index.ts → ruleset.vX_Y.ts)
const rulesDir = join(ROOT, '..', '..', 'src', 'config', 'rules');
const active = /ACTIVE_RULESET\s*=\s*RULESET_V(\d+)(?:_(\d+))?/.exec(readFileSync(join(rulesDir, 'index.ts'), 'utf8'));
const rulesFile = active ? `ruleset.v${active[1]}${active[2] ? `_${active[2]}` : ''}.ts` : null;
const rulesetVersion = rulesFile ? (/version:\s*'([^']+)'/.exec(readFileSync(join(rulesDir, rulesFile), 'utf8'))?.[1] ?? null) : null;

const objects = [...new Set(files.map((f) => f.path.split('/')[0]).filter((d) => d.startsWith('Building')))];
const manifest = {
  dataset: 'Кейс 4. Запуск энергетического объекта на платформе – набор участника',
  source: 'Кейсодержатели хакатона (выдан для чтения)',
  synthetic: 'не указано в наборе; данные обезличены или синтетические (ТЗ 4.3 п. 5)',
  rulesetVersion,
  createdAt: new Date().toISOString(),
  schema: { csv: { delimiter: ';', decimal: ',', encoding: 'UTF-8 BOM', timestamp: 'ISO 8601 UTC, начало 15-минутного интервала', unitInHeader: true } },
  objects,
  files,
};
writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json: ${files.length} файлов, объектов ${objects.length}`);
