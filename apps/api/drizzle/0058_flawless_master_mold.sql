CREATE TABLE "doc_page" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"parent_id" text,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doc_page" ADD CONSTRAINT "doc_page_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "doc_page" ADD CONSTRAINT "doc_page_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "doc_page" ADD CONSTRAINT "doc_page_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "doc_page" ADD CONSTRAINT "doc_page_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."doc_page"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "doc_page_projectId_idx" ON "doc_page" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "doc_page_parentId_idx" ON "doc_page" USING btree ("parent_id");