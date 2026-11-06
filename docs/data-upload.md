# Загрузка данных

Данные кейса не входят в репозиторий и Docker-образ (ТЗ 4.3): они подключаются локально и удаляются после хакатона.

## Подключить набор кейса 4

1. Распаковать набор так, чтобы получилось:

   ```
   public/case4/
     Building1/ invoice.csv  object.json
     Building2/ invoice.csv  object.json  telemetry.csv
     …
     Building6/ …
     Configuration_file.json
   ```

2. Сформировать манифест (SHA-256, число строк, период, шаг каждого файла):

   ```bash
   node scripts/case4-manifest.mjs
   ```

3. `npm run dev` или `docker compose up --build`. Приложение найдёт `public/case4/manifest.json`, разберёт файлы в
   фоновом потоке и покажет 6 объектов. Без манифеста – синтетический портфель (`VITE_DATASET=synthetic` – принудительно).

Файлы, которые платформа не обрабатывает (сейчас – `Configuration_file.json`), сохраняются в наборе и манифесте
(`processed: false`), но не выводятся и не анализируются. Документы ТЗ и паспорта кладутся в `docs/source/` (не коммитится).

## Форматы

### invoice.csv и telemetry.csv

| Параметр | Значение |
| --- | --- |
| Кодировка | UTF-8 с BOM (без BOM тоже читается) |
| Разделитель / десятичный знак | `;` / `,` (или как указано в `csv_format` паспорта) |
| Время | Колонка `timestamp`, ISO 8601 UTC, начало 15-минутного интервала |
| Единица | В имени колонки: `Grid.energy_kWh.offtake_invoice`, `PV1.power_kW`, `Battery1.SOC_%` |
| Пусто | Пустая ячейка – нет значения (не ноль) |

invoice.csv: `Grid.energy_kWh.{offtake,injection}_invoice[_validated]`, `Grid.power_kW.invoice`,
`Grid.power_kW.CA_{offtake,injection}`. telemetry.csv: сигналы Grid, PV, Battery, Demand по карте паспорта.

### object.json

`object_id`, `name`, `address`, `coordinates`, `timezone`, `grid_connection` (EAN offtake / injection), `assets`
(`type`: pv / battery, номер), `site_signals`, `data_files` (`invoice`, `telemetry`; `null` – файла нет), `csv_format`.
Неизвестный тип актива – замечание, а не оборудование. Отсутствующие поля остаются пустыми, ничего не придумывается.

## Загрузка через интерфейс

| Где | Что |
| --- | --- |
| Объект → «История счётчиков» | invoice.csv (до 500 МБ, потоковый разбор) |
| Объект → «Телеметрия» | object.json, telemetry.csv |

Каждая загрузка создаёт новую версию входа; предыдущая остаётся в истории. Подтверждения зависимых этапов становятся
неактуальными, начатые этапы перепроверяются автоматически. Файл не того формата не принимается – сообщение
называет причину. Текст внутри файлов (имена, описания) считается данными и не влияет на проверки.
