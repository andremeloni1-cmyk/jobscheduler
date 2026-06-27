# JobScheduler on Hostinger

Deploy **JS7 JobScheduler** — the supported successor to the end-of-life SOS
JobScheduler 1.x — on a **Hostinger VPS**, with the **JOC Cockpit** web UI served over
**HTTPS** on your own subdomain.

This repo is a deployment kit: idempotent install scripts plus a runbook. It originally
held install samples for the EOL JobScheduler 1.3.12; those are archived under
[`legacy/`](legacy/) for reference and are **not** used anymore.

## What it sets up

A single VPS running:

- **MySQL 8** — JOC inventory/history database (localhost only)
- **JOC Cockpit** — browser UI on `127.0.0.1:4446`, exposed via nginx + Let's Encrypt
- **Controller** (`:4444`) — orchestrates workflows
- **Agent** (`:4445`) — runs the jobs
- **nginx + certbot** — TLS termination on ports 80/443

Only 22/80/443 are open (`ufw`); the JS7 components listen on localhost and are reached
through nginx.

## Quick start

On a fresh **Ubuntu 22.04/24.04 LTS** Hostinger VPS, as root:

```bash
git clone https://github.com/andremeloni1-cmyk/jobscheduler.git
cd jobscheduler
cp deploy/config.env.example deploy/config.env
nano deploy/config.env          # set DOMAIN, email, JS7_VERSION, DB passwords
sudo bash deploy/install-all.sh
```

Then browse to `https://<your-subdomain>` and log in with the JS7 default
**`root` / `root`** — and change that password immediately.

**Before you start:** create a DNS `A` record for your subdomain pointing at the VPS IP
(Let's Encrypt needs it). Full step-by-step instructions, hardening, backups, upgrades
and troubleshooting are in **[`docs/RUNBOOK.md`](docs/RUNBOOK.md)**.

## Repository layout

```
deploy/                 deployment kit
  config.env.example    copy to config.env and edit (git-ignored; holds secrets)
  install-all.sh        runs 01..07 in order
  01..07-*.sh           individual, idempotent install/verify steps
  lib/common.sh         shared helpers
  templates/            systemd units, nginx vhost, hibernate + JOC response files
docs/RUNBOOK.md         full deployment guide
legacy/                 archived JobScheduler 1.x samples (deprecated)
```

## Notes

- Requires a **VPS** (root + Java + MySQL). Shared hosting will not work.
- Scripts are validated by `shellcheck`/`bash -n` and template-render checks; live
  end-to-end verification happens when you run them on the VPS (see the runbook).
- References: [JS7 Knowledge Base](https://kb.sos-berlin.com/display/JS7) ·
  [JS7 downloads](https://sourceforge.net/projects/jobscheduler/files/JobScheduler.2/)
