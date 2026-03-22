import { db } from "@/lib/db/client";
import {
  topicSelections,
  candidateContent,
  sections,
  sources,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { inngestClient } from "@/inngest/client";
import { isGenerationEnabled } from "./config";
import { createMappingResult } from "./mappers";
import { SourceNotFoundError } from "./errors";
import type { GenerationResult, SourceData } from "./types";
import { calendarEvents, contentFeedItems } from "@/lib/db/schema";

/**
 * Main entry point for content generation from a topic selection.
 *
 * Flow:
 * 1. Check feature flag
 * 2. Validate topic selection exists
 * 3. Check idempotency (if status is "ready", return existing candidates)
 * 4. Create candidate_content records in a transaction
 * 5. Emit Inngest event for async processing
 * 6. Return result with status "generating"
 */
export async function generateContentFromSelection(
  selectionId: string,
  options?: { emitEvent?: boolean },
): Promise<GenerationResult> {
  // 1. Check feature flag
  if (!isGenerationEnabled()) {
    return {
      selectionId,
      candidates: [],
      status: "failed",
    };
  }

  // 2. Fetch topic selection
  const [selection] = await db
    .select()
    .from(topicSelections)
    .where(eq(topicSelections.id, selectionId))
    .limit(1);

  if (!selection) {
    throw new Error(`Topic selection not found: ${selectionId}`);
  }

  // 3. Idempotency check - if already ready, return existing
  if (selection.status === "ready") {
    const existing = await db
      .select()
      .from(candidateContent)
      .where(eq(candidateContent.sourceId, selection.sourceId));

    return {
      selectionId,
      candidates: existing.map((c) => ({
        candidateId: c.id,
        format:
          c.selectedFormat as GenerationResult["candidates"][number]["format"],
        status: "existing" as const,
      })),
      status: "ready",
    };
  }

  // 4. Fetch source data for title/description
  const sourceData = await fetchSourceData(
    selection.sourceType,
    selection.sourceId,
  );

  // 5. Create candidates in transaction
  const candidates = await db.transaction(async (tx) => {
    const created: Array<{ id: string; format: string }> = [];

    for (const format of selection.formats) {
      const mapping = createMappingResult(
        selection.sourceType,
        format.type,
        format.tone,
      );

      // Find section by slug
      const [section] = await tx
        .select()
        .from(sections)
        .where(
          and(
            eq(sections.tenantId, selection.tenantId),
            eq(sections.slug, mapping.section),
          ),
        )
        .limit(1);

      // Look up the source record to get the correct sourceId
      let actualSourceId = selection.sourceId;
      if (sourceData.sourceSlug) {
        const [sourceRecord] = await tx
          .select()
          .from(sources)
          .where(eq(sources.slug, sourceData.sourceSlug))
          .limit(1);
        if (sourceRecord) {
          actualSourceId = sourceRecord.id;
        }
      }

      // Create candidate content
      const [candidate] = await tx
        .insert(candidateContent)
        .values({
          tenantId: selection.tenantId,
          sourceId: actualSourceId,
          sectionId: section?.id,
          templateId: mapping.template,
          templateVariant: "classic",
          status: "candidate",
          title: sourceData.title,
          selectedFormat: format.type,
          selectedTone: format.tone,
          summaryJson: {
            description: sourceData.description,
            imageUrl: sourceData.imageUrl,
            eventDate: sourceData.eventDate,
            venue: sourceData.venue,
            artists: sourceData.artists,
          },
        })
        .returning();

      created.push({ id: candidate.id, format: format.type });
    }

    // Update selection status to generating
    await tx
      .update(topicSelections)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(topicSelections.id, selectionId));

    return created;
  });

  // 6. Emit Inngest event for async processing
  if (options?.emitEvent !== false) {
    await inngestClient.send({
      name: "topic/selected",
      data: {
        selectionId,
        tenantId: selection.tenantId,
        sourceType: selection.sourceType,
        sourceId: selection.sourceId,
        formats: selection.formats,
        createdAt: selection.createdAt.toISOString(),
      },
    });
  }

  return {
    selectionId,
    candidates: candidates.map((c) => ({
      candidateId: c.id,
      format: c.format as GenerationResult["candidates"][number]["format"],
      status: "created",
    })),
    status: "generating",
  };
}

/**
 * Fetch source data from calendar_events or content_feed_items.
 */
async function fetchSourceData(
  sourceType: "calendar_event" | "content_feed_item",
  sourceId: string,
): Promise<SourceData> {
  if (sourceType === "calendar_event") {
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, sourceId))
      .limit(1);

    if (!event) {
      throw new SourceNotFoundError(sourceType, sourceId);
    }

    return {
      id: event.id,
      title: event.title,
      description: event.description || undefined,
      imageUrl: event.images[0]?.url,
      eventDate: event.eventDate,
      venue: event.location.venue || undefined,
      artists: event.artists.map((a) => a.name),
      sourceType,
    };
  } else {
    const [item] = await db
      .select()
      .from(contentFeedItems)
      .where(eq(contentFeedItems.id, sourceId))
      .limit(1);

    if (!item) {
      throw new SourceNotFoundError(sourceType, sourceId);
    }

    return {
      id: item.id,
      title: item.title,
      description: item.body || undefined,
      imageUrl: item.images[0]?.url,
      sourceType,
      sourceSlug: item.source, // Add source slug for looking up the source record
    };
  }
}
