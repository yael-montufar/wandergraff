-- Fix any existing null UserRole values
UPDATE "User" SET "role" = 'REGULAR_USER' WHERE "role" IS NULL;