#!/usr/bin/env bash
# =============================================================================
# 06 - nginx reverse proxy + Let's Encrypt TLS for the JOC Cockpit web UI.
# Requires a DNS A record for ${DOMAIN} pointing at this server FIRST.
# Idempotent.
# =============================================================================
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
require_root
load_config

log "Installing nginx and certbot"
apt_ensure nginx certbot python3-certbot-nginx

log "Deploying nginx reverse-proxy vhost for ${DOMAIN}"
render_template "${TEMPLATES_DIR}/nginx-js7.conf" /etc/nginx/sites-available/js7.conf
ln -sf /etc/nginx/sites-available/js7.conf /etc/nginx/sites-enabled/js7.conf
# Drop the stock default site so it doesn't shadow our server_name.
rm -f /etc/nginx/sites-enabled/default

log "Validating nginx configuration"
nginx -t
systemctl enable --now nginx
systemctl reload nginx

# --- DNS sanity check before requesting a certificate ----------------------
server_ip="$(curl -fsS https://api.ipify.org || true)"
resolved_ip="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"
if [[ -n "$server_ip" && -n "$resolved_ip" && "$server_ip" != "$resolved_ip" ]]; then
  warn "DNS for ${DOMAIN} (${resolved_ip:-none}) does not match this server (${server_ip})."
  warn "Create/await the A record before certbot can issue a certificate."
fi

# --- Obtain / renew the certificate ----------------------------------------
staging_flag=""
[[ "${LETSENCRYPT_STAGING:-false}" == "true" ]] && staging_flag="--staging"

log "Requesting Let's Encrypt certificate via certbot --nginx"
certbot --nginx \
  --non-interactive --agree-tos \
  -m "$LETSENCRYPT_EMAIL" \
  -d "$DOMAIN" \
  --redirect $staging_flag \
  || die "certbot failed. Verify DNS for ${DOMAIN} resolves here and ports 80/443 are open."

systemctl reload nginx
ok "HTTPS live: https://${DOMAIN}  (certbot auto-renew via systemd timer)"
