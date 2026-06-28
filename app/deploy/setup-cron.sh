#!/usr/bin/env bash
# Sets up the automatic inbox check that imports new job leads every 15 minutes.
# Run once on the VPS:  sudo bash deploy/setup-cron.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$APP_DIR/.env"

APP_URL="$(grep -E '^APP_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' || true)"
APP_URL="${APP_URL:-http://127.0.0.1:3000}"

# Ensure a CRON_SECRET exists in .env (generate one if missing/empty).
SECRET="$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' || true)"
if [[ -z "$SECRET" ]]; then
  SECRET="$(openssl rand -hex 32)"
  if grep -qE '^CRON_SECRET=' "$ENV_FILE"; then
    sed -i "s#^CRON_SECRET=.*#CRON_SECRET=\"$SECRET\"#" "$ENV_FILE"
  else
    echo "CRON_SECRET=\"$SECRET\"" >> "$ENV_FILE"
  fi
  echo "Generated a new CRON_SECRET and saved it to .env"
  echo "Restarting app to pick it up..."
  pm2 restart joineryflow --update-env >/dev/null 2>&1 || true
fi

LINE="*/15 * * * * curl -fsS -X POST -H 'x-cron-secret: $SECRET' ${APP_URL%/}/api/leads/scan >/dev/null 2>&1"

# Install/replace the cron entry idempotently.
TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v '/api/leads/scan' > "$TMP" || true
echo "$LINE" >> "$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "Done. The inbox will be checked every 15 minutes."
echo "Current crontab:"
crontab -l | grep 'leads/scan'
