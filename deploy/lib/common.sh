#!/usr/bin/env bash
# =============================================================================
# Shared helpers for the JS7 deployment scripts.
# Sourced by every deploy/*.sh script. Not meant to be executed directly.
# =============================================================================

# --- Resolve paths ---------------------------------------------------------
# DEPLOY_DIR = the deploy/ directory regardless of CWD.
# shellcheck disable=SC2034  # consumed by sourcing scripts
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}")" && pwd)"
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${LIB_DIR}/.." && pwd)"
TEMPLATES_DIR="${DEPLOY_DIR}/templates"

# --- Logging ---------------------------------------------------------------
_c_reset=$'\033[0m'; _c_blue=$'\033[1;34m'; _c_green=$'\033[1;32m'
_c_yellow=$'\033[1;33m'; _c_red=$'\033[1;31m'

log()  { printf '%s[*]%s %s\n' "$_c_blue"   "$_c_reset" "$*"; }
ok()   { printf '%s[+]%s %s\n' "$_c_green"  "$_c_reset" "$*"; }
warn() { printf '%s[!]%s %s\n' "$_c_yellow" "$_c_reset" "$*" >&2; }
err()  { printf '%s[x]%s %s\n' "$_c_red"    "$_c_reset" "$*" >&2; }
die()  { err "$*"; exit 1; }

# --- Pre-flight ------------------------------------------------------------
require_root() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || die "This script must be run as root (use sudo)."
}

# Load and validate deploy/config.env.
load_config() {
  local cfg="${DEPLOY_DIR}/config.env"
  [[ -f "$cfg" ]] || die "Missing ${cfg}. Copy config.env.example to config.env and edit it."
  # shellcheck disable=SC1090
  source "$cfg"

  local required=(DOMAIN LETSENCRYPT_EMAIL JS7_VERSION MYSQL_CONNECTOR_VERSION \
    JS7_USER JS7_GROUP JS7_HOME JOC_HTTP_PORT CONTROLLER_HTTP_PORT AGENT_HTTP_PORT \
    CONTROLLER_ID AGENT_ID DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD DB_ROOT_PASSWORD)
  local missing=()
  local v
  for v in "${required[@]}"; do
    [[ -n "${!v:-}" ]] || missing+=("$v")
  done
  [[ ${#missing[@]} -eq 0 ]] || die "config.env is missing values: ${missing[*]}"

  case "$DB_PASSWORD" in CHANGE_ME*) die "Set a real DB_PASSWORD in config.env.";; esac
  case "$DB_ROOT_PASSWORD" in CHANGE_ME*) die "Set a real DB_ROOT_PASSWORD in config.env.";; esac

  derive_paths
}

# Derive and export the per-component install/data paths and JAVA_HOME used by
# both the scripts and the rendered templates. Call after the config is loaded.
derive_paths() {
  export JOC_HOME="${JS7_HOME}/joc"
  export JOC_DATA="${JS7_HOME}/joc-data"
  export CONTROLLER_HOME="${JS7_HOME}/controller"
  export CONTROLLER_DATA="${JS7_HOME}/controller-data"
  export AGENT_HOME="${JS7_HOME}/agent"
  export AGENT_DATA="${JS7_HOME}/agent-data"
  export DOWNLOAD_DIR="${JS7_HOME}/downloads"

  # JAVA_HOME for OpenJDK 17 (headless) as installed by 01-prepare-server.sh.
  if [[ -z "${JAVA_HOME:-}" ]]; then
    if [[ -d /usr/lib/jvm/java-17-openjdk-amd64 ]]; then
      export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
    elif command -v java >/dev/null 2>&1; then
      local java_bin; java_bin="$(readlink -f "$(command -v java)")"
      JAVA_HOME="$(dirname "$(dirname "$java_bin")")"
      export JAVA_HOME
    fi
  fi
  export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
}

# --- Idempotency guards ----------------------------------------------------
pkg_installed()  { dpkg -s "$1" >/dev/null 2>&1; }
user_exists()    { id "$1" >/dev/null 2>&1; }
svc_active()     { systemctl is-active --quiet "$1"; }
svc_exists()     { systemctl list-unit-files | grep -q "^$1"; }

# apt install only the packages that are not already present.
apt_ensure() {
  local to_install=() p
  for p in "$@"; do
    pkg_installed "$p" || to_install+=("$p")
  done
  if [[ ${#to_install[@]} -gt 0 ]]; then
    log "Installing: ${to_install[*]}"
    DEBIAN_FRONTEND=noninteractive apt-get install -y "${to_install[@]}"
  else
    ok "Packages already present: $*"
  fi
}

# --- Downloads -------------------------------------------------------------
# download_retry <url> <dest> : curl with retries + exponential backoff.
download_retry() {
  local url="$1" dest="$2" attempt=1 max=4 delay=2
  if [[ -s "$dest" ]]; then
    ok "Already downloaded: $(basename "$dest")"
    return 0
  fi
  while (( attempt <= max )); do
    log "Downloading (try ${attempt}/${max}): ${url}"
    if curl -fSL --connect-timeout 30 -o "${dest}.part" "$url"; then
      mv "${dest}.part" "$dest"
      ok "Downloaded $(basename "$dest")"
      return 0
    fi
    warn "Download failed; retrying in ${delay}s"
    sleep "$delay"; delay=$(( delay * 2 )); attempt=$(( attempt + 1 ))
  done
  rm -f "${dest}.part"
  die "Could not download after ${max} attempts: ${url}"
}

# Variables that templates may reference as @@VAR@@ placeholders.
# A distinct delimiter (not $) avoids clobbering nginx's own $host/$scheme/etc.
TEMPLATE_KEYS=(
  DOMAIN LETSENCRYPT_EMAIL JS7_VERSION JS7_USER JS7_GROUP JS7_HOME
  JOC_HOME JOC_DATA CONTROLLER_HOME CONTROLLER_DATA AGENT_HOME AGENT_DATA
  JAVA_HOME JOC_HTTP_PORT CONTROLLER_HTTP_PORT AGENT_HTTP_PORT
  CONTROLLER_ID AGENT_ID DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD
)

# Render a template, replacing @@VAR@@ placeholders with the matching variables.
# Pure bash string replacement: no eval, no external tools, $-safe.
# render_template <template-path> <output-path>
render_template() {
  local tpl="$1" out="$2"
  [[ -f "$tpl" ]] || die "Template not found: $tpl"
  local content k
  content="$(cat "$tpl")"
  for k in "${TEMPLATE_KEYS[@]}"; do
    content="${content//@@${k}@@/${!k-}}"
  done
  if [[ "$content" == *"@@"*"@@"* ]]; then
    warn "Unsubstituted @@...@@ placeholder left in ${out}; check template/config."
  fi
  printf '%s\n' "$content" > "$out"
}

run_as_js7() { sudo -u "$JS7_USER" -H bash -c "$1"; }

# Substitute the literal ${VER} placeholder in an archive name with JS7_VERSION.
resolve_ver() { printf '%s' "${1//\$\{VER\}/$JS7_VERSION}"; }

# Build a SourceForge download URL for a JS7 release artifact.
sf_url() { printf '%s/%s/%s/download' "$JS7_DOWNLOAD_BASE" "$JS7_VERSION" "$1"; }

# Build the MySQL Connector/J download URL from config.
connector_url() {
  local u="${MYSQL_CONNECTOR_URL//\$\{MYSQL_CONNECTOR_VERSION\}/$MYSQL_CONNECTOR_VERSION}"
  printf '%s' "$u"
}
