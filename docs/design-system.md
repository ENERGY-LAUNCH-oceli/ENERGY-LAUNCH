# ENERGY LAUNCH — дизайн-система

Витрина: `/design-system`. Токены: `src/design/tokens.ts` (единственный источник; Tailwind-плагин генерирует из них CSS-переменные `--el-*`).

## Анализ референса oceli.energy

Стили сняты с отрисованной страницы (Playwright, вычисленные стили, ноябрь 2026). CSS-переменных бренда на сайте нет (Tilda), значения взяты из computed styles.

| Свойство | Значение на сайте | Перенос в ENERGY LAUNCH |
| --- | --- | --- |
| Шрифт | Manrope 300–800 | Manrope Variable (локально, @fontsource) |
| Основной цвет | `#052849` (текст, тёмные кнопки, подвал) | Primary, Text Primary, Surface Inverse (навигация) |
| Акцент | `#018A98` (надзаголовки, выделенные слова, рамки) | Accent; для текста и заливок под белым — `#017E8B` (контраст 4.8:1) |
| Акцент на тёмном | `#22AFBF` | Надзаголовки в навигации и NextActionCard |
| Фон | `#F6FFFF`, градиенты `#E2FBFE`/`#CAF9FE` | Surface Secondary `#F6FFFF`; Background `#F2F8F9` (приглушён для долгой работы) |
| Синий | `#015BB0`, `#3A78A6`, `#8BBCE0` | Secondary / Info / «В работе», ряды графиков |
| Заголовки | 45/52 800, 30/36 700, 20/31 700 | Display 44/52 800, H1 32/40 800, H2 24/32 700, H3 18/26 700 |
| Текст | 15/23, 14/20 | Body 15/23, Body Small 14/20 |
| Надзаголовок | 12px / 800 / 1.92px, uppercase | Label 12/16 800, 0.16em |
| Кнопки | «пилюли» (radius 50–100px), 15/600, padding 8.5×30 | Button: radius pill, 600 |
| Карточки | radius 30/15px, без тени | radius 16px (плотнее для SaaS), рамка, без тени |
| Тень | `0 8px 24px rgba(5,40,73,.1)` — единственная | shadow-md — только всплывающие слои |
| Градиенты | много, в карточках и баннерах | Один фирменный (105°) — только в состоянии «Объект готов» |

## Статусы

Статус всегда = цвет + иконка + текст. «Заблокирован» — коралловый `#B9402A` на `#FDF0EC`, акцентная линия 3px, без сплошной заливки.

## Правила

- Компоненты используют только семантические токены.
- Числа — `tabular` (табличные цифры), единицы отдельно.
- Коды EAN, сигналы, ID — моноширинный шрифт.
- `cn()` знает кастомную шкалу шрифтов (иначе tailwind-merge удаляет цвет текста).

## Состав

UI Kit (`src/components/ui`, `src/components/common`): Button, Input/Textarea/Field, Select, Checkbox, RadioGroup, Tabs, Card, Badge, StatusBadge/StatusDot, Progress, Tooltip, Modal, Drawer, Alert, DataTable, EmptyState, ErrorState, LoadingState, Kpi, Timeline, Stepper, FileUpload.

Продукт (`src/components/launch`): LaunchProgress, LaunchStageCard, ValidationStatus, ValidationResult, EvidenceCard, EvidencePanel, BlockerCard, BlockerPanel, NextActionCard, AuditTimeline, DataQualityIndicator.
