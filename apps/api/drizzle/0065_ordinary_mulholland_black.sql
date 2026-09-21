CREATE TABLE "external_task_mirror" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"external_task_id" text NOT NULL,
	"local_task_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_task_mirror_source_external_id_unique" UNIQUE("source","external_task_id")
);
--> statement-breakpoint
ALTER TABLE "external_task_mirror" ADD CONSTRAINT "external_task_mirror_local_task_id_task_id_fk" FOREIGN KEY ("local_task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "external_task_mirror_localTaskId_idx" ON "external_task_mirror" USING btree ("local_task_id");