CREATE TABLE "generic_webhook_retry" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"event_name" text NOT NULL,
	"task_id" text NOT NULL,
	"user_id" text,
	"data" text DEFAULT '{}' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generic_webhook_retry" ADD CONSTRAINT "generic_webhook_retry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "generic_webhook_retry_nextAttemptAt_idx" ON "generic_webhook_retry" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "generic_webhook_retry_projectId_taskId_idx" ON "generic_webhook_retry" USING btree ("project_id","task_id");