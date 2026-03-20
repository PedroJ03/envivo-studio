import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { withTenantDb } from "@/lib/db/client";
import {
  candidateContent,
  contentStates,
  events,
  photos,
  sources,
} from "@/lib/db/schema";
import { tenantFilter } from "@/lib/db/tenant";
import {
  extractEventFromUrl,
  normalizePhotoDimensions,
  normalizeScrapedDate,
  type ScrapedEvent,
} from "@/lib/scraper/extract";
import { inngestClient } from "@/inngest/client";

const scrapeEventInputSchema = z.object({
  tenantId: z.string().min(1),
  eventId: z.string().min(1),
  sourceUrl: z.string().url().optional(),
});

function parseScrapeDate(dateText: string): Date | null {
  return normalizeScrapedDate(dateText);
}

function toIntDimension(value: unknown): number {
  return typeof value === "number" ? normalizePhotoDimensions(value) : 0;
}

function candidateSummaryFromScrape(input: {
  eventName: string;
  venue: string;
  date: string | null;
  sourceUrl: string;
}) {
  return {
    name: input.eventName,
    summary_json: {
      sourceUrl: input.sourceUrl,
      venue: input.venue,
      date: input.date,
    },
    metadata_json: {
      extractionSource: "scrape",
      sourceUrl: input.sourceUrl,
    },
  };
}

export const scrapeEventFunction = inngestClient.createFunction(
  {
    id: "scrape-event",
    triggers: [{ event: "event/scrape.requested" }],
  },
  async ({ event }) => {
    const input = scrapeEventInputSchema.parse(event.data);

    return withTenantDb(input.tenantId, async (tx) => {
      const [eventRecord] = await tx
        .select({
          id: events.id,
          sourceId: events.sourceId,
          tenantSourceUrl: sources.sourceUrl,
        })
        .from(events)
        .innerJoin(sources, eq(events.sourceId, sources.id))
        .where(and(eq(events.id, input.eventId), tenantFilter(events.tenantId)));

      if (!eventRecord) {
        throw new Error(`Event ${input.eventId} not found for tenant ${input.tenantId}.`);
      }

      const sourceUrl = input.sourceUrl ?? eventRecord.tenantSourceUrl;
      if (!sourceUrl) {
        throw new Error(`Cannot scrape event ${input.eventId}: source URL not configured.`);
      }

      const extracted: ScrapedEvent = await extractEventFromUrl({
        sourceUrl,
      });

      const scrapeDate = parseScrapeDate(extracted.date);

      await tx
        .update(events)
        .set({
          title: extracted.name,
          venue: extracted.venue,
          ...(scrapeDate ? { eventDate: scrapeDate } : {}),
        })
        .where(eq(events.id, input.eventId));

      const source = candidateSummaryFromScrape({
        eventName: extracted.name,
        venue: extracted.venue,
        date: extracted.date,
        sourceUrl,
      });

      const candidates = await Promise.all(
        extracted.photos.map(async (photo) => {
          const [photoRecord] = await tx
            .insert(photos)
            .values({
              tenantId: input.tenantId,
              eventId: input.eventId,
              sourceId: eventRecord.sourceId,
              originalUrl: photo.url,
              storageKey: photo.source ?? photo.url,
              width: toIntDimension(photo.width),
              height: toIntDimension(photo.height),
              metadataJson: {
                extractedAlt: photo.altText ?? null,
                source: photo.source,
              },
            })
            .returning({ id: photos.id, width: photos.width, height: photos.height });

          const [candidateRecord] = await tx
            .insert(candidateContent)
            .values({
              tenantId: input.tenantId,
              sourceId: eventRecord.sourceId,
              eventId: input.eventId,
              photoId: photoRecord.id,
              title: source.name,
              summaryJson: {
                ...source.summary_json,
                photoId: photoRecord.id,
                extractedAt: new Date().toISOString(),
              },
            })
            .returning({ id: candidateContent.id });

          await tx.insert(contentStates).values({
            tenantId: input.tenantId,
            candidateContentId: candidateRecord.id,
            state: "draft",
            actor: "scrape-worker",
            metadataJson: {
              operation: "scrape-event",
              sourceUrl,
            },
          });

          return {
            candidateId: candidateRecord.id,
            photoId: photoRecord.id,
            width: photoRecord.width,
            height: photoRecord.height,
          };
        }),
      );

      return {
        eventId: input.eventId,
        createdCandidateCount: candidates.length,
        createdPhotoCount: candidates.length,
        candidateIds: candidates.map((candidate) => candidate.candidateId),
      };
    });
  },
);
