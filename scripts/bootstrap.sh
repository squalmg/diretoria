#!/usr/bin/env bash
set -euo pipefail
[ -f .env ] || cp .env.example .env
npm run check
if command -v docker >/dev/null 2>&1; then
  docker compose up -d db
  for i in $(seq 1 30); do
    status=$(docker inspect --format='{{.State.Health.Status}}' "$(docker compose ps -q db)" 2>/dev/null || true)
    [ "$status" = "healthy" ] && break
    sleep 2
  done
  npm run db:migrate:docker
else
  echo 'Docker não encontrado; banco não iniciado.'
fi
