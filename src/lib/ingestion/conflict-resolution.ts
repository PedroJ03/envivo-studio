/**
 * Conflict Resolution - Phase 4.4
 *
 * Resolves conflicts when the same event is found from multiple sources.
 * Uses source priority ranking and field-level merge strategies.
 */

import type { NormalizedEvent, ContentFeedItem, Image } from "./types";
import {
  normalizeForHash,
  normalizeVenueName,
  normalizeArtistName,
} from "./deduplication-base";

// ============================================================================
// Source Priority Configuration
// ============================================================================

/**
 * Source priority ranking (lower number = higher priority).
 * Used when resolving conflicts between sources.
 */
export const SOURCE_PRIORITY: Record<string, number> = {
  // System A: Calendar Events
  ticketmaster: 1,
  eventbrite: 2,
  wikimedia: 3,
  rss: 4,
  tandil_municipio: 5,
  eldiario_rss: 6,

  // System B: Content Feed
  newsapi: 1,
  gnews: 2,
  billboard: 3,
  rollingstone: 4,
  wikidata: 5,
  indiehoy: 6,

  // Generic
  scraper: 10,
  unknown: 99,
};

/**
 * Get the priority for a source (lower = higher priority).
 */
export function getSourcePriority(source: string): number {
  return SOURCE_PRIORITY[source.toLowerCase()] ?? SOURCE_PRIORITY.unknown;
}

/**
 * Check if source A has higher priority than source B.
 */
export function hasHigherPriority(sourceA: string, sourceB: string): boolean {
  return getSourcePriority(sourceA) < getSourcePriority(sourceB);
}

// ============================================================================
// Merge History Tracking
// ============================================================================

export interface MergeHistoryEntry {
  timestamp: string;
  source: string;
  sourceId: string;
  action: "created" | "updated" | "merged";
  mergedFrom?: string[];
  fieldsChanged?: string[];
}

export interface MergeHistory {
  createdAt: string;
  lastMergedAt: string;
  mergeCount: number;
  entries: MergeHistoryEntry[];
}

// ============================================================================
// Conflict Resolution
// ============================================================================

export interface ConflictResolutionOptions {
  preferHigherPriorityImages?: boolean;
  trackMergeHistory?: boolean;
  preserveExistingMetadata?: boolean;
}

/**
 * Resolve conflict between existing and incoming events.
 * Uses source priority and merge strategies.
 *
 * @param existing - The existing event from database
 * @param incoming - The incoming event from a source
 * @param options - Resolution options
 * @returns The resolved event with merged fields
 */
export function resolveConflict(
  existing: NormalizedEvent,
  incoming: NormalizedEvent,
  options: ConflictResolutionOptions = {},
): NormalizedEvent {
  const {
    preferHigherPriorityImages = true,
    trackMergeHistory = true,
    preserveExistingMetadata = true,
  } = options;

  // Determine which source has higher priority
  const incomingHasPriority = hasHigherPriority(
    incoming.source,
    existing.source,
  );

  // Start with existing event as base
  const resolved: NormalizedEvent = { ...existing };

  // Track merge history
  const mergeHistory: MergeHistory = (resolved.metadata
    ?.mergeHistory as MergeHistory) || {
    createdAt: new Date().toISOString(),
    lastMergedAt: new Date().toISOString(),
    mergeCount: 0,
    entries: [],
  };

  const fieldsChanged: string[] = [];

  // Merge non-null fields from incoming if it has higher priority
  // or if existing field is null/undefined
  if (incomingHasPriority) {
    // Title - prefer higher priority source
    if (incoming.title && incoming.title !== existing.title) {
      resolved.title = incoming.title;
      fieldsChanged.push("title");
    }

    // Description - prefer longer/more complete
    if (
      !existing.description ||
      (incoming.description &&
        incoming.description.length > existing.description.length)
    ) {
      if (incoming.description !== existing.description) {
        resolved.description = incoming.description;
        fieldsChanged.push("description");
      }
    }

    // Event date - keep existing unless incoming has specific date and existing doesn't
    // (don't change event dates - they're usually correct)
    // Only update if existing doesn't have a date
    if (!existing.eventDate && incoming.eventDate) {
      resolved.eventDate = incoming.eventDate;
      fieldsChanged.push("eventDate");
    }

    // Year (for historical events)
    if (incoming.year && incoming.year !== existing.year) {
      resolved.year = incoming.year;
      fieldsChanged.push("year");
    }
  }

  // Location - merge individual fields
  if (incoming.location) {
    const mergedLocation = { ...existing.location };
    let locationChanged = false;

    if (incoming.location.city && !existing.location?.city) {
      mergedLocation.city = incoming.location.city;
      locationChanged = true;
    }
    if (incoming.location.region && !existing.location?.region) {
      mergedLocation.region = incoming.location.region;
      locationChanged = true;
    }
    if (incoming.location.country && !existing.location?.country) {
      mergedLocation.country = incoming.location.country;
      locationChanged = true;
    }
    if (incoming.location.venue && !existing.location?.venue) {
      mergedLocation.venue = incoming.location.venue;
      locationChanged = true;
    }

    if (locationChanged) {
      resolved.location = mergedLocation;
      fieldsChanged.push("location");
    }
  }

  // Artists - merge artist lists
  if (incoming.artists && incoming.artists.length > 0) {
    const existingArtistNames = new Set(
      (existing.artists || []).map((a) => normalizeArtistName(a.name)),
    );
    const newArtists = incoming.artists.filter(
      (a) => !existingArtistNames.has(normalizeArtistName(a.name)),
    );

    if (newArtists.length > 0) {
      resolved.artists = [...(existing.artists || []), ...newArtists];
      fieldsChanged.push("artists");
    }
  }

  // Images - merge with priority preference
  if (incoming.images && incoming.images.length > 0) {
    const existingImages = existing.images || [];
    const existingUrls = new Set(existingImages.map((img) => img.url));

    // Add new images that don't already exist
    const newImages = incoming.images.filter(
      (img) => !existingUrls.has(img.url),
    );

    if (newImages.length > 0) {
      if (preferHigherPriorityImages && incomingHasPriority) {
        // Prepend higher priority images
        resolved.images = [...newImages, ...existingImages];
      } else {
        // Append lower priority images
        resolved.images = [...existingImages, ...newImages];
      }
      fieldsChanged.push("images");
    }
  }

  // Tags - merge unique tags
  if (incoming.tags && incoming.tags.length > 0) {
    const existingTags = new Set(existing.tags || []);
    const newTags = incoming.tags.filter((tag) => !existingTags.has(tag));

    if (newTags.length > 0) {
      resolved.tags = [...(existing.tags || []), ...newTags];
      fieldsChanged.push("tags");
    }
  }

  // Priority - keep higher priority (lower number)
  if (incoming.priority < existing.priority) {
    resolved.priority = incoming.priority;
    fieldsChanged.push("priority");
  }

  // Source URL - prefer higher priority source
  if (
    incomingHasPriority &&
    incoming.sourceUrl &&
    incoming.sourceUrl !== existing.sourceUrl
  ) {
    resolved.sourceUrl = incoming.sourceUrl;
    fieldsChanged.push("sourceUrl");
  }

  // Content hash - keep the one from higher priority source if they're different
  if (incomingHasPriority && incoming.contentHash !== existing.contentHash) {
    resolved.contentHash = incoming.contentHash;
    fieldsChanged.push("contentHash");
  }

  // Metadata merge
  if (!preserveExistingMetadata || !existing.metadata) {
    resolved.metadata = {
      ...incoming.metadata,
      ...(preserveExistingMetadata ? existing.metadata : {}),
    };
  } else {
    // Deep merge metadata, prefer incoming for same keys
    resolved.metadata = {
      ...existing.metadata,
      ...incoming.metadata,
    };
  }

  // Track merge history
  if (trackMergeHistory && fieldsChanged.length > 0) {
    mergeHistory.lastMergedAt = new Date().toISOString();
    mergeHistory.mergeCount++;
    mergeHistory.entries.push({
      timestamp: new Date().toISOString(),
      source: incoming.source,
      sourceId: incoming.sourceId,
      action: "merged",
      mergedFrom: [existing.source, incoming.source],
      fieldsChanged,
    });

    resolved.metadata = {
      ...resolved.metadata,
      mergeHistory,
    };
  }

  // Update timestamp
  resolved.updatedAt = new Date();

  return resolved;
}

/**
 * Resolve conflict for content feed items (System B).
 */
export function resolveFeedItemConflict(
  existing: ContentFeedItem,
  incoming: ContentFeedItem,
  options: ConflictResolutionOptions = {},
): ContentFeedItem {
  const { preferHigherPriorityImages = true, trackMergeHistory = true } =
    options;

  const incomingHasPriority = hasHigherPriority(
    incoming.source,
    existing.source,
  );
  const resolved: ContentFeedItem = { ...existing };

  const fieldsChanged: string[] = [];

  // Title - prefer higher priority source
  if (
    incomingHasPriority &&
    incoming.title &&
    incoming.title !== existing.title
  ) {
    resolved.title = incoming.title;
    fieldsChanged.push("title");
  }

  // Body - prefer longer/more complete
  if (
    !existing.body ||
    (incoming.body && incoming.body.length > existing.body.length)
  ) {
    if (incoming.body !== existing.body) {
      resolved.body = incoming.body;
      fieldsChanged.push("body");
    }
  }

  // Hook - prefer higher priority source
  if (incomingHasPriority && incoming.hook && incoming.hook !== existing.hook) {
    resolved.hook = incoming.hook;
    fieldsChanged.push("hook");
  }

  // Facts - merge unique facts
  if (incoming.facts && incoming.facts.length > 0) {
    const existingFactTexts = new Set(
      (existing.facts || []).map((f) => f.fact.toLowerCase()),
    );
    const newFacts = incoming.facts.filter(
      (f) => !existingFactTexts.has(f.fact.toLowerCase()),
    );

    if (newFacts.length > 0) {
      resolved.facts = [...(existing.facts || []), ...newFacts];
      fieldsChanged.push("facts");
    }
  }

  // Images - merge
  if (incoming.images && incoming.images.length > 0) {
    const existingUrls = new Set((existing.images || []).map((img) => img.url));
    const newImages = incoming.images.filter(
      (img) => !existingUrls.has(img.url),
    );

    if (newImages.length > 0) {
      if (preferHigherPriorityImages && incomingHasPriority) {
        resolved.images = [...newImages, ...(existing.images || [])];
      } else {
        resolved.images = [...(existing.images || []), ...newImages];
      }
      fieldsChanged.push("images");
    }
  }

  // Tags - merge
  if (incoming.tags && incoming.tags.length > 0) {
    const existingTags = new Set(existing.tags || []);
    const newTags = incoming.tags.filter((tag) => !existingTags.has(tag));

    if (newTags.length > 0) {
      resolved.tags = [...(existing.tags || []), ...newTags];
      fieldsChanged.push("tags");
    }
  }

  // Viral score - keep higher score
  if (incoming.viralScore > existing.viralScore) {
    resolved.viralScore = incoming.viralScore;
    fieldsChanged.push("viralScore");
  }

  // Publish at - prefer earlier date (more relevant)
  if (
    !existing.publishAt ||
    (incoming.publishAt && incoming.publishAt < existing.publishAt)
  ) {
    if (incoming.publishAt !== existing.publishAt) {
      resolved.publishAt = incoming.publishAt;
      fieldsChanged.push("publishAt");
    }
  }

  // Expiry - extend if needed
  if (
    incoming.expiresAt &&
    (!existing.expiresAt || incoming.expiresAt > existing.expiresAt)
  ) {
    resolved.expiresAt = incoming.expiresAt;
    fieldsChanged.push("expiresAt");
  }

  // Content hash - keep higher priority
  if (incomingHasPriority && incoming.contentHash !== existing.contentHash) {
    resolved.contentHash = incoming.contentHash;
    fieldsChanged.push("contentHash");
  }

  // Metadata
  resolved.metadata = {
    ...existing.metadata,
    ...incoming.metadata,
  };

  // Merge history
  if (trackMergeHistory && fieldsChanged.length > 0) {
    const mergeHistory: MergeHistory = (existing.metadata
      ?.mergeHistory as MergeHistory) || {
      createdAt: new Date().toISOString(),
      lastMergedAt: new Date().toISOString(),
      mergeCount: 0,
      entries: [],
    };

    mergeHistory.lastMergedAt = new Date().toISOString();
    mergeHistory.mergeCount++;
    mergeHistory.entries.push({
      timestamp: new Date().toISOString(),
      source: incoming.source,
      sourceId: incoming.sourceId,
      action: "merged",
      mergedFrom: [existing.source, incoming.source],
      fieldsChanged,
    });

    resolved.metadata = {
      ...resolved.metadata,
      mergeHistory,
    };
  }

  resolved.updatedAt = new Date();

  return resolved;
}

// ============================================================================
// Field-Level Merge Helpers
// ============================================================================

/**
 * Merge two image arrays, preferring higher priority source images.
 */
export function mergeImages(
  existing: Image[],
  incoming: Image[],
  preferIncoming: boolean,
): Image[] {
  const existingUrls = new Set(existing.map((img) => img.url));
  const newImages = incoming.filter((img) => !existingUrls.has(img.url));

  if (newImages.length === 0) {
    return existing;
  }

  return preferIncoming
    ? [...newImages, ...existing]
    : [...existing, ...newImages];
}

/**
 * Merge two string arrays, removing duplicates.
 */
export function mergeUniqueStrings(
  existing: string[],
  incoming: string[],
): string[] {
  const set = new Set(existing);
  for (const item of incoming) {
    set.add(item);
  }
  return Array.from(set);
}
