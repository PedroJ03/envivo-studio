ALTER TABLE "content_state" ALTER COLUMN "state" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "content_state" ALTER COLUMN "state" SET DEFAULT 'draft'::text;--> statement-breakpoint
DROP TYPE "public"."content_state";--> statement-breakpoint
CREATE TYPE "public"."content_state" AS ENUM('draft', 'approved', 'generating', 'generated', 'reviewed', 'published', 'rejected', 'failed');--> statement-breakpoint
ALTER TABLE "content_state" ALTER COLUMN "state" SET DEFAULT 'draft'::"public"."content_state";--> statement-breakpoint
ALTER TABLE "content_state" ALTER COLUMN "state" SET DATA TYPE "public"."content_state" USING "state"::"public"."content_state";--> statement-breakpoint
ALTER TABLE "content_state" ADD COLUMN "ig_post_id" text;