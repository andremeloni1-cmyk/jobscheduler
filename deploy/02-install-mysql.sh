#!/usr/bin/env bash
# =============================================================================
# 02 - Install and secure MySQL 8, create the JS7 schema, user and grants.
# MySQL listens on 127.0.0.1 only. Idempotent.
# =============================================================================
set -euo pipefail
# shellcheck source=lib/common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
require_root
load_config

log "Installing MySQL server"
apt_ensure mysql-server

log "Binding MySQL to localhost only"
cat > /etc/mysql/mysql.conf.d/zz-js7.cnf <<EOF
[mysqld]
bind-address = 127.0.0.1
EOF
systemctl enable --now mysql
systemctl restart mysql

# Helper: run SQL as root. Ubuntu's MySQL root uses auth_socket by default, so a
# socket connection works on first run; afterwards we use the password we set.
# shellcheck disable=SC2120  # invoked with stdin heredocs, not positional args
mysql_root() {
  if mysql --user=root --password="${DB_ROOT_PASSWORD}" -e "SELECT 1" >/dev/null 2>&1; then
    mysql --user=root --password="${DB_ROOT_PASSWORD}" "$@"
  else
    mysql --user=root "$@"   # auth_socket (first run, running as system root)
  fi
}

log "Setting MySQL root password (idempotent)"
mysql_root <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY '${DB_ROOT_PASSWORD}';
FLUSH PRIVILEGES;
EOF

log "Basic hardening (remove anon users, test db, remote root)"
mysql_root <<EOF
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost','127.0.0.1','::1');
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
FLUSH PRIVILEGES;
EOF

log "Creating database '${DB_NAME}' and user '${DB_USER}'"
mysql_root <<EOF
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED WITH caching_sha2_password BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED WITH caching_sha2_password BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'localhost'  IDENTIFIED WITH caching_sha2_password BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'127.0.0.1'  IDENTIFIED WITH caching_sha2_password BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
EOF

log "Verifying JS7 DB connectivity"
if mysql --user="${DB_USER}" --password="${DB_PASSWORD}" --host=127.0.0.1 \
     "${DB_NAME}" -e "SELECT 1" >/dev/null 2>&1; then
  ok "MySQL ready: ${DB_USER}@127.0.0.1/${DB_NAME}"
else
  die "Could not connect as ${DB_USER}. Check DB_PASSWORD in config.env."
fi
