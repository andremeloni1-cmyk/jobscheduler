#!/usr/bin/env bash
# Give this VPS a READ-ONLY deploy key so it can pull a PRIVATE repo.
# Do this BEFORE flipping the repo to Private, or the auto-deploy git fetch
# (which uses anonymous HTTPS today) will silently stop.
# Run once on the VPS:  sudo bash deploy/setup-deploy-key.sh
set -euo pipefail

KEY="${DEPLOY_KEY_PATH:-$HOME/.ssh/joineryflow_deploy}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$APP_DIR/.." && pwd)"   # git repo root (…/jobscheduler)
BRANCH="${DEPLOY_BRANCH:-master}"

mkdir -p "$HOME/.ssh"; chmod 700 "$HOME/.ssh"

# 1. Generate a read-only key if we don't have one yet.
if [[ ! -f "$KEY" ]]; then
  ssh-keygen -t ed25519 -C "joineryflow-vps-deploy" -f "$KEY" -N ""
  echo "Created deploy key: $KEY"
else
  echo "Reusing existing deploy key: $KEY"
fi

# 2. Point git/ssh at this key for github.com (idempotent).
CFG="$HOME/.ssh/config"
touch "$CFG"; chmod 600 "$CFG"
if ! grep -qF "$KEY" "$CFG"; then
  printf 'Host github.com\n  IdentityFile %s\n  IdentitiesOnly yes\n' "$KEY" >> "$CFG"
  echo "Added github.com host block to $CFG"
fi

# 3. Work out the SSH remote from the current origin (or a REPO_SSH override).
cd "$REPO_DIR"
CUR="$(git remote get-url origin 2>/dev/null || echo '')"
SSH_URL="${REPO_SSH:-}"
if [[ -z "$SSH_URL" ]]; then
  # https://github.com/OWNER/REPO(.git) -> git@github.com:OWNER/REPO.git
  SLUG="$(printf '%s' "$CUR" | sed -E 's#https?://github.com/##; s#git@github.com:##; s#\.git$##')"
  SSH_URL="git@github.com:${SLUG}.git"
fi

echo
echo "=================== ADD THIS DEPLOY KEY ON GITHUB ==================="
echo "GitHub -> your repo -> Settings -> Deploy keys -> Add deploy key"
echo "Title: joineryflow-vps   (leave 'Allow write access' UNCHECKED)"
echo
cat "${KEY}.pub"
echo "===================================================================="
echo
read -r -p "Press Enter AFTER you've added the key on GitHub (Ctrl-C to abort)... " _ || true

# 4. Switch the remote to SSH and verify a fetch works.
git remote set-url origin "$SSH_URL"
echo "origin -> $SSH_URL"

# Trust github's host key on first connect (non-interactive).
ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null || true

if git fetch origin "$BRANCH" --quiet; then
  echo "OK - deploy key works. You can now set the repo to Private; update.sh and"
  echo "the auto-deploy cron keep running unchanged."
else
  echo "Fetch failed. Check the key was added on GitHub (read access), then re-run." >&2
  exit 1
fi
