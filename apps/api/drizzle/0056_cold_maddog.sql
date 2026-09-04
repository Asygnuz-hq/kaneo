CREATE TABLE "recurring_task" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT 'no-priority' NOT NULL,
	"issue_type" text DEFAULT 'task' NOT NULL,
	"label_ids" text DEFAULT '[]' NOT NULL,
	"assignee_id" text,
	"frequency" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp NOT NULL,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_task_project_id_name_unique" UNIQUE("project_id","name")
);
--> statement-breakpoint
ALTER TABLE "recurring_task" ADD CONSTRAINT "recurring_task_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "recurring_task" ADD CONSTRAINT "recurring_task_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "recurring_task_projectId_idx" ON "recurring_task" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "recurring_task_nextRunAt_idx" ON "recurring_task" USING btree ("next_run_at");