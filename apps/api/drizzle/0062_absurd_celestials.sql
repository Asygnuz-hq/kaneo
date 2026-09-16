ALTER TABLE "project" ADD COLUMN "budget_cents" integer;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entry" ADD COLUMN "billable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entry" ADD COLUMN "hourly_rate_cents_snapshot" integer;--> statement-breakpoint
ALTER TABLE "workspace_member" ADD COLUMN "hourly_rate_cents" integer;