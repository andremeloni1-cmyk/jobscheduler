# Legacy — SOS JobScheduler 1.x install samples (DEPRECATED)

> ⚠️ **These files are kept for historical reference only. Do not use them for a new
> deployment.**

This directory contains the original contents of this repository: install/config
samples for **SOS JobScheduler 1.3.12** (~2012).

Why they are deprecated:

- The JobScheduler **1.x line is end-of-life**. It is no longer maintained or supported.
- The sos-berlin.com download URLs referenced in `README.textile` no longer exist.
- The PHP web UI (`apacheconf/`) was already marked *deprecated* in the original docs.

The supported successor is **JS7 JobScheduler**, which ships its own browser UI
(JOC Cockpit) and no longer needs Apache/PHP.

👉 **For a current deployment, use the `deploy/` kit and follow [`docs/RUNBOOK.md`](../docs/RUNBOOK.md).**

Contents:

- `README.textile` — original install notes for JobScheduler 1.3.12
- `jobschedulerconf/sample_scheduler_install.xml` — IzPack response file for the 1.x installer
- `apacheconf/` — Apache httpd + PHP 5 config samples for the deprecated web UI
