CREATE TYPE "public"."content_feed_type" AS ENUM('breaking_news', 'trending', 'curiosity', 'trivia');--> statement-breakpoint
CREATE TABLE "content_feed_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"source_url" text,
	"content_type" "content_feed_type" NOT NULL,
	"title" varchar(150) NOT NULL,
	"body" text NOT NULL,
	"hook" varchar(100) NOT NULL,
	"facts" jsonb DEFAULT '[]' NOT NULL,
	"images" jsonb DEFAULT '[]' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"tenant_id" uuid REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
	"is_shared" boolean DEFAULT false NOT NULL,
	"publish_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"viral_score" float DEFAULT 0 NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "content_feed_items_source_source_id_unique" ON "content_feed_items" USING btree ("source", "source_id");--> statement-breakpoint
CREATE INDEX "idx_content_feed_items_tenant_publish" ON "content_feed_items" USING btree ("tenant_id", "publish_at");--> statement-breakpoint
CREATE INDEX "idx_content_feed_items_content_type" ON "content_feed_items" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "idx_content_feed_items_content_hash" ON "content_feed_items" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_content_feed_items_publish_active" ON "content_feed_items" USING btree ("tenant_id", "is_shared", "publish_at", "viral_score") WHERE "publish_at" <= NOW() AND ("expires_at" IS NULL OR "expires_at" > NOW());--> statement-breakpoint
CREATE INDEX "idx_content_feed_items_title_trgm" ON "content_feed_items" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_content_feed_items_body_trgm" ON "content_feed_items" USING gin ("body" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_content_feed_items_expires" ON "content_feed_items" USING btree ("expires_at") WHERE "expires_at" IS NOT NULL;