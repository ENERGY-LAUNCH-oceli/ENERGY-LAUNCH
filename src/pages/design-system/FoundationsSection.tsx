import { colors, palette, radius, shadow, stageStatusColors, typography } from '@/design/tokens';
import { STAGE_STATUS_LABEL } from '@/config/stages';
import { StatusBadge } from '@/components/ui/status-badge';
import type { StageStatus } from '@/types';
import { DsSection, Specimen } from './Specimen';

const SEMANTIC: Array<[string, keyof typeof colors, string]> = [
  ['Primary', 'primary', 'Основные действия, заголовки. Oceli #052849'],
  ['Secondary', 'secondary', 'Информационные состояния, «В работе». Oceli #015BB0'],
  ['Accent', 'accent', 'Бренд-акцент, фокус, активная навигация. Oceli #018A98'],
  ['Accent strong', 'accentStrong', 'Акцентный текст и заливки под белым текстом (≥ 4.5:1)'],
  ['Background', 'background', 'Фон рабочей области'],
  ['Surface', 'surface', 'Карточки, панели, таблицы'],
  ['Surface Secondary', 'surfaceSecondary', 'Вложенные области, шапки таблиц. Oceli #F6FFFF'],
  ['Surface Inverse', 'surfaceInverse', 'Навигация, «Следующее действие». Подвал Oceli'],
  ['Border', 'border', 'Границы карточек и разделители'],
  ['Border Strong', 'borderStrong', 'Границы полей ввода'],
  ['Text Primary', 'textPrimary', 'Основной текст'],
  ['Text Secondary', 'textSecondary', 'Описания, подписи'],
  ['Text Muted', 'textMuted', 'Метаданные, плейсхолдеры'],
  ['Success', 'success', 'Пройдено, завершено'],
  ['Warning', 'warning', 'Замечания, неактуальные данные'],
  ['Error', 'error', 'Ошибки, препятствия'],
  ['Info', 'info', 'Справочные сообщения'],
];

function Swatch({ name, value, note }: { name: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border bg-surface">
      <div className="h-16 border-b border-border" style={{ background: value }} />
      <div className="flex flex-col gap-0.5 p-3">
        <span className="text-body-sm font-semibold">{name}</span>
        <span className="font-mono text-caption uppercase text-text-secondary">{value}</span>
        {note && <span className="text-caption text-text-muted">{note}</span>}
      </div>
    </div>
  );
}

/** Классы перечислены явно, чтобы Tailwind их сгенерировал. */
const TYPE_CLASS: Record<keyof typeof typography, string> = {
  display: 'text-display',
  h1: 'text-h1',
  h2: 'text-h2',
  h3: 'text-h3',
  'body-lg': 'text-body-lg',
  body: 'text-body',
  'body-sm': 'text-body-sm',
  caption: 'text-caption',
  label: 'text-label uppercase text-accent-strong',
  numeric: 'text-numeric tabular',
  'numeric-sm': 'text-numeric-sm tabular',
};

const TYPE_ROWS: Array<[keyof typeof typography, string, string]> = [
  ['display', 'Display', 'Энергия под контролем'],
  ['h1', 'H1', 'Карточка запуска объекта'],
  ['h2', 'H2', 'Данные в реальном времени'],
  ['h3', 'H3', 'Препятствия этапа'],
  ['body-lg', 'Body Large', 'Инженер запуска видит текущий этап и недостающие условия.'],
  ['body', 'Body', 'История загружена и проверена; пробелы обработаны по согласованному правилу.'],
  ['body-sm', 'Body Small', 'Последнее значение не старше 30 минут относительно точки проверки.'],
  ['caption', 'Caption', 'Обновлено 05.11.2026 14:30 · правила v1.0.0'],
  ['label', 'Label', 'СЛЕДУЮЩЕЕ ДЕЙСТВИЕ'],
  ['numeric', 'Numeric Data', '99,6 %  1 248,75 кВт·ч'],
];

export function FoundationsSection() {
  return (
    <DsSection id="foundations" eyebrow="Основа" title="Токены дизайна" description="Значения извлечены из вычисленных стилей oceli.energy и адаптированы для рабочего интерфейса. Источник — src/design/tokens.ts.">
      <Specimen id="colors" title="Палитра бренда" description="Исходные цвета сайта Oceli Energy.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Object.entries(palette).map(([k, v]) => (
            <Swatch key={k} name={k} value={v} />
          ))}
        </div>
      </Specimen>

      <Specimen title="Семантические цвета" description="Компоненты используют только семантические токены, не значения палитры.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SEMANTIC.map(([n, k, note]) => (
            <Swatch key={k} name={n} value={colors[k]} note={note} />
          ))}
        </div>
      </Specimen>

      <Specimen title="Статусы этапов" description="Статус кодируется цветом, иконкой и текстом. «Заблокирован» — мягкий коралловый на светлой подложке, а не сплошная красная заливка.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(stageStatusColors) as StageStatus[]).map((s) => (
            <div key={s} className="flex flex-col gap-3 rounded-md border p-4" style={{ background: stageStatusColors[s].bg, borderColor: stageStatusColors[s].border }}>
              <StatusBadge status={s} />
              <span className="text-body-sm font-semibold" style={{ color: stageStatusColors[s].fg }}>
                {STAGE_STATUS_LABEL[s]}
              </span>
              <span className="font-mono text-caption text-text-secondary">
                fg {stageStatusColors[s].fg} · bg {stageStatusColors[s].bg}
              </span>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen id="typography" title="Типографика" description="Manrope — фирменный шрифт Oceli. Заголовки 700–800, надзаголовки 12/800 с разрядкой 0.16em, числа — табличными цифрами.">
        <div className="flex flex-col divide-y divide-border">
          {TYPE_ROWS.map(([key, name, sample]) => {
            const [size, spec] = typography[key];
            return (
              <div key={key} className="grid gap-2 py-4 first:pt-0 last:pb-0 md:grid-cols-[180px_1fr] md:items-baseline">
                <div className="flex flex-col">
                  <span className="text-body-sm font-semibold">{name}</span>
                  <span className="font-mono text-caption text-text-muted">
                    {parseFloat(size) * 16}/{parseFloat(spec.lineHeight) * 16} · {spec.fontWeight}
                  </span>
                </div>
                <span className={TYPE_CLASS[key]}>{sample}</span>
              </div>
            );
          })}
          <div className="grid gap-2 py-4 md:grid-cols-[180px_1fr] md:items-baseline">
            <div className="flex flex-col">
              <span className="text-body-sm font-semibold">Mono</span>
              <span className="font-mono text-caption text-text-muted">EAN, сигналы, ID</span>
            </div>
            <span className="font-mono text-body-sm">Battery.power_kW.setpoint_received · 541448800000012345</span>
          </div>
        </div>
      </Specimen>

      <div className="grid gap-6 lg:grid-cols-3">
        <Specimen title="Скругления" description="Кнопки — «пилюли», как на сайте.">
          <div className="flex flex-wrap items-end gap-3">
            {Object.entries(radius).map(([k, v]) => (
              <div key={k} className="flex flex-col items-center gap-1.5">
                <span className="size-14 border-2 border-accent bg-accent-subtle" style={{ borderRadius: v }} />
                <span className="font-mono text-caption text-text-muted">
                  {k} · {v}
                </span>
              </div>
            ))}
          </div>
        </Specimen>
        <Specimen title="Тени" description="Только у всплывающих слоёв. Карточки — с рамкой, без тени." tone="background">
          <div className="flex flex-wrap gap-4">
            {Object.entries(shadow).map(([k, v]) => (
              <div key={k} className="flex size-20 items-center justify-center rounded-md bg-surface font-mono text-caption" style={{ boxShadow: v }}>
                {k}
              </div>
            ))}
          </div>
        </Specimen>
        <Specimen title="Отступы" description="Сетка с шагом 4 px.">
          <div className="flex flex-col gap-1.5">
            {[4, 8, 12, 16, 24, 32, 48].map((s) => (
              <div key={s} className="flex items-center gap-3">
                <span className="w-8 text-right font-mono text-caption text-text-muted">{s}</span>
                <span className="h-2.5 rounded-xs bg-accent" style={{ width: s * 2 }} />
              </div>
            ))}
          </div>
        </Specimen>
      </div>
    </DsSection>
  );
}
