-- Treat joinery companies as the app's "clients".
ALTER TABLE "LeadSource" ADD COLUMN "displayName" TEXT;
ALTER TABLE "Job" ADD COLUMN "companyId" TEXT;

-- Ingenuity Joinery (Peter Baldwin) jobs are for A&Z.
UPDATE "LeadSource" SET "displayName" = 'A&Z (via Ingenuity)' WHERE lower("email") LIKE '%ingenuity%';

-- Backfill companyId on existing jobs from the sender domain they were imported from.
UPDATE "Job" SET "companyId" = (
  SELECT ls."id" FROM "LeadSource" ls
  WHERE "Job"."leadSource" IS NOT NULL
    AND instr(lower("Job"."leadSource"), lower(ls."email")) > 0
  LIMIT 1
) WHERE "companyId" IS NULL;
