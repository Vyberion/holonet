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
if systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
  sudo systemctl restart "$SERVICE_NAME"
  echo "Holonet bot restarted successfully."
else
  echo "Warning: Systemd service '$SERVICE_NAME' not found."
  echo "If you use PM2 or another process manager, please restart the bot manually."
fi
