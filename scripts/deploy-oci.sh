#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-main}"
APP_NAME="${HOLONET_PM2_APP_NAME:-holonet-web}"

if [ ! -d .git ]; then
  echo "Run this from the Holonet web repo root, not from holonet-bot."
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 is not installed. Install it with: npm install -g pm2"
  exit 1
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

npm run build

pm2 startOrReload ecosystem.config.cjs --only "$APP_NAME" --update-env
pm2 save

printf '\nHolonet web is running under PM2 as %s.\n' "$APP_NAME"
printf 'Check it with: curl -fsS http://127.0.0.1:${PORT:-3000}/api/health\n'
