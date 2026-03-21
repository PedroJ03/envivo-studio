/**
 * System B Daily Content Orchestrator
 *
 * Coordinates daily content sources (Wikidata trivia, curiosity feeds).
 * Runs once per day (morning) to generate evergreen and curiosity content.
 */

import { inngestClient } from "@/inngest/client";
import { db } from "@/lib/db/client";
import { contentFeedItems } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createWikidataConnector } from "./sources/wikidata";
import type { ContentFeedItem, RawFeedItem } from "./types";
import { IngestionCache } from "./cache";

/**
 * System B Daily Content Function
 * Runs daily at 6 AM to fetch trivia and curiosity content.
 */
export const systemBDailyFunction = inngestClient.createFunction(
  {
    id: "system-b-daily-content",
    name: "System B: Daily Content (Trivia & Curiosities)",
    // Run at 6 AM daily
    triggers: [{ cron: "TZ=America/Argentina/Buenos_Aires 0 6 * * *" }],
    concurrency: 1,
  },
  async ({ step }) => {
    const startTime = Date.now();

    // Initialize cache
    const cache = await IngestionCache.create();

    const results: {
      source: string;
      fetched: number;
      created: number;
      duplicates: number;
      errors: string[];
    }[] = [];

    // Fetch from Wikidata
    const wikidataResult = await step.run("fetch-wikidata", async () => {
      try {
        const connector = createWikidataConnector(cache);
        const rawItems = await connector.fetchWithRetry({});
        const { created, duplicates } = await processWikidataItems(
          rawItems,
          connector,
          cache,
        );
        return {
          source: "wikidata",
          fetched: rawItems.length,
          created,
          duplicates,
          errors: [] as string[],
        };
      } catch (error) {
        return {
          source: "wikidata",
          fetched: 0,
          created: 0,
          duplicates: 0,
          errors: [error instanceof Error ? error.message : String(error)],
        };
      }
    });
    results.push(wikidataResult);

    // Log summary
    const durationMs = Date.now() - startTime;
    const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
    const totalDuplicates = results.reduce((sum, r) => sum + r.duplicates, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    await step.run("log-summary", async () => {
      console.info("[SystemB:Daily] Run complete", {
        durationMs,
        totalCreated,
        totalDuplicates,
        totalErrors,
        results,
      });
    });

    return {
      durationMs,
      totalCreated,
      totalDuplicates,
      totalErrors,
      results,
    };
  },
);

/**
 * Process Wikidata items: normalize, deduplicate, and store.
 * Wikidata items have longer deduplication windows (90 days for curiosities).
 */
async function processWikidataItems(
  rawItems: RawFeedItem[],
  connector: {
    normalize: (raw: RawFeedItem) => Promise<ContentFeedItem>;
    name: string;
  },
  cache: IngestionCache,
): Promise<{ created: number; duplicates: number }> {
  let created = 0;
  let duplicates = 0;

  for (const raw of rawItems) {
    try {
      // Normalize the item
      const item = await connector.normalize(raw);

      // Check for duplicates in database (longer window for curiosities)
      const existing = await db
        .select({ id: contentFeedItems.id })
        .from(contentFeedItems)
        .where(
          and(
            eq(contentFeedItems.source, item.source),
            eq(contentFeedItems.sourceId, item.sourceId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        duplicates++;
        continue;
      }

      // Check cache for recent duplicate
      // Use 90 day TTL for curiosities (they have longer cooldown)
      const cacheKey = `dedupe:${item.contentType}:${item.contentHash}`;
      const cached = await cache.get<{ id: string }>(cacheKey);
      if (cached) {
        duplicates++;
        continue;
      }

      // Insert into database
      await db.insert(contentFeedItems).values({
        source: item.source,
        sourceId: item.sourceId,
        sourceUrl: item.sourceUrl,
        contentType: item.contentType,
        title: item.title,
        body: item.body,
        hook: item.hook,
        facts: item.facts,
        images: item.images || [],
        tags: item.tags,
        publishAt: item.publishAt,
        expiresAt: item.expiresAt,
        viralScore: item.viralScore,
        tenantId: item.tenantId,
        isShared: item.isShared,
        contentHash: item.contentHash,
      });

      // Cache with longer TTL for curiosities (7 days for trivia, 3 days for curiosities)
      const ttlSeconds = item.contentType === "trivia" ? 7 * 86400 : 3 * 86400;
      await cache.set(cacheKey, { id: item.sourceId }, ttlSeconds);

      created++;
    } catch (error) {
      console.error(`[SystemB:Daily] Error processing item:`, error);
    }
  }

  return { created, duplicates };
}
