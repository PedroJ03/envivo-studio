CREATE TYPE "public"."event_type" AS ENUM('historical', 'concert', 'festival', 'local_event');--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"source_url" text NOT NULL,
	"event_type" "event_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"event_date" date NOT NULL,
	"year" integer,
	"location" jsonb DEFAULT '{"city":null,"region":null,"country":null,"venue":null}' NOT NULL,
	"artists" jsonb DEFAULT '[]' NOT NULL,
	"images" jsonb DEFAULT '[]' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"tenant_id" uuid REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
	"is_shared" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_source_source_id_unique" ON "calendar_events" USING btree ("source", "source_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_tenant_date" ON "calendar_events" USING btree ("tenant_id", "event_date");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_source_event_type" ON "calendar_events" USING btree ("source", "event_type");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_content_hash" ON "calendar_events" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_upcoming" ON "calendar_events" USING btree ("event_date", "priority") WHERE "event_date" >= CURRENT_DATE;--> statement-breakpoint
CREATE INDEX "idx_calendar_events_title_trgm" ON "calendar_events" USING gin ("title" gin_trgm_ops);