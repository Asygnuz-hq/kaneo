ALTER TABLE "task" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
-- Backfill: a task already sitting in a final column has no recorded close
-- date, since this column didn't exist until now. updated_at is the closest
-- available proxy (imperfect if it was edited after closing, but far better
-- than leaving historical "done" work out of every closed-tasks report).
UPDATE "task" SET "completed_at" = "updated_at"
WHERE "completed_at" IS NULL
  AND "column_id" IN (SELECT "id" FROM "column" WHERE "is_final" = true);