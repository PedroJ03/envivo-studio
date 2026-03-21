CREATE TYPE "public"."topic_source_type" AS ENUM('calendar_event', 'content_feed_item');--> statement-breakpoint
CREATE TYPE "public"."topic_urgency" AS ENUM('low', 'medium', 'high', 'breaking');--> statement-breakpoint
CREATE TYPE "public"."topic_selection_status" AS ENUM('pending', 'generating', 'ready', 'discarded');--> statement-breakpoint
CREATE TABLE "topic_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
	"source_type" "topic_source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"formats" jsonb NOT NULL DEFAULT '[]',
	"target_publish_at" timestamp with time zone,
	"urgency" "topic_urgency" NOT NULL DEFAULT 'medium',
	"status" "topic_selection_status" NOT NULL DEFAULT 'pending',
	"created_by" uuid NOT NULL REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "topic_selections_tenant_source_unique" ON "topic_selections" USING btree ("tenant_id", "source_type", "source_id");--> statement-breakpoint
CREATE INDEX "idx_topic_selections_tenant_status" ON "topic_selections" USING btree ("tenant_id", "status");--> statement-breakpoint
CREATE INDEX "idx_topic_selections_source" ON "topic_selections" USING btree ("source_type", "source_id");--> statement-breakpoint
CREATE INDEX "idx_topic_selections_publish" ON "topic_selections" USING btree ("target_publish_at");--> statement-breakpoint
CREATE INDEX "idx_topic_selections_created" ON "topic_selections" USING btree ("created_at" DESC);