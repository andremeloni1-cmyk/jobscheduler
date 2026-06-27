#!/usr/bin/env bash
# =============================================================================
# 01 - Prepare the server: base packages, OpenJDK 17, JS7 user, firewall, time.
# Idempotent; safe to re-run.
# =============================================================================
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
require_root
load_config

log "Updating apt package index"
apt-get update -y

apt_ensure ca-certificates curl gnupg unzip tar ufw fail2ban chrony \
  openjdk-17-jre-headless gettext-base

log "Setting timezone to ${TIMEZONE}"
timedatectl set-timezone "$TIMEZONE" || warn "Could not set timezone (non-fatal)"

log "Enabling time synchronization (chrony)"
systemctl enable --now chrony || warn "chrony not enabled (non-fatal)"

# --- Dedicated unprivileged user -------------------------------------------
if user_exists "$JS7_USER"; then
  ok "User ${JS7_USER} already exists"
else
  log "Creating system user ${JS7_USER}"
  useradd --system --create-home --shell /bin/bash "$JS7_USER"
fi

log "Creating install tree under ${JS7_HOME}"
mkdir -p "$JS7_HOME" "$DOWNLOAD_DIR"
chown -R "${JS7_USER}:${JS7_GROUP}" "$JS7_HOME"

# --- Firewall: only SSH + HTTP + HTTPS are public --------------------------
log "Configuring ufw firewall (allow 22/80/443)"
ufw allow OpenSSH        >/dev/null 2>&1 || ufw allow 22/tcp
ufw allow 80/tcp         >/dev/null 2>&1 || true
ufw allow 443/tcp        >/dev/null 2>&1 || true
# JS7 component ports stay closed to the world (bound to localhost).
if ! ufw status | grep -q "Status: active"; then
  log "Enabling ufw"
  ufw --force enable
else
  ok "ufw already active"
fi

log "Enabling fail2ban"
systemctl enable --now fail2ban || warn "fail2ban not enabled (non-fatal)"

ok "Server prepared. Java: $("${JAVA_HOME}/bin/java" -version 2>&1 | head -1)"
