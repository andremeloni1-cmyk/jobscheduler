# JS7 JobScheduler on Hostinger — Deployment Runbook

This runbook deploys **JS7 JobScheduler** (the supported successor to the EOL
JobScheduler 1.x) on a **Hostinger VPS** running Ubuntu, with the JOC Cockpit web UI
served over HTTPS on your own subdomain.

What you get on a single VPS:

| Component        | Bind            | Public? | Purpose |
|------------------|-----------------|---------|---------|
| MySQL 8          | 127.0.0.1:3306  | no      | JOC inventory/history database |
| JOC Cockpit (UI) | 127.0.0.1:4446  | via nginx | browser UI |
| Controller       | 127.0.0.1:4444  | no      | workflow orchestration |
| Agent            | 127.0.0.1:4445  | no      | runs the jobs |
| nginx + certbot  | 0.0.0.0:80,443  | yes     | TLS termination → proxy to JOC |

Only ports 22/80/443 are open (`ufw`). The JS7 components listen on localhost and are
reached only through nginx.

---

## 1. Prerequisites

1. **A Hostinger VPS** (not shared hosting — you need root, Java and MySQL).
   - In hPanel: *VPS → choose a KVM plan*. **2 GB RAM minimum, 4 GB recommended.**
   - OS template: **Ubuntu 22.04 or 24.04 LTS**.
   - Note the server's **public IP** and your **root SSH** credentials.
2. **A domain** you control (e.g. managed in Hostinger hPanel → Domains/DNS).
3. SSH access:
   ```bash
   ssh root@<vps-public-ip>
   ```

## 2. DNS — point a subdomain at the VPS (do this first)

Let's Encrypt validates over HTTP, so the DNS record must exist **before** step 6.

In your DNS provider (Hostinger hPanel → *Domains → DNS / Nameservers*), add:

| Type | Name        | Value (points to)     | TTL  |
|------|-------------|-----------------------|------|
| A    | `scheduler` | `<vps-public-ip>`     | 3600 |

This yields `scheduler.yourdomain.com`. Verify it resolves before continuing:

```bash
getent hosts scheduler.yourdomain.com
```

## 3. Get the code and configure

```bash
apt-get update && apt-get install -y git
git clone https://github.com/andremeloni1-cmyk/jobscheduler.git
cd jobscheduler

cp deploy/config.env.example deploy/config.env
nano deploy/config.env
```

Set at least:

- `DOMAIN` — your subdomain, e.g. `scheduler.yourdomain.com`
- `LETSENCRYPT_EMAIL` — your email (cert expiry notices)
- `JS7_VERSION` — a current LTS release (verify on the download page, see §8)
- `DB_PASSWORD` and `DB_ROOT_PASSWORD` — strong, unique passwords

`config.env` holds secrets and is git-ignored — never commit it.

## 4. Run the deployment

One command runs everything in order (each step is idempotent — safe to re-run):

```bash
sudo bash deploy/install-all.sh
```

Or run the steps individually to inspect each:

| Script | Does |
|--------|------|
| `01-prepare-server.sh` | apt update; OpenJDK 17; `jobscheduler` user; `ufw` (22/80/443); fail2ban; time sync |
| `02-install-mysql.sh` | install + harden MySQL; create `scheduler` DB, user, grants; bind to localhost |
| `03-install-joc-cockpit.sh` | download JOC + MySQL JDBC driver; render hibernate + response files; headless install; create DB tables; `js7-joc` systemd service |
| `04-install-controller.sh` | install Controller; `js7-controller` service |
| `05-install-agent.sh` | install Agent; `js7-agent` service |
| `06-nginx-tls.sh` | nginx reverse proxy + Let's Encrypt cert for `$DOMAIN` |
| `07-verify.sh` | health checks (services, ports, DB, HTTPS) |

## 5. First login (change the default password immediately)

1. Browse to **`https://scheduler.yourdomain.com`**.
2. Log in with the JS7 default account: **`root` / `root`**.
3. **Immediately change the `root` password** (JOC: *Profile / Manage Accounts*).
4. Create real named accounts and disable or restrict `root` per your policy.

## 6. Smoke test (end-to-end)

1. In JOC Cockpit → *Configuration → Agents*: register the local Agent
   (Controller id `controller`, Agent URL `http://localhost:4445`, Agent id `agent`).
2. Create a trivial workflow with one shell job (e.g. `echo hello`).
3. Deploy it to the Controller and run it.
4. Confirm a successful run under *History*.

## 7. Hardening (recommended)

- **SSH:** disable password + root login once your key works
  (`/etc/ssh/sshd_config`: `PermitRootLogin no`, `PasswordAuthentication no`; `systemctl restart ssh`).
- **Firewall:** confirm `ufw status` shows only 22/80/443.
- **TLS auto-renew:** certbot installs a systemd timer; check with
  `systemctl list-timers | grep certbot` and dry-run `certbot renew --dry-run`.
- **fail2ban:** `systemctl status fail2ban`.
- Keep `config.env` readable only by root: `chmod 600 deploy/config.env`.

## 8. Operations

**Verify health any time:**
```bash
sudo bash deploy/07-verify.sh
```

**Service control:**
```bash
systemctl status   js7-joc js7-controller js7-agent
systemctl restart  js7-joc
journalctl -u js7-joc -n 100 --no-pager
```

**Backup:**
```bash
# Database
mysqldump -u root -p scheduler > scheduler-$(date +%F).sql
# JOC/Controller/Agent config + data
tar -czf js7-data-$(date +%F).tar.gz /opt/sos-berlin.com/js7
```

**Upgrade:** bump `JS7_VERSION` in `config.env`, stop the services, then re-run the
install scripts (they download the new version and re-install in place):
```bash
systemctl stop js7-agent js7-controller js7-joc
sudo bash deploy/03-install-joc-cockpit.sh
sudo bash deploy/04-install-controller.sh
sudo bash deploy/05-install-agent.sh
```

**Find the latest JS7 release / exact archive filenames:**
- Releases & files: <https://sourceforge.net/projects/jobscheduler/files/JobScheduler.2/>
- Docs (Knowledge Base): <https://kb.sos-berlin.com/display/JS7>

If a download 404s, the archive filename changed for that release — copy the exact name
from the files page into the `*_ARCHIVE` patterns in `config.env`.

## 9. Troubleshooting

| Symptom | Check |
|---------|-------|
| `js7-joc` won't start | `journalctl -u js7-joc -n 100`; verify `JAVA_HOME`, MySQL up, JDBC jar present in `joc-data/lib` |
| JOC can't reach DB | re-run `02-install-mysql.sh`; confirm `hibernate.cfg.xml` credentials match `config.env` |
| certbot fails | DNS A record must resolve to this server; ports 80/443 open; retry with `LETSENCRYPT_STAGING="true"` first |
| 502 from nginx | JOC not listening on 4446 — `ss -ltnp | grep 4446`, check `js7-joc` |
| Installer flag error (Controller/Agent) | flag names can differ by release — run the extracted `install_js7_*.sh --help` and adjust scripts 04/05 |
| Port already in use | change the `*_HTTP_PORT` in `config.env` and re-run |

> **Note on the install scripts:** the systemd unit paths and the Controller/Agent
> installer flags follow the standard JS7 layout. They were validated by lint and
> template-render, but not against a live JS7 install. If a path or flag differs for your
> pinned `JS7_VERSION`, the error messages point to exactly what to adjust, and the
> templates in `deploy/templates/` are the single place to fix unit paths.
