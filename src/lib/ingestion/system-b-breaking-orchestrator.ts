/**
 * System B Breaking News Orchestrator
 *
 * Coordinates breaking news sources (NewsAPI, GNews, Rolling Stone).
 * Runs every 30 minutes to fetch breaking and trending news.
 */

import { inngestClient } from "@/inngest/client";
import { db } from "@/lib/db/client";
import { contentFeedItems } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createNewsAPIConnector } from "./sources/newsapi";
import { createGNewsConnector } from "./sources/gnews";
import { createRollingStoneConnector } from "./sources/rolling-stone";
import type { ContentFeedItem, RawFeedItem } from "./types";
import { IngestionCache } from "./cache";

/**
 * System B Breaking News Function
 * Runs every 30 minutes to poll breaking news sources.
 */
export const systemBBreakingFunction = inngestClient.createFunction(
  {
    id: "system-b-breaking-news",
    name: "System B: Breaking News Poll",
    // Run every 30 minutes
    triggers: [{ cron: "*/30 * * * *" }],
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

    // Fetch from NewsAPI
    const newsapiResult = await step.run("fetch-newsapi", async () => {
      try {
        const connector = createNewsAPIConnector(
          process.env.NEWSAPI_KEY || "",
          cache,
        );
        const rawItems = await connector.fetchWithRetry({});
        const { created, duplicates } = await processItems(
          rawItems,
          connector,
          cache,
        );
        return {
          source: "newsapi",
          fetched: rawItems.length,
          created,
          duplicates,
          errors: [] as string[],
        };
      } catch (error) {
        return {
          source: "newsapi",
          fetched: 0,
          created: 0,
          duplicates: 0,
          errors: [error instanceof Error ? error.message : String(error)],
        };
      }
    });
    results.push(newsapiResult);

    // Fetch from GNews
    const gnewsResult = await step.run("fetch-gnews", async () => {
      try {
        const connector = createGNewsConnector(
          process.env.GNEWS_API_KEY || "",
          cache,
        );
        const rawItems = await connector.fetchWithRetry({});
        const { created, duplicates } = await processItems(
          rawItems,
          connector,
          cache,
        );
        return {
          source: "gnews",
          fetched: rawItems.length,
          created,
          duplicates,
          errors: [] as string[],
        };
      } catch (error) {
        return {
          source: "gnews",
          fetched: 0,
          created: 0,
          duplicates: 0,
          errors: [error instanceof Error ? error.message : String(error)],
        };
      }
    });
    results.push(gnewsResult);

    // Fetch from Rolling Stone
    const rollingstoneResult = await step.run(
      "fetch-rollingstone",
      async () => {
        try {
          const connector = createRollingStoneConnector(cache);
          const rawItems = await connector.fetchWithRetry({});
          const { created, duplicates } = await processItems(
            rawItems,
            connector,
            cache,
          );
          return {
            source: "rollingstone",
            fetched: rawItems.length,
            created,
            duplicates,
            errors: [] as string[],
          };
        } catch (error) {
          return {
            source: "rollingstone",
            fetched: 0,
            created: 0,
            duplicates: 0,
            errors: [error instanceof Error ? error.message : String(error)],
          };
        }
      },
    );
    results.push(rollingstoneResult);

    // Log summary
    const durationMs = Date.now() - startTime;
    const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
    const totalDuplicates = results.reduce((sum, r) => sum + r.duplicates, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    await step.run("log-summary", async () => {
      console.info("[SystemB:Breaking] Run complete", {
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
 * Process raw items: normalize, deduplicate, and store.
 */
async function processItems(
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

      // Check for duplicates in database
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
      const cacheKey = `dedupe:${item.contentHash}`;
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

      // Cache the hash to prevent duplicates
      await cache.set(cacheKey, { id: item.sourceId }, 86400); // 24 hours

      created++;
    } catch (error) {
      console.error(`[SystemB:Breaking] Error processing item:`, error);
    }
  }

  return { created, duplicates };
}
