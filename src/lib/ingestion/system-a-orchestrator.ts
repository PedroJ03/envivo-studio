/**
 * System A Orchestrator
 *
 * Coordinates all System A connectors (Wikimedia, Ticketmaster, Eventbrite, Tandil, RSS).
 * Runs deduplication against existing events and stores normalized events to database.
 *
 * @module ingestion/system-a-orchestrator
 */

import { db } from "@/lib/db/client";
import { calendarEvents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { NormalizedEvent, RawEvent } from "./types";
import { WikimediaOnThisDayConnector } from "./sources/wikimedia-otd";
import { TicketmasterConnector } from "./sources/ticketmaster";
import { EventbriteConnector } from "./sources/eventbrite";
import { TandilMunicipioConnector } from "./sources/tandil-municipio";
import { RSSFeedConnector, RSS_FEEDS } from "./sources/rss-feeds";
import { IngestionCache } from "./cache";

// ============================================================================
// Types
// ============================================================================

export interface OrchestratorConfig {
  tenantId?: string;
  date?: Date;
  sources?: string[];
  cache?: IngestionCache;
}

export interface SourceIngestResult {
  source: string;
  itemsFetched: number;
  itemsCreated: number;
  duplicatesSkipped: number;
  errors: string[];
  durationMs: number;
}

// ============================================================================
// Connector Factory
// ============================================================================

type SourceConnector = {
  fetch: (ctx: { date?: Date; tenantId?: string }) => Promise<RawEvent[]>;
  normalize: (raw: RawEvent) => Promise<NormalizedEvent>;
  calculateHash: (item: NormalizedEvent) => string;
  name: string;
};

/**
 * Create a connector instance by name.
 */
function createConnector(
  sourceName: string,
  _config?: Record<string, unknown>,
): SourceConnector | null {
  switch (sourceName) {
    case "wikimedia":
      return new WikimediaOnThisDayConnector();

    case "ticketmaster":
      return new TicketmasterConnector();

    case "eventbrite":
      return new EventbriteConnector();

    case "tandil_municipio":
      return new TandilMunicipioConnector();

    case "eldiario_rss":
      return new RSSFeedConnector("eldiario");

    default:
      console.warn(`[Orchestrator] Unknown source: ${sourceName}`);
      return null;
  }
}

/**
 * Get all System A source names.
 */
export function getSystemASources(): string[] {
  return [
    "wikimedia",
    "ticketmaster",
    "eventbrite",
    "tandil_municipio",
    "eldiario_rss",
  ];
}

// ============================================================================
// Orchestrator
// ============================================================================

export class SystemAOrchestrator {
  private cache?: IngestionCache;

  constructor(config?: OrchestratorConfig) {
    this.cache = config?.cache;
  }

  /**
   * Run ingestion for all System A sources.
   */
  async ingest(config: OrchestratorConfig): Promise<SourceIngestResult[]> {
    const startTime = Date.now();
    const sources = config.sources || getSystemASources();
    const date = config.date || new Date();

    console.info("[Orchestrator] Starting System A ingestion", {
      sources,
      date: date.toISOString(),
      tenantId: config.tenantId,
    });

    const results: SourceIngestResult[] = [];

    for (const sourceName of sources) {
      const sourceStartTime = Date.now();

      try {
        const result = await this.ingestSource(sourceName, {
          date,
          tenantId: config.tenantId,
        });

        results.push(result);

        console.info(`[Orchestrator] Completed source: ${sourceName}`, {
          itemsCreated: result.itemsCreated,
          duplicatesSkipped: result.duplicatesSkipped,
          durationMs: Date.now() - sourceStartTime,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        console.error(`[Orchestrator] Failed source: ${sourceName}`, {
          error: errorMessage,
          durationMs: Date.now() - sourceStartTime,
        });

        results.push({
          source: sourceName,
          itemsFetched: 0,
          itemsCreated: 0,
          duplicatesSkipped: 0,
          errors: [errorMessage],
          durationMs: Date.now() - sourceStartTime,
        });
      }
    }

    const totalDuration = Date.now() - startTime;

    console.info("[Orchestrator] System A ingestion complete", {
      totalDurationMs: totalDuration,
      sourcesProcessed: results.length,
      totalCreated: results.reduce((sum, r) => sum + r.itemsCreated, 0),
      totalDuplicates: results.reduce((sum, r) => sum + r.duplicatesSkipped, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
    });

    return results;
  }

  /**
   * Ingest events from a single source.
   */
  async ingestSource(
    sourceName: string,
    ctx: { date?: Date; tenantId?: string },
  ): Promise<SourceIngestResult> {
    const connector = createConnector(sourceName);

    if (!connector) {
      return {
        source: sourceName,
        itemsFetched: 0,
        itemsCreated: 0,
        duplicatesSkipped: 0,
        errors: [`Unknown source: ${sourceName}`],
        durationMs: 0,
      };
    }

    let itemsFetched = 0;
    let itemsCreated = 0;
    let duplicatesSkipped = 0;
    const errors: string[] = [];

    try {
      // Fetch raw items from source
      const rawItems = await connector.fetch(ctx);
      itemsFetched = rawItems.length;

      console.debug(
        `[Orchestrator] Fetched ${rawItems.length} items from ${sourceName}`,
      );

      // Process each item
      for (const rawItem of rawItems) {
        try {
          // Normalize the raw item
          const normalized = await connector.normalize(rawItem);

          // Check for duplicates
          const isDuplicate = await this.checkDuplicate(normalized);

          if (isDuplicate) {
            duplicatesSkipped++;
            continue;
          }

          // Store the event
          await this.storeEvent(normalized);
          itemsCreated++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errors.push(
            `Failed to process item ${rawItem.externalId}: ${errorMessage}`,
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`Failed to fetch from ${sourceName}: ${errorMessage}`);
    }

    return {
      source: sourceName,
      itemsFetched,
      itemsCreated,
      duplicatesSkipped,
      errors,
      durationMs: 0,
    };
  }

  /**
   * Check if an event is a duplicate.
   */
  private async checkDuplicate(event: NormalizedEvent): Promise<boolean> {
    // Check cache first (fast path)
    if (this.cache) {
      const cached = await this.cache.getDedupeLookup(event.contentHash);
      if (cached) {
        return true;
      }
    }

    // Check database by source + sourceId
    const existing = await db
      .select({ id: calendarEvents.id })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.source, event.source),
          eq(calendarEvents.sourceId, event.sourceId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Cache the dedupe result
      if (this.cache) {
        await this.cache.cacheDedupeLookup(event.contentHash, existing[0].id);
      }
      return true;
    }

    // Check by content hash
    const hashMatchResult = await db
      .select({ id: calendarEvents.id })
      .from(calendarEvents)
      .where(eq(calendarEvents.contentHash, event.contentHash))
      .limit(1);

    if (hashMatchResult.length > 0) {
      if (this.cache) {
        await this.cache.cacheDedupeLookup(
          event.contentHash,
          hashMatchResult[0].id,
        );
      }
      return true;
    }

    return false;
  }

  /**
   * Store an event to the database.
   */
  private async storeEvent(event: NormalizedEvent): Promise<void> {
    const eventDate =
      event.eventDate instanceof Date
        ? event.eventDate.toISOString().split("T")[0]
        : event.eventDate;

    await db.insert(calendarEvents).values({
      source: event.source,
      sourceId: event.sourceId,
      sourceUrl: event.sourceUrl,
      eventType: event.eventType,
      title: event.title,
      description: event.description,
      eventDate,
      year: event.year,
      location: event.location || {},
      artists: event.artists || [],
      images: event.images || [],
      tags: event.tags || [],
      tenantId: event.tenantId,
      isShared: event.isShared,
      priority: event.priority,
      metadata: event.metadata || {},
      contentHash: event.contentHash,
    });

    // Cache the dedupe lookup
    if (this.cache) {
      await this.cache.cacheDedupeLookup(event.contentHash, "");
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Run System A ingestion for all sources.
 */
export async function runSystemAIngestion(
  config?: OrchestratorConfig,
): Promise<SourceIngestResult[]> {
  const orchestrator = new SystemAOrchestrator({ cache: config?.cache });
  return orchestrator.ingest(config || {});
}

/**
 * Run System A ingestion for a specific source.
 */
export async function ingestFromSource(
  sourceName: string,
  config?: OrchestratorConfig,
): Promise<SourceIngestResult> {
  const orchestrator = new SystemAOrchestrator({ cache: config?.cache });
  const results = await orchestrator.ingest({
    ...config,
    sources: [sourceName],
  });

  return (
    results[0] || {
      source: sourceName,
      itemsFetched: 0,
      itemsCreated: 0,
      duplicatesSkipped: 0,
      errors: ["Source not found"],
      durationMs: 0,
    }
  );
}

// ============================================================================
// Export
// ============================================================================

export default SystemAOrchestrator;
