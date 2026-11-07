# ENERGY LAUNCH – заметки для Claude

- Репозиторий: https://github.com/ENERGY-HUB-oceli/ENERGY-LAUNCH, рабочая ветка `claude/energy-launch-phase-01-ss2k8x`.
- Описание архитектуры, фаз и команд – в `README.md`.
- Дизайн: минимализм в духе админки xRoyse (https://github.com/xRoyse/Project, `admin/src/styles.css`),
  от Oceli Energy – только палитра. Источник истины – `src/design/tokens.ts` (светлая и тёмная темы).
  Тема по умолчанию светлая, переключатель в боковой панели.
- Страницы `/design-system` больше нет. Артефакт https://claude.ai/artifact/87HVsmHPQ8R68mJzjkmTsh
  описывает старый дизайн (Manrope, «пилюли») и устарел; папка `design/` с ним удалена.
- Dev-сервер: `npm run dev` → http://127.0.0.1:5173 (Vite привязан к IPv4: на этой машине `localhost`/::1 не открывается).
- Хранилище: `npm run api` → сервер `server/` (PostgreSQL по `DATABASE_URL`, иначе встроенный PGlite в `.data/pglite`, git-ignored); Vite проксирует `/api`.
  Без сервера – браузер. Сервер запускается Node 22 без сборки (`node server/index.ts`, импорты с `.ts`). Подробно – `docs/storage.md`.
  PostgreSQL на машине не установлен. E2E собирается с `VITE_STORAGE=browser`.
- Скриншоты для проверки вёрстки: Playwright (Chromium установлен), обе темы.
- Набор кейса 4 (Building1–6) – `public/case4` (+ `manifest.json` из `node scripts/case4-manifest.mjs`), ТЗ и паспорт – `docs/source/`.
  Обе папки в .gitignore: данные не публикуются (ТЗ 4.3). Приложение грузит набор при старте; без него – синтетика.
  E2E собирается с `--mode e2e` (`.env.e2e`: VITE_DATASET=synthetic). Тест `tests/unit/case4-real.test.ts` гоняет реальные файлы.
- Все требования ТЗ/паспорта и их статус – `docs/requirements-checklist.md` (финальная глобальная проверка по нему).
- Проверки: `npm run typecheck`, `npm run lint` (eslint.config.js), `npm test`, `npm run test:e2e`, `npm run build`.
  Prettier-конфига нет; стиль кода ближе всего к `--single-quote --print-width 250 --object-wrap collapse` – не форматировать файлы настройками по умолчанию.
- Сценарии ТЗ (11) – `src/scenarios`, страница `/scenarios`; прогон в песочницах `scenario-NN`, ожидаемые значения только для сравнения.
- Docker: `Dockerfile` + `deploy/nginx.conf` (строгая CSP, поэтому скрипт темы вынесен в `public/theme-init.js`) + `docker-compose.yml` (case4 – том только для чтения). Docker на этой машине не установлен.
- Прод: https://elaunch.xroyse.ru – общий сервер 153.80.178.157 (рядом чужие сайты: не трогать их nginx/pm2/Docker).
  Раскладка, обновление и HTTPS – `docs/deploy.md`, конфиги – `deploy/server/`. Пароли в репозиторий не попадают.
- Обучение `/help`: уроки `features/help/lessons.tsx` + туры `features/tour/tours.ts` (якоря `data-tour`), FAQ и помощник по сайту
  `src/help/` (общий с сервером: `POST /api/help/ask`, без внешних ИИ). Подробно – `docs/help.md`.
- Документация – `docs/*.md` (архитектура, автомат, правила, модель данных, загрузка, сценарии, демо, ограничения).
