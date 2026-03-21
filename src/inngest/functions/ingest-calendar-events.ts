/**
 * System A: Calendar Events Ingestion Inngest Function
 *
 * Runs at 8 AM, 3 PM, and 9 PM (Argentina time) to ingest calendar events
 * from all System A sources: Wikimedia, Ticketmaster, Eventbrite, Tandil, and RSS.
 *
 * @module inngest/functions/ingest-calendar-events
 */

import { inngestClient } from "@/inngest/client";
import { SystemAOrchestrator } from "@/lib/ingestion/system-a-orchestrator";
import { IngestionCache } from "@/lib/ingestion/cache";

/**
 * System A Calendar Events Ingestion Function
 *
 * Triggered on a schedule (8am, 3pm, 9pm Argentina time) to ingest
 * calendar events from all configured System A sources.
 */
export const ingestCalendarEventsFunction = inngestClient.createFunction(
  {
    id: "system-a-calendar-events",
    name: "System A: Calendar Events Ingestion",
    // Run at 8:00, 15:00, and 21:00 America/Argentina/Buenos_Aires
    triggers: [{ cron: "TZ=America/Argentina/Buenos_Aires 0 8,15,21 * * *" }],
    // Ensure only one instance runs at a time
    concurrency: 1,
  },
  async ({ step }) => {
    const startTime = Date.now();

    // Initialize cache for deduplication
    let cache: IngestionCache | undefined;
    try {
      cache = await IngestionCache.create();
    } catch (error) {
      console.warn(
        "[SystemA:Calendar] Cache initialization failed, continuing without cache",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }

    // Create orchestrator instance
    const orchestrator = new SystemAOrchestrator({ cache });

    // Run ingestion for all sources
    const sourceResults = await step.run("run-ingestion", async () => {
      try {
        const results = await orchestrator.ingest({
          // Use Argentina timezone for date-based sources
          date: new Date(),
        });
        return { results, error: null };
      } catch (error) {
        return {
          results: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // Handle case where ingestion threw an error
    if (sourceResults.error) {
      await step.run("log-error", async () => {
        console.error("[SystemA:Calendar] Ingestion failed", {
          error: sourceResults.error,
          durationMs: Date.now() - startTime,
        });
      });

      return {
        success: false,
        error: sourceResults.error,
        durationMs: Date.now() - startTime,
        sourcesProcessed: 0,
        totalEventsCreated: 0,
        totalDuplicatesSkipped: 0,
        sourceBreakdown: [],
      };
    }

    // At this point, we know results is defined (no error case)
    const results = sourceResults.results;

    // Calculate aggregate metrics
    const totalEventsCreated = results.reduce(
      (sum, r) => sum + (r?.itemsCreated ?? 0),
      0,
    );
    const totalDuplicatesSkipped = results.reduce(
      (sum, r) => sum + (r?.duplicatesSkipped ?? 0),
      0,
    );
    const totalErrors = results.reduce(
      (sum, r) => sum + (r?.errors?.length ?? 0),
      0,
    );
    const sourcesWithErrors = results.filter(
      (r) => (r?.errors?.length ?? 0) > 0,
    ).length;

    // Build source-by-source breakdown
    const sourceBreakdown = results.map((r) => ({
      source: r?.source ?? "unknown",
      itemsFetched: r?.itemsFetched ?? 0,
      itemsCreated: r?.itemsCreated ?? 0,
      duplicatesSkipped: r?.duplicatesSkipped ?? 0,
      errors: r?.errors ?? [],
      durationMs: r?.durationMs ?? 0,
    }));

    // Log summary
    await step.run("log-summary", async () => {
      console.info("[SystemA:Calendar] Ingestion run complete", {
        durationMs: Date.now() - startTime,
        sourcesProcessed: results.length,
        totalEventsCreated,
        totalDuplicatesSkipped,
        totalErrors,
        sourcesWithErrors,
        sourceBreakdown,
      });
    });

    // Return structured result for monitoring
    return {
      success: totalErrors === 0,
      durationMs: Date.now() - startTime,
      sourcesProcessed: results.length,
      totalEventsCreated,
      totalDuplicatesSkipped,
      totalErrors,
      sourceBreakdown,
    };
  },
);

/**
 * Ingest from a specific System A source (for manual/triggered runs).
 *
 * This function can be invoked by other Inngest functions or events
 * to ingest from a specific source on-demand.
 */
export const ingestCalendarSourceFunction = inngestClient.createFunction(
  {
    id: "system-a-calendar-source",
    name: "System A: Ingest from Source",
    // Limit concurrent runs per source to avoid overwhelming specific APIs
    concurrency: {
      limit: 3,
      key: "event.data.source",
    },
  },
  async ({ event, step }) => {
    const { source, tenantId, date } = event.data as {
      source: string;
      tenantId?: string;
      date?: string;
    };

    const startTime = Date.now();

    // Initialize cache
    let cache: IngestionCache | undefined;
    try {
      cache = await IngestionCache.create();
    } catch (error) {
      console.warn("[SystemA:Source] Cache initialization failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const orchestrator = new SystemAOrchestrator({ cache });

    const result = await step.run("ingest-source", async () => {
      try {
        const results = await orchestrator.ingestSource(source, {
          tenantId,
          date: date ? new Date(date) : new Date(),
        });
        return { result: results, error: null };
      } catch (error) {
        return {
          result: {
            source,
            itemsFetched: 0,
            itemsCreated: 0,
            duplicatesSkipped: 0,
            errors: [error instanceof Error ? error.message : String(error)],
            durationMs: 0,
          },
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    await step.run("log-result", async () => {
      console.info(`[SystemA:Source] Ingested from ${source}`, {
        source,
        itemsCreated: result.result.itemsCreated,
        duplicatesSkipped: result.result.duplicatesSkipped,
        errors: result.result.errors.length,
        durationMs: Date.now() - startTime,
      });
    });

    return {
      source,
      success: result.error === null,
      error: result.error,
      itemsCreated: result.result.itemsCreated,
      duplicatesSkipped: result.result.duplicatesSkipped,
      durationMs: Date.now() - startTime,
    };
  },
);
