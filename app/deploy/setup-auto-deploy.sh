#!/usr/bin/env bash
# Installs a cron job that auto-deploys whenever new commits land on the deploy
# branch (default: master). Run once on the VPS:  sudo bash deploy/setup-auto-deploy.sh
# Remove later with:  sudo bash deploy/setup-auto-deploy.sh --remove
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCRIPT="$SCRIPT_DIR/auto-deploy.sh"
chmod +x "$SCRIPT"

# Every 5 minutes. Idempotent: drop any existing auto-deploy line first.
LINE="*/5 * * * * /usr/bin/env bash $SCRIPT"
TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'deploy/auto-deploy.sh' > "$TMP" || true

if [[ "${1:-}" == "--remove" ]]; then
  crontab "$TMP"; rm -f "$TMP"
  echo "Removed the auto-deploy cron. Deploys are manual again (deploy/update.sh)."
  exit 0
fi

echo "$LINE" >> "$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "Auto-deploy installed: checks origin/master every 5 minutes and runs update.sh on new commits."
echo "Log: $APP_DIR/auto-deploy.log   (tail -f to watch)"
echo "Current crontab:"
crontab -l | grep 'auto-deploy.sh'
