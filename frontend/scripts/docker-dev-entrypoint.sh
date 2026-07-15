#!/bin/sh
set -e

cd /app

STAMP="node_modules/.deps-installed"
LOCK="package-lock.json"

needs_install() {
  [ ! -d node_modules/next ] && return 0
  [ ! -f "$STAMP" ] && return 0
  [ "$LOCK" -nt "$STAMP" ] && return 0
  return 1
}

if needs_install; then
  echo "[frontend] Installing dependencies (first run or lockfile changed)..."
  npm ci
  touch "$STAMP"
else
  echo "[frontend] Dependencies up to date, skipping npm ci."
fi

exec "$@"
