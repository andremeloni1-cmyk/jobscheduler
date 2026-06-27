#!/usr/bin/env bash
# =============================================================================
# 04 - Install the JS7 Controller. Bound to 127.0.0.1, runs under systemd.
# Idempotent.
# =============================================================================
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
require_root
load_config

if svc_active js7-controller; then
  ok "js7-controller already running. To reinstall, stop it first."
  exit 0
fi

archive="$(resolve_ver "$CONTROLLER_ARCHIVE")"
tarball="${DOWNLOAD_DIR}/${archive}"
log "Downloading Controller ${JS7_VERSION}"
download_retry "$(sf_url "$archive")" "$tarball"

build_dir="${DOWNLOAD_DIR}/controller-build"
rm -rf "$build_dir"; mkdir -p "$build_dir"
log "Extracting Controller"
tar -xzf "$tarball" -C "$build_dir"
installer_dir="$(find "$build_dir" -maxdepth 1 -mindepth 1 -type d | head -1)"
[[ -n "$installer_dir" ]] || die "Could not locate extracted Controller directory."

mkdir -p "$CONTROLLER_HOME" "$CONTROLLER_DATA"
chown -R "${JS7_USER}:${JS7_GROUP}" "$JS7_HOME"

# The Controller ships an install script that lays out home + data and sets the
# HTTP port and controller id, then we manage it via systemd.
log "Installing Controller to ${CONTROLLER_HOME}"
run_as_js7 "cd '${installer_dir}' && ./install_js7_controller.sh \
  --home='${CONTROLLER_HOME}' \
  --data='${CONTROLLER_DATA}' \
  --http-port=127.0.0.1:${CONTROLLER_HTTP_PORT} \
  --controller-id='${CONTROLLER_ID}'" \
  || die "Controller installer failed. If the flag names differ for ${JS7_VERSION}, check the installer's --help and adjust 04-install-controller.sh."

chown -R "${JS7_USER}:${JS7_GROUP}" "$JS7_HOME"

log "Installing systemd unit js7-controller.service"
render_template "${TEMPLATES_DIR}/js7-controller.service" /etc/systemd/system/js7-controller.service
systemctl daemon-reload
systemctl enable js7-controller
systemctl start js7-controller

sleep 4
if svc_active js7-controller; then
  ok "Controller running on 127.0.0.1:${CONTROLLER_HTTP_PORT} (id=${CONTROLLER_ID})"
else
  warn "js7-controller not active yet. Inspect: journalctl -u js7-controller -n 50"
fi
