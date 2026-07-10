#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-main}"
SERVICE_NAME="holonet-bot"

if [ ! -d .git ]; then
  echo "Run this from the Holonet repo root."
  exit 1
fi

echo "Deploying Holonet Bot from branch: $BRANCH"

# Pull latest code
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

# Deploy slash commands
echo "Deploying Discord slash commands..."
cd bot
npm install --no-audit --no-fund
npm run deploy
cd ..

# Restart service
echo "Restarting bot service..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart "$SERVICE_NAME"
  pm2 save
  echo "Holonet bot restarted successfully via PM2."
else
  echo "Warning: PM2 is not installed."
  echo "Please restart the bot manually."
fi
