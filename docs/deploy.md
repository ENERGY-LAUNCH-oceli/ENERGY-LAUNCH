# Развёртывание: elaunch.xroyse.ru

Сервер Ubuntu 24.04 (153.80.178.157) общий: на нём есть и другие сайты (nginx, pm2, Docker). ENERGY LAUNCH
работает отдельно от них – свой сайт nginx, своя служба systemd, свой PostgreSQL. Данные кейса 4 на сервер
не выкладываются (ТЗ 4.3): приложение собрано на синтетическом портфеле.

| Что | Где |
| --- | --- |
| Статика (сборка Vite) | `/var/www/elaunch` |
| Сервер хранилища | `/opt/energy-launch/app` (`server/`, `src/help/` – помощник и база знаний, `package.json`, зависимости), служба `energy-launch-api` на 127.0.0.1:8790 |
| Переменные службы | `/etc/energy-launch/api.env` (права 640 root:elaunch; `DATABASE_URL` с паролем – только там) |
| База | PostgreSQL 16 из пакетов Ubuntu, только localhost; база и роль `energy_launch`; настройки – `conf.d/energy-launch.conf` |
| nginx | `/etc/nginx/sites-available/elaunch.xroyse.ru` ← `deploy/server/elaunch.nginx.conf` |
| systemd | `/etc/systemd/system/energy-launch-api.service` ← `deploy/server/energy-launch-api.service` |

Служба работает от системного пользователя `elaunch` без входа в систему, файловая система для неё только
для чтения (`ProtectSystem=strict`), память ограничена 300 МБ. API доступен только через nginx; запросы к
`/api/` ограничены 20 в секунду с одного адреса.

## HTTPS

Сертификат Let's Encrypt выпускается после того, как A-запись `elaunch.xroyse.ru` укажет на 153.80.178.157:

```bash
certbot --nginx -d elaunch.xroyse.ru --non-interactive --agree-tos --redirect
```

Продление – стандартный `certbot.timer`.

## Обновление

```bash
# локально
VITE_DATASET=synthetic npx vite build --outDir build-web   # без public/case4 и карт исходников:
rm -rf build-web/case4 && find build-web -name '*.map' -delete
# на сервер: build-web → /var/www/elaunch; server/, src/help/, package.json, package-lock.json → /opt/energy-launch/app
cd /opt/energy-launch/app && npm ci --omit=dev --ignore-scripts
systemctl restart energy-launch-api
```

Миграции схемы применяются при старте службы. Проверка: `curl -s http://127.0.0.1:8790/api/health`,
журнал – `journalctl -u energy-launch-api`.

## Ограничения

- Аутентификации нет: любой посетитель видит общий демо-портфель и может менять его (в том числе «Сбросить
  состояние»). Журнал аудита при этом только дополняется. Для закрытого доступа – HTTP Basic в nginx или SSO.
