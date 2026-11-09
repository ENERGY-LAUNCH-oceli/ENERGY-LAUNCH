#!/usr/bin/env bash
# Проверка запущенного docker compose: приложение, API через nginx, заголовки безопасности, страницы состояния,
# данные кейса не входят в образ, сервер API не от root. Запуск: bash scripts/docker-smoke.sh [http://127.0.0.1:8080]
set -euo pipefail
BASE="${1:-http://127.0.0.1:8080}"
fail=0
ok() { printf '  ok   %s\n' "$1"; }
bad() { printf '  FAIL %s\n' "$1"; fail=1; }

code() { curl -s -o /dev/null -w '%{http_code}' "$BASE$1"; }
header() { curl -s -D - -o /dev/null "$BASE$1" | tr -d '\r' | grep -i "^$2:" | head -1 | cut -d' ' -f2-; }
expect_code() { local c; c=$(code "$1"); [ "$c" = "$2" ] && ok "$1 → $c" || bad "$1 → $c (ожидалось $2)"; }
expect_header() { local v; v=$(header "$1" "$2"); case "$v" in *"$3"*) ok "$1 · $2" ;; *) bad "$1 · $2: '${v}' (ожидалось '$3')" ;; esac; }

echo "Docker smoke: $BASE"
expect_code / 200
expect_code /objects 200
expect_code /api/health 200
expect_code /status/502.html 200
expect_code /offline.html 200
# Набор кейса 4 в образ не входит (ТЗ 4.3)
expect_code /case4/manifest.json 404

asset=$(curl -s "$BASE/" | grep -o '/assets/[^"]*\.js' | head -1 || true)
if [ -n "$asset" ]; then
  expect_code "$asset" 200
  expect_header "$asset" Cache-Control immutable
  expect_header "$asset" Content-Security-Policy "default-src 'self'"
  expect_code "$asset.map" 404
else
  bad 'в index.html нет ссылки на /assets/*.js'
fi

for path in / /api/health /status/404.html; do
  expect_header "$path" Content-Security-Policy "frame-ancestors 'none'"
  expect_header "$path" X-Frame-Options DENY
  expect_header "$path" X-Content-Type-Options nosniff
done
expect_header / Cache-Control no-cache

# Запись из браузера через nginx: Origin своего сайта принимается (401 – неверный пароль), чужой – 403.
# Ловит прокси, который передаёт Host без порта: тогда API отклонил бы вход и сохранение как запрос с другого источника
login() { curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -H "Origin: $1" --data '{"login":"smoke","password":"x"}' "$BASE/api/auth/login"; }
c=$(login "$BASE"); [ "$c" = 401 ] && ok "вход с Origin сайта → $c" || bad "вход с Origin сайта → $c (ожидалось 401)"
c=$(login "https://attacker.example"); [ "$c" = 403 ] && ok "вход с чужим Origin → $c" || bad "вход с чужим Origin → $c (ожидалось 403)"
expect_header /api/health Cache-Control no-store

if command -v docker >/dev/null 2>&1; then
  uid=$(docker compose exec -T api id -u 2>/dev/null || echo '?')
  [ "$uid" != "0" ] && [ "$uid" != "?" ] && ok "api работает не от root (uid $uid)" || bad "api: uid $uid"
fi

[ "$fail" = 0 ] && echo 'Docker smoke: всё в порядке' || { echo 'Docker smoke: есть ошибки'; exit 1; }
