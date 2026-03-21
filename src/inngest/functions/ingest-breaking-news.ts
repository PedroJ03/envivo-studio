/**
 * System B: Breaking News Ingestion Inngest Function
 *
 * Re-exports the breaking news orchestrator function for registration.
 * Runs every 30 minutes to poll breaking news sources (NewsAPI, GNews, Rolling Stone).
 *
 * @module inngest/functions/ingest-breaking-news
 */

// Re-export the breaking news function from the orchestrator
// The actual implementation is in system-b-breaking-orchestrator.ts
export { systemBBreakingFunction } from "@/lib/ingestion/system-b-breaking-orchestrator";
