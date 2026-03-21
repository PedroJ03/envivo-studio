/**
 * System B: Daily Content Ingestion Inngest Function
 *
 * Re-exports the daily content orchestrator function for registration.
 * Runs daily at 6 AM (Argentina time) to ingest trivia and curiosity content.
 *
 * @module inngest/functions/ingest-daily-content
 */

// Re-export the daily content function from the orchestrator
// The actual implementation is in system-b-daily-orchestrator.ts
export { systemBDailyFunction } from "@/lib/ingestion/system-b-daily-orchestrator";
