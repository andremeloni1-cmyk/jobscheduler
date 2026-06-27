#!/usr/bin/env bash
# =============================================================================
# 07 - Post-install health checks. Read-only; safe to run any time.
# Exits non-zero if any check fails.
# =============================================================================
set -uo pipefail
# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
load_config

fails=0
check() { # check <description> <command...>
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$desc"; else err "$desc"; fails=$((fails+1)); fi
}

log "Checking systemd services"
check "MySQL active"            svc_active mysql
check "JOC Cockpit active"      svc_active js7-joc
check "Controller active"       svc_active js7-controller
check "Agent active"            svc_active js7-agent
check "nginx active"            svc_active nginx

log "Checking listening ports (localhost)"
port_listening() { ss -ltn "( sport = :$1 )" | grep -q LISTEN; }
check "JOC on :${JOC_HTTP_PORT}"               port_listening "$JOC_HTTP_PORT"
check "Controller on :${CONTROLLER_HTTP_PORT}" port_listening "$CONTROLLER_HTTP_PORT"
check "Agent on :${AGENT_HTTP_PORT}"           port_listening "$AGENT_HTTP_PORT"

log "Checking database connectivity"
check "MySQL ${DB_NAME} reachable as ${DB_USER}" \
  mysql --user="${DB_USER}" --password="${DB_PASSWORD}" --host=127.0.0.1 "${DB_NAME}" -e "SELECT 1"

log "Checking JOC Cockpit HTTP locally"
check "JOC HTTP responds on 127.0.0.1:${JOC_HTTP_PORT}" \
  curl -fsS -o /dev/null "http://127.0.0.1:${JOC_HTTP_PORT}/joc/"

log "Checking public HTTPS endpoint"
check "https://${DOMAIN} responds" \
  curl -fsS -o /dev/null --max-time 15 "https://${DOMAIN}/"

echo
if [[ "$fails" -eq 0 ]]; then
  ok "All checks passed. Open https://${DOMAIN} and log in (change the default root/root)."
  exit 0
else
  err "${fails} check(s) failed. See journalctl -u <service> for details."
  exit 1
fi
