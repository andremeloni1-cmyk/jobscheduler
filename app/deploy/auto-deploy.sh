#!/usr/bin/env bash
# Auto-deploy: if the deploy branch has new commits on the remote, pull and
# redeploy (update.sh = pull -> migrate -> build -> pm2 reload). Otherwise do
# nothing. Designed to run from cron every few minutes; safe to run as root.
#
# Output is appended to auto-deploy.log so you can see what shipped and when.
# Install once with: sudo bash deploy/setup-auto-deploy.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG="${AUTO_DEPLOY_LOG:-$APP_DIR/auto-deploy.log}"
BRANCH="${DEPLOY_BRANCH:-master}"

# Single-flight: skip if a deploy is already running (a build can outlast the
# 5-minute cron interval).
exec 9>"/tmp/joineryflow-auto-deploy.lock"
flock -n 9 || exit 0

cd "$APP_DIR" || exit 0

# Quietly give up on transient network errors — we'll try again next tick.
git fetch origin "$BRANCH" --quiet || exit 0

LOCAL="$(git rev-parse HEAD 2>/dev/null || echo none)"
REMOTE="$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo none)"
[ "$LOCAL" = "$REMOTE" ] && exit 0   # already up to date — nothing to do

{
  echo "==== $(date '+%Y-%m-%d %H:%M:%S') new commit on $BRANCH ($LOCAL -> $REMOTE) — deploying ===="
  if bash "$SCRIPT_DIR/update.sh"; then
    echo "==== $(date '+%Y-%m-%d %H:%M:%S') deploy OK -> $(git rev-parse HEAD) ===="
  else
    echo "!!!! $(date '+%Y-%m-%d %H:%M:%S') deploy FAILED — left at $(git rev-parse HEAD); will retry next tick ===="
  fi
} >>"$LOG" 2>&1
