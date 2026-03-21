/**
 * Database queries for Topic Selection feature
 * These functions handle all database operations for pending topics, selections, and discards
 */

import { and, eq, desc, sql, notExists, or } from "drizzle-orm";
import { db, withTenantDb } from "@/lib/db/client";
import {
  calendarEvents,
  contentFeedItems,
  topicSelections,
} from "@/lib/db/schema";
import type {
  PendingTopic,
  TopicSelection,
  CreateSelectionInput,
  FilterOptions,
  PendingTopicsParams,
  PendingTopicsResponse,
  SelectionStatus,
  SourceType,
  FormatConfig,
  Urgency,
} from "./types";

// Note: The topicSelections table and enums are defined in schema.ts
// Phase 1 (migration + schema) must be applied before using these queries

/**
 * Get pending topics from both calendar_events and content_feed_items
 * Excludes topics that have already been selected or discarded by the tenant
 *
 * @param tenantId - The tenant's UUID
 * @param params - Filter and pagination options
 * @returns PendingTopicsResponse with topics, total count, and pagination info
 */
export async function getPendingTopics(
  tenantId: string,
  params: PendingTopicsParams,
): Promise<PendingTopicsResponse> {
  const { source, type, dateFrom, dateTo, page, limit } = params;
  const offset = (page - 1) * limit;

  // Build filter conditions for calendar events
  const calendarConditions: ReturnType<typeof eq>[] = [];

  // Source filter for calendar events
  if (source) {
    calendarConditions.push(eq(calendarEvents.source, source));
  }

  // Date range filters
  if (dateFrom) {
    calendarConditions.push(sql`${calendarEvents.eventDate} >= ${dateFrom}`);
  }
  if (dateTo) {
    calendarConditions.push(sql`${calendarEvents.eventDate} <= ${dateTo}`);
  }

  // Tenant filter (include shared content)
  calendarConditions.push(
    or(
      eq(calendarEvents.tenantId, tenantId),
      eq(calendarEvents.isShared, true),
    ) as ReturnType<typeof eq>,
  );

  // Build filter conditions for content feed items
  const feedConditions: ReturnType<typeof eq>[] = [];

  // Source filter for feed items
  if (source) {
    feedConditions.push(eq(contentFeedItems.source, source));
  }

  // Date range filters
  if (dateFrom) {
    feedConditions.push(sql`${contentFeedItems.publishAt} >= ${dateFrom}`);
  }
  if (dateTo) {
    feedConditions.push(sql`${contentFeedItems.publishAt} <= ${dateTo}`);
  }

  // Tenant filter (include shared content)
  feedConditions.push(
    or(
      eq(contentFeedItems.tenantId, tenantId),
      eq(contentFeedItems.isShared, true),
    ) as ReturnType<typeof eq>,
  );

  let topics: PendingTopic[] = [];
  let total = 0;

  // Execute queries based on type filter
  if (type === "calendar_event" || type === "all") {
    // Calendar events query
    const calendarQuery = db
      .select({
        id: calendarEvents.id,
        sourceType: sql<string>`'calendar_event'`.as("source_type"),
        source: calendarEvents.source,
        title: calendarEvents.title,
        description: calendarEvents.description,
        date: calendarEvents.eventDate,
        type: calendarEvents.eventType,
        priority: calendarEvents.priority,
        image: sql<string>`(${calendarEvents.images}->0->>'url')`.as("image"),
        tags: calendarEvents.tags,
        isShared: calendarEvents.isShared,
      })
      .from(calendarEvents)
      .where(and(...calendarConditions));

    const calendarResults = await calendarQuery;
    topics = calendarResults as unknown as PendingTopic[];
    total += topics.length;
  }

  if (type === "content_feed_item" || type === "all") {
    // Content feed items query
    const feedResults = await db
      .select({
        id: contentFeedItems.id,
        sourceType: sql<string>`'content_feed_item'`.as("source_type"),
        source: contentFeedItems.source,
        title: contentFeedItems.title,
        description: sql<string>`LEFT(${contentFeedItems.body}, 200)`.as(
          "description",
        ),
        date: contentFeedItems.publishAt,
        type: contentFeedItems.contentType,
        priority: contentFeedItems.viralScore,
        image: sql<string>`(${contentFeedItems.images}->0->>'url')`.as("image"),
        tags: contentFeedItems.tags,
        isShared: contentFeedItems.isShared,
      })
      .from(contentFeedItems)
      .where(and(...feedConditions));

    const feedTopics = feedResults as unknown as PendingTopic[];
    topics = [...topics, ...feedTopics];
    total += feedTopics.length;
  }

  // Sort by priority DESC, date ASC and apply pagination
  topics.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const paginatedTopics = topics.slice(offset, offset + limit);

  return {
    topics: paginatedTopics,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Create a new topic selection
 * Throws an error if the topic is already selected (409 Conflict)
 *
 * @param tenantId - The tenant's UUID
 * @param userId - The operator's UUID who is making the selection
 * @param input - Selection details including source, formats, urgency
 * @returns Object with selectionId and status
 */
export async function createTopicSelection(
  tenantId: string,
  userId: string,
  input: CreateSelectionInput,
): Promise<{ selectionId: string; status: SelectionStatus }> {
  return withTenantDb(tenantId, async (tx) => {
    try {
      const [result] = await tx
        .insert(topicSelections)
        .values({
          tenantId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          formats: input.formats as FormatConfig[],
          targetPublishAt: input.targetPublishAt
            ? new Date(input.targetPublishAt)
            : null,
          urgency: input.urgency ?? "medium",
          status: "pending",
          createdBy: userId,
          metadata: input.metadata ?? {},
        })
        .returning({
          selectionId: topicSelections.id,
          status: topicSelections.status,
        });

      if (!result) {
        throw new Error("Failed to create selection - no result returned");
      }

      return {
        selectionId: result.selectionId as string,
        status: result.status as SelectionStatus,
      };
    } catch (error: any) {
      // Check for unique constraint violation (Postgres error code 23505)
      if (error?.code === "23505") {
        const err = new Error("Topic already selected");
        err.name = "DuplicateSelection";
        throw err;
      }
      throw error;
    }
  });
}

/**
 * Discard a topic by creating/updating a topic_selection record with status='discarded'
 * If the topic was already selected, updates the status to 'discarded'
 * If not yet selected, creates a new record with status='discarded'
 *
 * @param tenantId - The tenant's UUID
 * @param userId - The operator's UUID who is discarding
 * @param sourceType - Either 'calendar_event' or 'content_feed_item'
 * @param sourceId - The UUID of the source topic
 * @returns Object with selectionId and status
 */
export async function discardTopicSelection(
  tenantId: string,
  userId: string,
  sourceType: SourceType,
  sourceId: string,
): Promise<{ selectionId: string; status: SelectionStatus }> {
  return withTenantDb(tenantId, async (tx) => {
    // Check if a selection already exists for this topic
    const existing = await tx
      .select({
        id: topicSelections.id,
      })
      .from(topicSelections)
      .where(
        and(
          eq(topicSelections.tenantId, tenantId),
          eq(topicSelections.sourceType, sourceType),
          eq(topicSelections.sourceId, sourceId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing record to discarded status
      const [result] = await tx
        .update(topicSelections)
        .set({
          status: "discarded",
          updatedAt: new Date(),
        })
        .where(eq(topicSelections.id, existing[0].id))
        .returning({
          selectionId: topicSelections.id,
          status: topicSelections.status,
        });

      return {
        selectionId: result.selectionId as string,
        status: result.status as SelectionStatus,
      };
    }

    // Create new record as discarded
    const [result] = await tx
      .insert(topicSelections)
      .values({
        tenantId,
        sourceType,
        sourceId,
        formats: [],
        urgency: "low",
        status: "discarded",
        createdBy: userId,
      })
      .returning({
        selectionId: topicSelections.id,
        status: topicSelections.status,
      });

    return {
      selectionId: result.selectionId as string,
      status: result.status as SelectionStatus,
    };
  });
}

/**
 * List topic selections for a tenant with optional status filter
 *
 * @param tenantId - The tenant's UUID
 * @param status - Optional status filter
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns SelectionsResponse with selections array and pagination info
 */
export async function getTopicSelections(
  tenantId: string,
  status?: SelectionStatus,
  page: number = 1,
  limit: number = 20,
): Promise<{
  selections: TopicSelection[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  return withTenantDb(tenantId, async (tx) => {
    const offset = (page - 1) * limit;

    const conditions = [eq(topicSelections.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(topicSelections.status, status));
    }

    // Get total count
    const countResult = await tx
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(topicSelections)
      .where(and(...conditions));

    const total = Number(countResult[0]?.count) || 0;

    // Get selections with pagination
    const selectionsRaw = await tx
      .select({
        id: topicSelections.id,
        tenantId: topicSelections.tenantId,
        sourceType: topicSelections.sourceType,
        sourceId: topicSelections.sourceId,
        formats: topicSelections.formats,
        targetPublishAt: topicSelections.targetPublishAt,
        urgency: topicSelections.urgency,
        status: topicSelections.status,
        createdBy: topicSelections.createdBy,
        createdAt: topicSelections.createdAt,
        updatedAt: topicSelections.updatedAt,
        metadata: topicSelections.metadata,
      })
      .from(topicSelections)
      .where(and(...conditions))
      .orderBy(desc(topicSelections.createdAt))
      .limit(limit)
      .offset(offset);

    // Transform dates to ISO strings
    const selections: TopicSelection[] = selectionsRaw.map((s) => ({
      id: s.id as string,
      tenantId: s.tenantId as string,
      sourceType: s.sourceType as SourceType,
      sourceId: s.sourceId as string,
      formats: (s.formats || []) as FormatConfig[],
      targetPublishAt: s.targetPublishAt
        ? new Date(s.targetPublishAt).toISOString()
        : undefined,
      urgency: s.urgency as Urgency,
      status: s.status as SelectionStatus,
      createdBy: s.createdBy as string,
      createdAt: new Date(s.createdAt).toISOString(),
      updatedAt: new Date(s.updatedAt).toISOString(),
      metadata: (s.metadata as Record<string, unknown>) || undefined,
    }));

    return {
      selections,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  });
}

/**
 * Check if a topic has already been selected by the tenant
 * Used for pre-validation before creating a selection
 *
 * @param tenantId - The tenant's UUID
 * @param sourceType - Either 'calendar_event' or 'content_feed_item'
 * @param sourceId - The UUID of the source topic
 * @returns True if already selected (pending, generating, or ready), false otherwise
 */
export async function checkDuplicateSelection(
  tenantId: string,
  sourceType: SourceType,
  sourceId: string,
): Promise<boolean> {
  const result = await db
    .select({ id: topicSelections.id })
    .from(topicSelections)
    .where(
      and(
        eq(topicSelections.tenantId, tenantId),
        eq(topicSelections.sourceType, sourceType),
        eq(topicSelections.sourceId, sourceId),
        or(
          eq(topicSelections.status, "pending"),
          eq(topicSelections.status, "generating"),
          eq(topicSelections.status, "ready"),
        ),
      ),
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Restore a discarded topic selection back to pending status
 *
 * @param tenantId - The tenant's UUID
 * @param selectionId - The UUID of the selection to restore
 * @returns Object with selectionId and new status
 */
export async function restoreTopicSelection(
  tenantId: string,
  selectionId: string,
): Promise<{ selectionId: string; status: SelectionStatus }> {
  return withTenantDb(tenantId, async (tx) => {
    const [result] = await tx
      .update(topicSelections)
      .set({
        status: "pending",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(topicSelections.id, selectionId),
          eq(topicSelections.tenantId, tenantId),
          eq(topicSelections.status, "discarded"),
        ),
      )
      .returning({
        selectionId: topicSelections.id,
        status: topicSelections.status,
      });

    if (!result) {
      throw new Error("Selection not found or not in discarded status");
    }

    return {
      selectionId: result.selectionId as string,
      status: result.status as SelectionStatus,
    };
  });
}
