#!/usr/bin/env bash
# =============================================================================
# Orchestrator — runs the JS7 deployment scripts 01..07 in order.
# Run as root on a fresh Hostinger Ubuntu VPS AFTER editing deploy/config.env
# and pointing your DNS A record at this server.
#
#     sudo bash deploy/install-all.sh
#
# Each step is idempotent, so re-running after a fix resumes safely.
# =============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${HERE}/lib/common.sh"
require_root
load_config

steps=(
  01-prepare-server.sh
  02-install-mysql.sh
  03-install-joc-cockpit.sh
  04-install-controller.sh
  05-install-agent.sh
  06-nginx-tls.sh
  07-verify.sh
)

for step in "${steps[@]}"; do
  echo
  log "==== ${step} ===="
  bash "${HERE}/${step}"
done

echo
ok "Deployment complete. Browse https://${DOMAIN} and change the default login."
