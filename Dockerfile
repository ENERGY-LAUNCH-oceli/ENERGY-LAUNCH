# syntax=docker/dockerfile:1
# Сборка статического SPA и раздача через nginx. Данные кейса 4 в образ не входят (ТЗ 4.3):
# они монтируются томом только для чтения (см. docker-compose.yml).

FROM node:22.11.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_DATASET=auto
ENV VITE_DATASET=${VITE_DATASET}
RUN npm run build && rm -rf dist/case4

FROM nginx:1.27.3-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
