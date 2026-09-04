CREATE TABLE "task_template" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT 'no-priority' NOT NULL,
	"issue_type" text DEFAULT 'task' NOT NULL,
	"label_ids" text DEFAULT '[]' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_template_project_id_name_unique" UNIQUE("project_id","name")
);
--> statement-breakpoint
ALTER TABLE "task_template" ADD CONSTRAINT "task_template_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_template_projectId_idx" ON "task_template" USING btree ("project_id");