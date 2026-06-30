-- Domain for a sender, in lower case. Bare-domain rows (no '@') return as-is;
-- full addresses ("info@miikitchen.com.au") return the part after the '@'.
-- canonical(email) = the newest LeadSource sharing that domain (latest wins, id
-- breaks ties). Step order matters: copy displayName onto survivors, keep them
-- enabled, repoint jobs, then delete the now-merged duplicates.

-- 1. Carry a client-facing displayName onto the canonical row if it lacks one
--    but a duplicate in its group has one (so "A&Z (via Ingenuity)" survives).
UPDATE "LeadSource"
SET "displayName" = (
  SELECT d."displayName" FROM "LeadSource" d
  WHERE lower(substr(d."email", instr(d."email", '@') + 1)) =
        lower(substr("LeadSource"."email", instr("LeadSource"."email", '@') + 1))
    AND d."displayName" IS NOT NULL AND trim(d."displayName") <> ''
  ORDER BY d."createdAt" DESC, d."id" DESC LIMIT 1
)
WHERE ("displayName" IS NULL OR trim("displayName") = '')
  AND EXISTS (
    SELECT 1 FROM "LeadSource" d
    WHERE lower(substr(d."email", instr(d."email", '@') + 1)) =
          lower(substr("LeadSource"."email", instr("LeadSource"."email", '@') + 1))
      AND d."displayName" IS NOT NULL AND trim(d."displayName") <> ''
  );

-- 2. Keep the canonical row enabled if any row in its group was enabled.
UPDATE "LeadSource"
SET "enabled" = 1
WHERE "enabled" = 0
  AND EXISTS (
    SELECT 1 FROM "LeadSource" d
    WHERE lower(substr(d."email", instr(d."email", '@') + 1)) =
          lower(substr("LeadSource"."email", instr("LeadSource"."email", '@') + 1))
      AND d."enabled" = 1
  )
  AND "id" = (
    SELECT c."id" FROM "LeadSource" c
    WHERE lower(substr(c."email", instr(c."email", '@') + 1)) =
          lower(substr("LeadSource"."email", instr("LeadSource"."email", '@') + 1))
    ORDER BY c."createdAt" DESC, c."id" DESC LIMIT 1
  );

-- 3. Repoint jobs from a merged duplicate to the canonical row of its domain.
UPDATE "Job"
SET "companyId" = (
  SELECT c."id" FROM "LeadSource" c
  WHERE lower(substr(c."email", instr(c."email", '@') + 1)) = (
          SELECT lower(substr(s."email", instr(s."email", '@') + 1))
          FROM "LeadSource" s WHERE s."id" = "Job"."companyId")
  ORDER BY c."createdAt" DESC, c."id" DESC LIMIT 1
)
WHERE "companyId" IS NOT NULL
  AND "companyId" <> (
    SELECT c."id" FROM "LeadSource" c
    WHERE lower(substr(c."email", instr(c."email", '@') + 1)) = (
            SELECT lower(substr(s."email", instr(s."email", '@') + 1))
            FROM "LeadSource" s WHERE s."id" = "Job"."companyId")
    ORDER BY c."createdAt" DESC, c."id" DESC LIMIT 1
  );

-- 4. Delete every row that isn't the canonical (newest) one for its domain.
DELETE FROM "LeadSource"
WHERE "id" <> (
  SELECT c."id" FROM "LeadSource" c
  WHERE lower(substr(c."email", instr(c."email", '@') + 1)) =
        lower(substr("LeadSource"."email", instr("LeadSource"."email", '@') + 1))
  ORDER BY c."createdAt" DESC, c."id" DESC LIMIT 1
);
