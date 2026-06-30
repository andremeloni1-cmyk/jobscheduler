# Per-company pricing guides (rate cards)

Source data for the upcoming **invoicing + Xero** feature. Pricing is **per
company** — each builder/customer has its own rate card and due terms. One file
per company here; these become the seeded **rate cards** when the invoice
builder is built (Phase 2).

## Conventions (shared)
- **GST-exclusive**: line rates exclude GST; invoices add **10% GST on top**.
- **One invoice per job**, covering all rooms (no deposit/progress).
- **Bill-to = the company** (the builder/customer on the job), not the homeowner.
- Each line is prefixed with the job's **quote number** (e.g. `QU3190 …`).
- **Invoice number is assigned by Xero** (e.g. `INV-0244`) on push — not generated here.
- **Units**: `each` (count), `metre` (qty = linear metres), `fixed` (1 × price).
- Rates are **editable presets** — a job can override a line if needed.

## Your business (sender)
- [`_business.md`](_business.md) — andre meloni photography (ABN, bank, remit-to).

## Companies (customers)
- [`mii-kitchens.md`](mii-kitchens.md) — Mii Kitchens (builder). ✅ INV-0244.
- [`harrington-kitchens.md`](harrington-kitchens.md) — Harrington Kitchens. ✅ INV-0230.
- [`peter.md`](peter.md) — Ingenuity joinery (Peter). ✅ INV-0239.
- _more to come as invoices are supplied (one file per company)._

Each company prices differently (cabinet tiers, per-item vs per-metre, handle
rates, due terms all vary) — confirming that rate cards must be **per company**.
