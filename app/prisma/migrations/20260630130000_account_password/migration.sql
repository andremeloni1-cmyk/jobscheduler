-- App login password, changeable from Settings. Overrides APP_PASSWORD when set.
ALTER TABLE "Account" ADD COLUMN "passwordHash" TEXT;
