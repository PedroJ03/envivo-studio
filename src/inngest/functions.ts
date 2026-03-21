import { inngestClient } from "@/inngest/client";
import { scrapeEventFunction } from "./functions/scrape-event";
import { contentPipelineFunctions } from "./functions/pipeline";
import { instagramPublishFunction } from "./functions/publish-instagram";

// Content Ingestion Functions - System A (Calendar Events)
import {
  ingestCalendarEventsFunction,
  ingestCalendarSourceFunction,
} from "./functions/ingest-calendar-events";

// Content Ingestion Functions - System B (Breaking News & Daily Content)
import { systemBBreakingFunction } from "./functions/ingest-breaking-news";
import { systemBDailyFunction } from "./functions/ingest-daily-content";

export const functions = [scrapeEventFunction];

// Foundation placeholder for future pipeline functions.
// Keep this file as the registry entry consumed by the Inngest route handler.
export const inngestFunctionRegistry = [
  ...functions,
  ...contentPipelineFunctions,
  instagramPublishFunction,

  // Content Ingestion Functions - System A (Calendar Events)
  ingestCalendarEventsFunction,
  ingestCalendarSourceFunction,

  // Content Ingestion Functions - System B (Breaking News & Daily Content)
  systemBBreakingFunction,
  systemBDailyFunction,
];

export { inngestClient };
