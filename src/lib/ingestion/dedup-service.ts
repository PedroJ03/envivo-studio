/**
 * Deduplication Service - Phase 4.5
 *
 * Main deduplication service that orchestrates all 3 tiers.
 * Handles database queries, deduplication, and conflict resolution.
 */

import type {
  NormalizedEvent,
  ContentFeedItem,
  DedupeResult,
  EventType,
} from "./types";
import {
  checkExactMatch,
  checkHashMatch,
  checkFuzzyMatch,
  checkExactMatchFeed,
  checkHashMatchFeed,
  checkFuzzyMatchFeed,
  DEDUP_WINDOWS,
  FUZZY_THRESHOLDS,
  type FuzzyMatchResult,
} from "./deduplication";
import {
  resolveConflict,
  resolveFeedItemConflict,
  getSourcePriority,
  type ConflictResolutionOptions,
} from "./conflict-resolution";
import { db } from "@/lib/db/client";
import { calendarEvents, contentFeedItems } from "@/lib/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

// ============================================================================
// Result Types
// ============================================================================

export interface DedupServiceResult {
  new: NormalizedEvent[];
  updated: NormalizedEvent[];
  duplicates: DuplicateRecord[];
  errors: DedupError[];
}

export interface DuplicateRecord {
  incomingEvent: NormalizedEvent;
  existingId: string;
  matchType: "exact" | "hash" | "fuzzy";
  confidence: number;
}

export interface DedupError {
  event: NormalizedEvent;
  error: string;
}

export interface DedupServiceOptions {
  exactWindowDays?: number;
  hashWindowDays?: number;
  fuzzyThreshold?: number;
  fuzzyWindowDays?: number;
  resolveConflicts?: boolean;
  conflictOptions?: ConflictResolutionOptions;
  batchSize?: number;
}

// ============================================================================
// Deduplication Service (System A: Calendar Events)
// ============================================================================

/**
 * Main deduplication service for calendar events.
 * Runs all 3 tiers in sequence and returns categorized results.
 */
export class DeduplicationService {
  private readonly exactWindowDays: number;
  private readonly hashWindowDays: number;
  private readonly fuzzyThreshold: number;
  private readonly fuzzyWindowDays: number;
  private readonly resolveConflicts: boolean;
  private readonly conflictOptions: ConflictResolutionOptions;
  private readonly batchSize: number;

  constructor(options: DedupServiceOptions = {}) {
    this.exactWindowDays =
      options.exactWindowDays ?? DEDUP_WINDOWS.CALENDAR_CONCERT;
    this.hashWindowDays =
      options.hashWindowDays ?? DEDUP_WINDOWS.CALENDAR_CONCERT;
    this.fuzzyThreshold =
      options.fuzzyThreshold ?? FUZZY_THRESHOLDS.TITLE_SIMILARITY;
    this.fuzzyWindowDays =
      options.fuzzyWindowDays ?? FUZZY_THRESHOLDS.CONCERT_DATE_WINDOW;
    this.resolveConflicts = options.resolveConflicts ?? true;
    this.conflictOptions = options.conflictOptions ?? {};
    this.batchSize = options.batchSize ?? 100;
  }

  /**
   * Run deduplication against a set of new events.
   *
   * @param tenantId - Tenant ID to scope queries
   * @param newEvents - Array of new events to check
   * @returns Categorized results: new, updated, duplicates
   */
  async runDeduplication(
    tenantId: string,
    newEvents: NormalizedEvent[],
  ): Promise<DedupServiceResult> {
    const result: DedupServiceResult = {
      new: [],
      updated: [],
      duplicates: [],
      errors: [],
    };

    if (newEvents.length === 0) {
      return result;
    }

    // Process in batches for efficiency
    for (let i = 0; i < newEvents.length; i += this.batchSize) {
      const batch = newEvents.slice(i, i + this.batchSize);
      const batchResult = await this.processBatch(tenantId, batch);

      result.new.push(...batchResult.new);
      result.updated.push(...batchResult.updated);
      result.duplicates.push(...batchResult.duplicates);
      result.errors.push(...batchResult.errors);
    }

    return result;
  }

  /**
   * Process a batch of events for deduplication.
   */
  private async processBatch(
    tenantId: string,
    newEvents: NormalizedEvent[],
  ): Promise<DedupServiceResult> {
    const result: DedupServiceResult = {
      new: [],
      updated: [],
      duplicates: [],
      errors: [],
    };

    // Extract date range for efficient query
    const dateRange = this.getDateRange(newEvents);

    // Fetch existing events within the window
    const existingEvents = await this.fetchExistingEvents(
      tenantId,
      dateRange.min,
      dateRange.max,
    );

    if (existingEvents.length === 0) {
      // No existing events - all are new
      result.new = newEvents;
      return result;
    }

    // Process each new event
    for (const newEvent of newEvents) {
      try {
        const dedupResult = await this.checkEvent(existingEvents, newEvent);

        if (dedupResult.isDuplicate && dedupResult.existingId) {
          // Find the existing event
          const existingEvent = existingEvents.find(
            (e) => e.id === dedupResult.existingId,
          );

          if (existingEvent) {
            if (this.resolveConflicts) {
              // Resolve conflict and mark as updated
              const resolved = resolveConflict(
                existingEvent as NormalizedEvent,
                newEvent,
                this.conflictOptions,
              );
              result.updated.push(resolved);
              result.duplicates.push({
                incomingEvent: newEvent,
                existingId: dedupResult.existingId,
                matchType: dedupResult.matchType!,
                confidence: dedupResult.confidence || 0,
              });
            } else {
              // Just record as duplicate
              result.duplicates.push({
                incomingEvent: newEvent,
                existingId: dedupResult.existingId,
                matchType: dedupResult.matchType!,
                confidence: dedupResult.confidence || 0,
              });
            }
          }
        } else {
          // No duplicate found - it's new
          result.new.push(newEvent);
        }
      } catch (error) {
        result.errors.push({
          event: newEvent,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * Check a single event against existing events using all 3 tiers.
   */
  private async checkEvent(
    existingEvents: NormalizedEvent[],
    newEvent: NormalizedEvent,
  ): Promise<DedupeResult> {
    const windowDays = this.getWindowForEventType(newEvent.eventType);

    // Tier 1: Exact match
    const exactResult = checkExactMatch(existingEvents, newEvent, windowDays);
    if (exactResult?.found && exactResult.existingEvent?.id) {
      return {
        isDuplicate: true,
        existingId: exactResult.existingEvent.id,
        matchType: "exact",
        confidence: 1.0,
      };
    }

    // Tier 2: Hash match
    const hashResult = checkHashMatch(existingEvents, newEvent, windowDays);
    if (hashResult?.found && hashResult.existingEvent?.id) {
      return {
        isDuplicate: true,
        existingId: hashResult.existingEvent.id,
        matchType: "hash",
        confidence: hashResult.confidence,
      };
    }

    // Tier 3: Fuzzy match
    const fuzzyResult = checkFuzzyMatch(
      existingEvents,
      newEvent,
      this.fuzzyThreshold,
      this.fuzzyWindowDays,
    );
    if (fuzzyResult?.found && fuzzyResult.existingEvent?.id) {
      return {
        isDuplicate: true,
        existingId: fuzzyResult.existingEvent.id,
        matchType: "fuzzy",
        confidence: fuzzyResult.confidence,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Fetch existing events within a date range.
   */
  private async fetchExistingEvents(
    tenantId: string,
    minDate: Date | null,
    maxDate: Date | null,
  ): Promise<NormalizedEvent[]> {
    try {
      const conditions = [
        // Tenant scope: same tenant or shared
        eq(calendarEvents.tenantId, tenantId),
      ];

      // Add date range if available
      if (minDate) {
        conditions.push(
          gte(calendarEvents.eventDate, minDate.toISOString().split("T")[0]),
        );
      }
      if (maxDate) {
        conditions.push(
          lte(calendarEvents.eventDate, maxDate.toISOString().split("T")[0]),
        );
      }

      const events = await db
        .select()
        .from(calendarEvents)
        .where(and(...conditions))
        .limit(1000);

      // Convert to NormalizedEvent format
      return events.map((row) => ({
        id: row.id,
        source: row.source,
        sourceId: row.sourceId,
        sourceUrl: row.sourceUrl,
        title: row.title,
        description: row.description || undefined,
        eventType: row.eventType as EventType,
        eventDate: row.eventDate, // Already string from DB
        year: row.year || undefined,
        location: row.location as NormalizedEvent["location"],
        artists: row.artists as NormalizedEvent["artists"],
        images: row.images as NormalizedEvent["images"],
        tags: row.tags,
        tenantId: row.tenantId,
        isShared: row.isShared,
        priority: row.priority,
        contentHash: row.contentHash,
        metadata: row.metadata as Record<string, unknown>,
      }));
    } catch (error) {
      console.error(
        "[DeduplicationService] Error fetching existing events:",
        error,
      );
      return [];
    }
  }

  /**
   * Get date range from events for efficient querying.
   */
  private getDateRange(events: NormalizedEvent[]): {
    min: Date | null;
    max: Date | null;
  } {
    if (events.length === 0) {
      return { min: null, max: null };
    }

    let min: Date | null = null;
    let max: Date | null = null;

    for (const event of events) {
      const date = new Date(event.eventDate);
      if (!min || date < min) min = date;
      if (!max || date > max) max = date;
    }

    // Extend range by the window to catch near-duplicates
    if (min) {
      min = new Date(
        min.getTime() - this.fuzzyWindowDays * 24 * 60 * 60 * 1000,
      );
    }
    if (max) {
      max = new Date(
        max.getTime() + this.fuzzyWindowDays * 24 * 60 * 60 * 1000,
      );
    }

    return { min, max };
  }

  /**
   * Get deduplication window for an event type.
   */
  private getWindowForEventType(eventType: EventType): number {
    switch (eventType) {
      case "concert":
        return DEDUP_WINDOWS.CALENDAR_CONCERT;
      case "festival":
        return DEDUP_WINDOWS.CALENDAR_FESTIVAL;
      case "local_event":
        return DEDUP_WINDOWS.CALENDAR_LOCAL_EVENT;
      case "historical":
        return DEDUP_WINDOWS.CALENDAR_HISTORICAL;
      default:
        return this.exactWindowDays;
    }
  }

  /**
   * Apply deduplication results to the database.
   * Inserts new events and updates existing ones.
   */
  async applyResults(results: DedupServiceResult): Promise<{
    inserted: number;
    updated: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let inserted = 0;
    let updated = 0;

    // Insert new events
    for (const event of results.new) {
      try {
        await db.insert(calendarEvents).values({
          source: event.source,
          sourceId: event.sourceId,
          sourceUrl: event.sourceUrl,
          eventType: event.eventType,
          title: event.title,
          description: event.description,
          eventDate: event.eventDate,
          year: event.year,
          location: event.location || {
            city: null,
            region: null,
            country: null,
            venue: null,
          },
          artists: event.artists || [],
          images: event.images || [],
          tags: event.tags || [],
          tenantId: event.tenantId!,
          isShared: event.isShared,
          priority: event.priority,
          contentHash: event.contentHash,
          metadata: event.metadata || {},
        });
        inserted++;
      } catch (error) {
        errors.push(
          `Insert error for ${event.title}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Update existing events
    for (const event of results.updated) {
      if (!event.id) continue;

      try {
        await db
          .update(calendarEvents)
          .set({
            title: event.title,
            description: event.description,
            eventDate: event.eventDate,
            year: event.year,
            location: event.location,
            artists: event.artists,
            images: event.images,
            tags: event.tags,
            priority: event.priority,
            contentHash: event.contentHash,
            metadata: event.metadata,
            updatedAt: new Date(),
          })
          .where(eq(calendarEvents.id, event.id));
        updated++;
      } catch (error) {
        errors.push(
          `Update error for ${event.title} (${event.id}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { inserted, updated, errors };
  }
}

// ============================================================================
// Content Feed Deduplication Service (System B)
// ============================================================================

export interface FeedDedupResult {
  new: ContentFeedItem[];
  updated: ContentFeedItem[];
  duplicates: Array<{
    incomingItem: ContentFeedItem;
    existingId: string;
    matchType: "exact" | "hash" | "fuzzy";
    confidence: number;
  }>;
  errors: Array<{ item: ContentFeedItem; error: string }>;
}

/**
 * Deduplication service for content feed items (System B).
 */
export class FeedDeduplicationService {
  private readonly hashWindowDays: number;
  private readonly fuzzyThreshold: number;
  private readonly fuzzyWindowDays: number;
  private readonly resolveConflicts: boolean;

  constructor(
    options: {
      hashWindowDays?: number;
      fuzzyThreshold?: number;
      fuzzyWindowDays?: number;
      resolveConflicts?: boolean;
    } = {},
  ) {
    this.hashWindowDays = options.hashWindowDays ?? DEDUP_WINDOWS.FEED_TRENDING;
    this.fuzzyThreshold =
      options.fuzzyThreshold ?? FUZZY_THRESHOLDS.TITLE_SIMILARITY;
    this.fuzzyWindowDays =
      options.fuzzyWindowDays ?? DEDUP_WINDOWS.FEED_TRENDING;
    this.resolveConflicts = options.resolveConflicts ?? true;
  }

  /**
   * Run deduplication for content feed items.
   */
  async runDeduplication(
    tenantId: string,
    newItems: ContentFeedItem[],
  ): Promise<FeedDedupResult> {
    const result: FeedDedupResult = {
      new: [],
      updated: [],
      duplicates: [],
      errors: [],
    };

    if (newItems.length === 0) {
      return result;
    }

    // Fetch existing items
    const existingItems = await this.fetchExistingItems(tenantId);

    if (existingItems.length === 0) {
      result.new = newItems;
      return result;
    }

    for (const newItem of newItems) {
      try {
        const dedupResult = await this.checkItem(existingItems, newItem);

        if (dedupResult.isDuplicate && dedupResult.existingId) {
          const existingItem = existingItems.find(
            (e) => e.id === dedupResult.existingId,
          );

          if (existingItem) {
            if (this.resolveConflicts) {
              const resolved = resolveFeedItemConflict(
                existingItem as ContentFeedItem,
                newItem,
              );
              result.updated.push(resolved);
            }
            result.duplicates.push({
              incomingItem: newItem,
              existingId: dedupResult.existingId,
              matchType: dedupResult.matchType!,
              confidence: dedupResult.confidence || 0,
            });
          }
        } else {
          result.new.push(newItem);
        }
      } catch (error) {
        result.errors.push({
          item: newItem,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * Check a single item against existing items.
   */
  private async checkItem(
    existingItems: ContentFeedItem[],
    newItem: ContentFeedItem,
  ): Promise<DedupeResult> {
    // Tier 1: Exact match
    const exactResult = checkExactMatchFeed(existingItems, newItem);
    if (exactResult?.found && exactResult.existingItem?.id) {
      return {
        isDuplicate: true,
        existingId: exactResult.existingItem.id,
        matchType: "exact",
        confidence: 1.0,
      };
    }

    // Tier 2: Hash match
    const hashResult = checkHashMatchFeed(
      existingItems,
      newItem,
      this.hashWindowDays,
    );
    if (hashResult?.found && hashResult.existingItem?.id) {
      return {
        isDuplicate: true,
        existingId: hashResult.existingItem.id,
        matchType: "hash",
        confidence: hashResult.confidence,
      };
    }

    // Tier 3: Fuzzy match
    const fuzzyResult = checkFuzzyMatchFeed(
      existingItems,
      newItem,
      this.fuzzyThreshold,
      this.fuzzyWindowDays,
    );
    if (fuzzyResult?.found && fuzzyResult.existingItem?.id) {
      return {
        isDuplicate: true,
        existingId: fuzzyResult.existingItem.id,
        matchType: "fuzzy",
        confidence: fuzzyResult.confidence,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Fetch existing content feed items for a tenant.
   */
  private async fetchExistingItems(
    tenantId: string,
  ): Promise<ContentFeedItem[]> {
    try {
      const items = await db
        .select()
        .from(contentFeedItems)
        .where(eq(contentFeedItems.tenantId, tenantId))
        .limit(1000);

      return items.map((row) => ({
        id: row.id,
        source: row.source,
        sourceId: row.sourceId,
        sourceUrl: row.sourceUrl || "",
        title: row.title,
        body: row.body,
        hook: row.hook,
        facts: row.facts as ContentFeedItem["facts"],
        contentType: row.contentType as ContentFeedItem["contentType"],
        images: row.images as ContentFeedItem["images"],
        tags: row.tags,
        tenantId: row.tenantId,
        isShared: row.isShared,
        priority: 2, // Default
        contentHash: row.contentHash,
        publishAt: row.publishAt, // Date from timestamp column
        expiresAt: row.expiresAt || undefined, // Date from timestamp column
        viralScore: row.viralScore,
        metadata: {}, // No metadata column in schema, use empty object
      }));
    } catch (error) {
      console.error(
        "[FeedDeduplicationService] Error fetching existing items:",
        error,
      );
      return [];
    }
  }
}

// ============================================================================
// Logging Utilities
// ============================================================================

export interface DedupLogEntry {
  timestamp: string;
  action: "checked" | "new" | "duplicate" | "updated" | "error";
  source: string;
  sourceId: string;
  title: string;
  matchType?: "exact" | "hash" | "fuzzy";
  confidence?: number;
  existingId?: string;
  error?: string;
}

/**
 * Logger for deduplication decisions.
 */
export class DedupLogger {
  private logs: DedupLogEntry[] = [];

  log(entry: DedupLogEntry): void {
    this.logs.push({
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    });
  }

  logChecked(event: NormalizedEvent): void {
    this.log({
      timestamp: new Date().toISOString(),
      action: "checked",
      source: event.source,
      sourceId: event.sourceId,
      title: event.title,
    });
  }

  logNew(event: NormalizedEvent): void {
    this.log({
      timestamp: new Date().toISOString(),
      action: "new",
      source: event.source,
      sourceId: event.sourceId,
      title: event.title,
    });
  }

  logDuplicate(
    event: NormalizedEvent,
    existingId: string,
    matchType: "exact" | "hash" | "fuzzy",
    confidence: number,
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      action: "duplicate",
      source: event.source,
      sourceId: event.sourceId,
      title: event.title,
      matchType,
      confidence,
      existingId,
    });
  }

  logUpdated(event: NormalizedEvent): void {
    this.log({
      timestamp: new Date().toISOString(),
      action: "updated",
      source: event.source,
      sourceId: event.sourceId,
      title: event.title,
    });
  }

  logError(event: NormalizedEvent, error: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      action: "error",
      source: event.source,
      sourceId: event.sourceId,
      title: event.title,
      error,
    });
  }

  getLogs(): DedupLogEntry[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }

  /**
   * Export logs in JSON format for debugging.
   */
  toJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}
