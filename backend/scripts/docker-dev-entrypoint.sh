#!/bin/sh
set -e

cd /app

STAMP="node_modules/.deps-installed"
LOCK="package-lock.json"

needs_install() {
  [ ! -d node_modules/@nestjs/core ] && return 0
  [ ! -f "$STAMP" ] && return 0
  [ "$LOCK" -nt "$STAMP" ] && return 0
  return 1
}

if needs_install; then
  echo "[backend] Installing dependencies (first run or lockfile changed)..."
  npm ci
  touch "$STAMP"
else
  echo "[backend] Dependencies up to date, skipping npm ci."
fi

echo "[backend] Generating Prisma client..."
npx prisma generate

echo "[backend] Applying migrations..."
npx prisma migrate deploy

exec "$@"
