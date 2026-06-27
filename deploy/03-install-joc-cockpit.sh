#!/usr/bin/env bash
# =============================================================================
# 03 - Install JS7 JOC Cockpit (web UI) with a MySQL backend.
# Downloads the installer, supplies the MySQL JDBC driver, renders the
# hibernate + response files, runs the headless setup, installs a systemd unit.
# Idempotent.
# =============================================================================
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
require_root
load_config

if svc_active js7-joc; then
  ok "js7-joc already running. To reinstall, stop it first: systemctl stop js7-joc"
  exit 0
fi

joc_archive="$(resolve_ver "$JOC_ARCHIVE")"
joc_tar="${DOWNLOAD_DIR}/${joc_archive}"
connector_jar="${DOWNLOAD_DIR}/mysql-connector-j-${MYSQL_CONNECTOR_VERSION}.jar"

log "Downloading JOC Cockpit ${JS7_VERSION} and MySQL Connector/J ${MYSQL_CONNECTOR_VERSION}"
download_retry "$(sf_url "$joc_archive")" "$joc_tar"
download_retry "$(connector_url)" "$connector_jar"

# --- Extract installer ------------------------------------------------------
build_dir="${DOWNLOAD_DIR}/joc-build"
rm -rf "$build_dir"; mkdir -p "$build_dir"
log "Extracting JOC installer"
tar -xzf "$joc_tar" -C "$build_dir"
# The archive unpacks to a single top-level directory (e.g. joc.<ver>.tar.gz/).
installer_dir="$(find "$build_dir" -maxdepth 1 -mindepth 1 -type d | head -1)"
[[ -n "$installer_dir" ]] || die "Could not locate extracted JOC installer directory."

# --- Prepare data dir, hibernate config, JDBC driver -----------------------
log "Preparing JOC data directory ${JOC_DATA}"
mkdir -p "${JOC_DATA}/resources/joc" "${JOC_DATA}/lib"

log "Rendering hibernate.cfg.xml (MySQL)"
render_template "${TEMPLATES_DIR}/hibernate.cfg.xml" "${JOC_DATA}/resources/joc/hibernate.cfg.xml"
chmod 640 "${JOC_DATA}/resources/joc/hibernate.cfg.xml"

log "Installing MySQL JDBC driver into JOC lib"
cp "$connector_jar" "${JOC_DATA}/lib/"

log "Rendering JOC headless response file"
render_template "${TEMPLATES_DIR}/joc_install.xml" "${build_dir}/joc_install.xml"

mkdir -p "$JOC_HOME"
chown -R "${JS7_USER}:${JS7_GROUP}" "$JS7_HOME"

# --- Run headless installer as the js7 user --------------------------------
log "Running JOC headless setup (this can take a few minutes)"
chown -R "${JS7_USER}:${JS7_GROUP}" "$build_dir"
run_as_js7 "cd '${installer_dir}' && ./setup.sh '${build_dir}/joc_install.xml'"

chown -R "${JS7_USER}:${JS7_GROUP}" "$JS7_HOME"

# --- systemd service --------------------------------------------------------
log "Installing systemd unit js7-joc.service"
render_template "${TEMPLATES_DIR}/js7-joc.service" /etc/systemd/system/js7-joc.service
systemctl daemon-reload
systemctl enable js7-joc
systemctl start js7-joc

sleep 5
if svc_active js7-joc; then
  ok "JOC Cockpit running on 127.0.0.1:${JOC_HTTP_PORT} (default login root/root — change it!)"
else
  warn "js7-joc not active yet. Inspect: journalctl -u js7-joc -n 50"
fi
