# syntax=docker/dockerfile:1
# Сборка статического SPA и раздача через nginx; стадия api – сервер хранилища (PostgreSQL). Данные кейса 4 в образ не входят (ТЗ 4.3):
# они монтируются томом только для чтения (см. docker-compose.yml).

# Vite 7 требует Node 20.19+ / 22.12+
FROM node:22.20.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_DATASET=auto
ENV VITE_DATASET=${VITE_DATASET}
RUN npm run build && rm -rf dist/case4

# Сервер хранилища (PostgreSQL). Node 22.18+ выполняет TypeScript без сборки.
FROM node:22.20.0-alpine AS api
WORKDIR /app
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=8787
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server ./server
# Помощник по сайту и база знаний – общие с приложением
COPY src/help ./src/help
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "server/index.ts"]

# Приложение (последняя стадия – цель сборки по умолчанию)
FROM nginx:1.27.3-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
