CREATE TABLE "external_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_contact_workspace_id_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
CREATE TABLE "task_external_assignee" (
	"task_id" text NOT NULL,
	"external_contact_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_external_assignee_task_id_external_contact_id_pk" PRIMARY KEY("task_id","external_contact_id")
);
--> statement-breakpoint
ALTER TABLE "external_contact" ADD CONSTRAINT "external_contact_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_external_assignee" ADD CONSTRAINT "task_external_assignee_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_external_assignee" ADD CONSTRAINT "task_external_assignee_external_contact_id_external_contact_id_fk" FOREIGN KEY ("external_contact_id") REFERENCES "public"."external_contact"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "external_contact_workspaceId_idx" ON "external_contact" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_external_assignee_taskId_idx" ON "task_external_assignee" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_external_assignee_externalContactId_idx" ON "task_external_assignee" USING btree ("external_contact_id");