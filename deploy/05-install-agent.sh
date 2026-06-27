#!/usr/bin/env bash
# =============================================================================
# 05 - Install a JS7 Agent on this host. Bound to 127.0.0.1, runs under systemd.
# Idempotent.
# =============================================================================
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
require_root
load_config

if svc_active js7-agent; then
  ok "js7-agent already running. To reinstall, stop it first."
  exit 0
fi

archive="$(resolve_ver "$AGENT_ARCHIVE")"
tarball="${DOWNLOAD_DIR}/${archive}"
log "Downloading Agent ${JS7_VERSION}"
download_retry "$(sf_url "$archive")" "$tarball"

build_dir="${DOWNLOAD_DIR}/agent-build"
rm -rf "$build_dir"; mkdir -p "$build_dir"
log "Extracting Agent"
tar -xzf "$tarball" -C "$build_dir"
installer_dir="$(find "$build_dir" -maxdepth 1 -mindepth 1 -type d | head -1)"
[[ -n "$installer_dir" ]] || die "Could not locate extracted Agent directory."

mkdir -p "$AGENT_HOME" "$AGENT_DATA"
chown -R "${JS7_USER}:${JS7_GROUP}" "$JS7_HOME"

log "Installing Agent to ${AGENT_HOME} (port ${AGENT_HTTP_PORT})"
run_as_js7 "cd '${installer_dir}' && ./install_js7_agent.sh \
  --home='${AGENT_HOME}' \
  --data='${AGENT_DATA}' \
  --http-port=127.0.0.1:${AGENT_HTTP_PORT} \
  --agent-id='${AGENT_ID}'" \
  || die "Agent installer failed. If the flag names differ for ${JS7_VERSION}, check the installer's --help and adjust 05-install-agent.sh."

chown -R "${JS7_USER}:${JS7_GROUP}" "$JS7_HOME"

log "Installing systemd unit js7-agent.service"
render_template "${TEMPLATES_DIR}/js7-agent.service" /etc/systemd/system/js7-agent.service
systemctl daemon-reload
systemctl enable js7-agent
systemctl start js7-agent

sleep 4
if svc_active js7-agent; then
  ok "Agent running on 127.0.0.1:${AGENT_HTTP_PORT} (id=${AGENT_ID})"
  log "Register the Agent in JOC Cockpit: Configuration > Agents (Controller id=${CONTROLLER_ID})."
else
  warn "js7-agent not active yet. Inspect: journalctl -u js7-agent -n 50"
fi
