-- Track intake-reconciliation misses so a job that vanishes from a company's
-- emails across two distinct emails can be auto-removed (assumed cancelled).
ALTER TABLE "Job" ADD COLUMN "reviewMisses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Job" ADD COLUMN "reviewMessageId" TEXT;
