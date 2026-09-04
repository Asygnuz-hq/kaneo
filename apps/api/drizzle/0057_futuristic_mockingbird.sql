CREATE TABLE "goal" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'on-track' NOT NULL,
	"target_date" timestamp,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "goal_project_id_title_unique" UNIQUE("project_id","title")
);
--> statement-breakpoint
CREATE TABLE "goal_task" (
	"id" text PRIMARY KEY NOT NULL,
	"goal_id" text NOT NULL,
	"task_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "goal_task_goal_id_task_id_unique" UNIQUE("goal_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goal_task" ADD CONSTRAINT "goal_task_goal_id_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goal"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goal_task" ADD CONSTRAINT "goal_task_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "goal_projectId_idx" ON "goal" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "goal_task_goalId_idx" ON "goal_task" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "goal_task_taskId_idx" ON "goal_task" USING btree ("task_id");