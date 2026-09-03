CREATE TABLE "custom_field" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"options" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_field_workspace_id_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
CREATE TABLE "task_custom_field_value" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"custom_field_id" text NOT NULL,
	"value" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_custom_field_value_task_id_custom_field_id_unique" UNIQUE("task_id","custom_field_id")
);
--> statement-breakpoint
ALTER TABLE "custom_field" ADD CONSTRAINT "custom_field_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_custom_field_value" ADD CONSTRAINT "task_custom_field_value_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_custom_field_value" ADD CONSTRAINT "task_custom_field_value_custom_field_id_custom_field_id_fk" FOREIGN KEY ("custom_field_id") REFERENCES "public"."custom_field"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "custom_field_workspaceId_idx" ON "custom_field" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "task_custom_field_value_taskId_idx" ON "task_custom_field_value" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_custom_field_value_customFieldId_idx" ON "task_custom_field_value" USING btree ("custom_field_id");