// Сбор русских строк интерфейса для словаря перевода (src/i18n): строковые литералы, текст JSX и шаблонные строки.
// node scripts/i18n-extract.mjs [out.json] – печатает новые строки, которых ещё нет в src/i18n/en.json.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const CYR = /[А-Яа-яЁё]/;
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const roots = ['src', 'server'];
// Не интерфейс: SQL миграций, код service worker, HTML-заготовка статических страниц (их тексты – из errors/codes.ts)
const skip = /src[\\/]i18n[\\/]|\.test\.|\.d\.ts$|server[\\/]migrations\.ts|errors[\\/](static-page|service-worker)\.ts/;
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f) && !skip.test(p)) files.push(p);
  }
};
roots.forEach(walk);

const exact = new Map(); // текст → файл
const templates = new Map(); // шаблон с {0}, {1} → файл

for (const file of files) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const add = (text) => {
    const t = norm(text);
    if (t && CYR.test(t) && !exact.has(t)) exact.set(t, file);
  };
  const visit = (node) => {
    // Импорты, ключи и тексты console.* – не интерфейс
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(src) === 'console') return;
    // Ключевые слова поиска FAQ не показываются
    if (ts.isPropertyAssignment(node) && node.name.getText(src) === 'keywords') return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text);
    else if (ts.isJsxText(node)) add(node.text);
    else if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
      if (parts.some((p) => CYR.test(p))) {
        let t = parts[0];
        for (let i = 1; i < parts.length; i++) t += `{${i - 1}}` + parts[i];
        t = norm(t);
        if (!templates.has(t)) templates.set(t, file);
        // Литеральные куски шаблона встречаются и сами по себе (вложенные шаблоны, склейки)
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}

const out = process.argv[2];
const known = existsSync('src/i18n/en.json') ? JSON.parse(readFileSync('src/i18n/en.json', 'utf8')) : { exact: {}, templates: {} };
const result = {
  exact: [...exact.keys()].filter((k) => !(k in known.exact)).sort(),
  templates: [...templates.keys()].filter((k) => !(k in known.templates)).sort(),
};
if (out) writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`files ${files.length} · exact ${exact.size} (new ${result.exact.length}) · templates ${templates.size} (new ${result.templates.length}) · chars ${[...exact.keys(), ...templates.keys()].join('').length}`);
